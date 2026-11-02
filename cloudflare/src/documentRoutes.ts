import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

/** Secure document endpoints for ProcureFlow's existing authenticated Worker.
 * Required binding: DOCUMENTS: KVNamespace (private namespace).
 * Returned Response | null: null means pass through to the existing router.
 */

type Entity = 'PR' | 'BID' | 'PO' | 'DEL' | 'PAY';
type DataRecord = Record<string, unknown>;
type Snapshot = Record<string, DataRecord[]>;
type Identity = { id: string; name: string; role: 'admin' | 'employee' | 'guest'; };
type Profile = { app_role: string; company_name: string; status: string; access_revoked: number; username: string; username_aliases: string; name_aliases: string; };
type Context = { DB: D1Database; DOCUMENTS: KVNamespace };
type DocRow = {
  id: string; entity_type: Entity; entity_id: string; category: string;
  file_name: string; mime_type: string; size: number; kv_key: string;
  uploader_id: string; uploader_name: string; created_at: string;
};

const collections: Record<Entity, string> = { PR: 'requisitions', BID: 'bids', PO: 'orders', DEL: 'deliveries', PAY: 'payments' };
const categories = new Set(['Quotation', 'Invoice', 'Delivery Receipt', 'Signed Contract', 'Supporting Document']);
const MAX_SIZE = 5 * 1024 * 1024;

function response(data: unknown, status: number, cors: HeadersInit): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function validEntity(value: unknown): value is Entity {
  return value === 'PR' || value === 'BID' || value === 'PO' || value === 'DEL' || value === 'PAY';
}
function recordOf(snapshot: Snapshot, type: Entity, id: string): DataRecord | undefined {
  return snapshot[collections[type]]?.find(item => item.id === id);
}
function string(v: unknown) { return typeof v === 'string' ? v : ''; }
function supplierId(snapshot: Snapshot, profile: Profile, user: Identity): string {
  const match = snapshot.suppliers?.find(s => string(s.name).toLowerCase() === (profile.company_name || '').toLowerCase());
  return string(match?.id) || `supplier-${user.id}`;
}

function canRead(snapshot: Snapshot, type: Entity, id: string, profile: Profile, user: Identity): boolean {
  const record = recordOf(snapshot, type, id);
  if (!record) return false;
  const role = profile.app_role || (user.role === 'admin' ? 'Admin' : user.role === 'guest' ? 'Supplier' : 'Employee');
  if (role === 'Admin' || role === 'Procurement Head') return true;
  if (role === 'Procurement Officer') return type !== 'PAY';
  if (role === 'Employee') {
    let usernames:string[]=[];let names:string[]=[];
    try{usernames=JSON.parse(profile.username_aliases)||[];}catch{}
    try{names=JSON.parse(profile.name_aliases)||[];}catch{}
    return type === 'PR' && (record.requestedByUsername
      ? record.requestedByUsername === profile.username || usernames.includes(string(record.requestedByUsername))
      : record.requestedBy === user.name || Boolean(record.requestedBy && names.includes(string(record.requestedBy))));
  }
  if (role !== 'Supplier' || type === 'PR') return false;
  const supplier = supplierId(snapshot, profile, user);
  if (type === 'BID' || type === 'PO') return record.supplierId === supplier;
  const order = recordOf(snapshot, 'PO', string(record.poId));
  return order?.supplierId === supplier;
}

function publicRecord(row: DocRow) {
  return {
    id: row.id, entityType: row.entity_type, entityId: row.entity_id,
    category: row.category, fileName: row.file_name, mimeType: row.mime_type,
    size: row.size, uploaderId: row.uploader_id, uploaderName: row.uploader_name,
    createdAt: row.created_at,
  };
}

async function event(env: Context, row: DocRow, user: Identity, action: string): Promise<void> {
  await env.DB.prepare(`INSERT INTO procurement_document_events(id,document_id,actor_id,action,occurred_at)
    VALUES(?,?,?,?,?)`).bind(crypto.randomUUID(), row.id, user.id, action, new Date().toISOString()).run();
}

function fileType(file: File, signature: Uint8Array): string | null {
  const name = file.name.toLowerCase();
  const starts = (...bytes: number[]) => bytes.every((v, i) => signature[i] === v);
  if (name.endsWith('.pdf') && starts(0x25,0x50,0x44,0x46,0x2d)) return 'application/pdf';
  if (name.endsWith('.png') && starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)) return 'image/png';
  if (/\.jpe?g$/.test(name) && starts(0xff,0xd8,0xff)) return 'image/jpeg';
  if (name.endsWith('.docx') && starts(0x50,0x4b,0x03,0x04)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return null;
}

