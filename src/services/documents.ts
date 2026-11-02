import { CLOUD_API_BASE, CLOUD_TOKEN_KEY, cloudRequest } from './cloud';
import { DB } from '../store/state';
import { ownsRequisition } from '../domain/ownerIdentity';
import type { ProcurementRecord } from '../types/procurement';
import type { DocumentCategory, DocumentEntityType, ProcurementDocument } from '../types/documents';

const DB_NAME = 'procureflow-attachments-v1';
const STORE = 'documents';
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const COLLECTIONS: Record<DocumentEntityType, keyof typeof DB> = {
  PR: 'requisitions', BID: 'bids', PO: 'orders', DEL: 'deliveries', PAY: 'payments',
};

type SavedDocument = { id: string; document: ProcurementDocument; blob: Blob };

function currentRole() { return DB.currentUser?.role; }
function ownerIsMe(record: ProcurementRecord): boolean {
  return ownsRequisition(record, DB.currentUser);
}

export function canReadEntity(type: DocumentEntityType, id: string): boolean {
  const user = DB.currentUser;
  if (!user || user.accessRevoked || user.status !== 'Active') return false;
  const record = (DB[COLLECTIONS[type]] as ProcurementRecord[]).find(r => r.id === id);
  if (!record) return false;
  if (user.role === 'Admin' || user.role === 'Procurement Head') return true;
  if (user.role === 'Procurement Officer') return type !== 'PAY';
  if (user.role === 'Employee') return type === 'PR' && ownerIsMe(record);
  if (user.role !== 'Supplier' || type === 'PR') return false;
  const supplierId = user.supplierId;
  if (!supplierId) return false;
  if (type === 'BID' || type === 'PO') return record.supplierId === supplierId;
  const order = DB.orders.find(o => o.id === record.poId);
  return order?.supplierId === supplierId;
}

export function accessibleEntities(type: DocumentEntityType): ProcurementRecord[] {
  return (DB[COLLECTIONS[type]] as ProcurementRecord[]).filter(r => canReadEntity(type, r.id));
}

export function canUploadEntity(type: DocumentEntityType, id: string): boolean {
  return canReadEntity(type, id);
}

function localDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function localOperation<T>(mode: IDBTransactionMode, makeRequest: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await localDB();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = makeRequest(transaction.objectStore(STORE));
    let value: T;
    request.onsuccess = () => { value = request.result; };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => { db.close(); resolve(value); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

const allowedExt = /\.(pdf|png|jpe?g|docx)$/i;
export function validateDocument(file: File): void {
  if (!file || !allowedExt.test(file.name)) throw new Error('Allowed files: PDF, PNG, JPG or DOCX.');
  if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES) throw new Error('Choose a file between 1 byte and 5 MB.');
}

async function cloudFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(CLOUD_TOKEN_KEY);
  if (!token) throw new Error('Your cloud session has expired. Sign in again.');
  const response = await fetch(`${CLOUD_API_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `Document request failed (${response.status}).`);
  }
  return response;
}

function query(type: DocumentEntityType, id: string) {
  return `?entityType=${encodeURIComponent(type)}&entityId=${encodeURIComponent(id)}`;
}

export async function listDocuments(type: DocumentEntityType, id: string): Promise<ProcurementDocument[]> {
  if (!canReadEntity(type, id)) throw new Error('This transaction is not accessible to your account.');
  if (CLOUD_API_BASE) {
    const result = await cloudRequest(`/documents${query(type, id)}`) as { documents: ProcurementDocument[] };
    return result.documents;
  }
  const all = await localOperation<SavedDocument[]>('readonly', store => store.getAll());
  return all.filter(item => item.document.entityType === type && item.document.entityId === id)
    .map(item => item.document).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function uploadDocument(type: DocumentEntityType, id: string, category: DocumentCategory, file: File): Promise<ProcurementDocument> {
  if (!canUploadEntity(type, id)) throw new Error('You are not permitted to upload documents to this record.');
  validateDocument(file);
  if (CLOUD_API_BASE) {
    const form = new FormData();
    form.set('entityType', type);
    form.set('entityId', id);
    form.set('category', category);
    form.set('file', file, file.name);
    const response = await cloudFetch('/documents', { method: 'POST', body: form });
    return (await response.json() as { document: ProcurementDocument }).document;
  }
  const user = DB.currentUser!;
  const document: ProcurementDocument = {
    id: crypto.randomUUID(), entityType: type, entityId: id, category,
    fileName: file.name, mimeType: file.type || 'application/octet-stream',
    size: file.size, uploaderId: user.id, uploaderName: user.name,
    createdAt: new Date().toISOString(),
  };
  await localOperation('readwrite', store => store.put({ id: document.id, document, blob: file }));
  return document;
}

export async function downloadDocument(record: ProcurementDocument): Promise<void> {
  if (!canReadEntity(record.entityType, record.entityId)) throw new Error('Access denied.');
  let blob: Blob;
  if (CLOUD_API_BASE) {
    blob = await (await cloudFetch(`/documents/${encodeURIComponent(record.id)}/file`)).blob();
  } else {
    const item = await localOperation<SavedDocument | undefined>('readonly', store => store.get(record.id));
    if (!item) throw new Error('The file was not found on this browser.');
    blob = item.blob;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = record.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function deleteDocument(document: ProcurementDocument): Promise<void> {
  if (!canReadEntity(document.entityType, document.entityId)) throw new Error('Access denied.');
  const role = currentRole();
  if (document.uploaderId !== DB.currentUser?.id && !['Admin', 'Procurement Head'].includes(role || '')) {
    throw new Error('Only the uploader or procurement management may remove a document.');
  }
  if (CLOUD_API_BASE) {
    await cloudFetch(`/documents/${encodeURIComponent(document.id)}`, { method: 'DELETE' });
  } else {
    await localOperation('readwrite', store => store.delete(document.id));
  }
}