export async function handleDocumentRoutes(
  request: Request, env: Context, user: Identity, cors: HeadersInit,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path !== '/documents' && !/^\/documents\/[0-9a-f-]{36}(\/file)?$/i.test(path)) return null;
  const deny = (message: string, status = 403) => response({ error: message }, status, cors);

  const profile = await env.DB.prepare(`SELECT app_role,company_name,status,access_revoked,username,username_aliases,name_aliases FROM users WHERE id=?`)
    .bind(user.id).first<Profile>();
  if (!profile || profile.status !== 'approved' || profile.access_revoked) return deny('Account is not approved or is revoked.');

  const snapshotRow = await env.DB.prepare('SELECT data FROM enterprise_state WHERE id=1').first<{data: string}>();
  let snapshot: Snapshot = {};
  try { snapshot = snapshotRow ? JSON.parse(snapshotRow.data) as Snapshot : {}; }
  catch { return deny('Procurement dataset is unavailable.', 503); }

  if (path === '/documents' && request.method === 'GET') {
    const type = url.searchParams.get('entityType');
    const id = url.searchParams.get('entityId') || '';
    if (!validEntity(type) || id.length > 90) return deny('Invalid transaction reference.', 400);
    if (!canRead(snapshot, type, id, profile, user)) return deny('You cannot view this transaction.');
    const { results } = await env.DB.prepare(`SELECT * FROM procurement_documents WHERE entity_type=? AND entity_id=? ORDER BY created_at DESC`)
      .bind(type, id).all<DocRow>();
    return response({ documents: (results || []).map(publicRecord) }, 200, cors);
  }

  if (path === '/documents' && request.method === 'POST') {
    const body = await request.formData();
    const type = body.get('entityType');
    const id = body.get('entityId');
    const category = body.get('category');
    const file = body.get('file');
    if (!validEntity(type) || typeof id !== 'string' || id.length > 90 ||
        typeof category !== 'string' || !categories.has(category) ||
        !(file instanceof File) || !file.name || file.name.length > 180 ||
        file.size < 1 || file.size > MAX_SIZE) return deny('Invalid file (PDF, PNG, JPG or DOCX; maximum 5 MB).', 400);
    if (!canRead(snapshot, type, id, profile, user)) return deny('You cannot upload to this transaction.');
    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const mime = fileType(file, header);
    if (!mime) return deny('File extension or contents are not supported.', 415);
    const docId = crypto.randomUUID();
    const key = `documents/${docId}`;
    const createdAt = new Date().toISOString();
    const row: DocRow = { id: docId, entity_type: type, entity_id: id,
      category, file_name: file.name.replace(/[\r\n\u0000-\u001f]/g, '_'),
      mime_type: mime, size: file.size, kv_key: key, uploader_id: user.id,
      uploader_name: user.name, created_at: createdAt };
    await env.DOCUMENTS.put(key, await file.arrayBuffer());
    try {
      await env.DB.prepare(`INSERT INTO procurement_documents
        (id,entity_type,entity_id,category,file_name,mime_type,size,kv_key,uploader_id,uploader_name,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(row.id,row.entity_type,row.entity_id,row.category,row.file_name,row.mime_type,
          row.size,row.kv_key,row.uploader_id,row.uploader_name,row.created_at).run();
    } catch (e) { await env.DOCUMENTS.delete(key); throw e; }
    await event(env, row, user, 'UPLOAD').catch(e => console.error('Document event logging failed', e));
    return response({ document: publicRecord(row) }, 201, cors);
  }

  const match = path.match(/^\/documents\/([0-9a-f-]{36})(\/file)?$/i);
  if (match && (request.method === 'GET' || request.method === 'DELETE')) {
    const row = await env.DB.prepare(`SELECT * FROM procurement_documents WHERE id=?`).bind(match[1]).first<DocRow>();
    if (!row) return deny('Document not found.', 404);
    if (!canRead(snapshot, row.entity_type, row.entity_id, profile, user)) return deny('Access denied.');
    if (request.method === 'GET' && match[2] === '/file') {
      const fileBytes = await env.DOCUMENTS.get(row.kv_key, 'arrayBuffer');
      if (!fileBytes) return deny('File missing from storage.', 404);
      const safeName = row.file_name.replace(/[^a-zA-Z0-9._() -]/g, '_');
      return new Response(fileBytes, { status: 200, headers: {
        ...cors, 'Content-Type': row.mime_type, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `attachment; filename="${safeName}"`,
      } });
    }
    if (request.method === 'DELETE' && !match[2]) {
      if (row.uploader_id !== user.id && !['Admin', 'Procurement Head'].includes(profile.app_role)) {
        return deny('Only the uploader or procurement management can delete this document.');
      }
      // Submitted supplier invoices are financial evidence. Protect the original
      // file from deletion even when its uploader has upload/delete privileges.
      if (row.entity_type === 'PO' && row.category === 'Invoice') {
        const linked = await env.DB.prepare('SELECT id FROM supplier_invoices WHERE document_id=? LIMIT 1')
          .bind(row.id).first<{ id: string }>();
        if (linked) return deny('This invoice document is linked to a submitted invoice and cannot be deleted.', 409);
      }
      await env.DB.prepare('DELETE FROM procurement_documents WHERE id=?').bind(row.id).run();
      await event(env, row, user, 'DELETE').catch(e => console.error('Document event logging failed', e));
      await env.DOCUMENTS.delete(row.kv_key);
      return response({ ok: true }, 200, cors);
    }
  }
  return deny('Unsupported document method.', 405);
}
