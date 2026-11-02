import { useCallback, useEffect, useMemo, useState } from 'react';
import { confirmAction } from '../services/actionDialogs';
import type { FormEvent } from 'react';
import { DB } from '../store/state';
import { CLOUD_API_BASE } from '../services/cloud';
import { accessibleEntities, deleteDocument, downloadDocument, listDocuments, uploadDocument } from '../services/documents';
import { DOCUMENT_CATEGORIES, ENTITY_LABELS } from '../types/documents';
import type { DocumentEntityType, DocumentCategory, ProcurementDocument } from '../types/documents';
import { navigateTo } from '../core/renderBridge';

const types: DocumentEntityType[] = ['PR', 'BID', 'PO', 'DEL', 'PAY'];
const date = (iso: string) => new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

export default function DocumentsPage() {
  const [entityType, setEntityType] = useState<DocumentEntityType>(DB.currentUser?.role === 'Supplier' ? 'BID' : 'PR');
  const [selectedId, setSelectedId] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('Supporting Document');
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<ProcurementDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const records = useMemo(() => accessibleEntities(entityType), [entityType]);
  const recordId = records.some(record => record.id === selectedId) ? selectedId : records[0]?.id || '';

  const refresh = useCallback(async () => {
    if (!recordId) { setDocuments([]); return; }
    setLoading(true); setError('');
    try { setDocuments(await listDocuments(entityType, recordId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not list documents.'); setDocuments([]); }
    finally { setLoading(false); }
  }, [entityType, recordId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recordId || !file) return;
    setLoading(true); setError(''); setMessage('');
    try {
      await uploadDocument(entityType, recordId, category, file);
      setFile(null); setMessage('Document uploaded successfully.');
      setDocuments(await listDocuments(entityType, recordId));
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setLoading(false); }
  };

  const remove = async (doc: ProcurementDocument) => {
    if (!await confirmAction({title:'Delete attached document',message:`Delete ${doc.fileName}? This cannot be undone.`,tone:'danger',confirmText:'Delete document'})) return;
    setLoading(true); setError(''); setMessage('');
    try { await deleteDocument(doc); setDocuments(await listDocuments(entityType, recordId)); setMessage('Document removed.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Delete failed.'); }
    finally { setLoading(false); }
  };

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap gap-3 items-center justify-between bg-white border border-slate-200 p-5 rounded-lg">
      <div><h2 className="text-xl font-bold text-slate-800">Document Management</h2>
        <p className="text-sm text-slate-500 mt-1">Quotations, invoices, signed contracts, delivery receipts and supporting documents.</p></div>
      <button type="button" onClick={() => navigateTo('pdf_generator')} className="px-4 py-2.5 text-white rounded bg-[#a64f32] hover:bg-[#873e27] text-sm font-semibold">
        <i className="fa-solid fa-file-pdf mr-2" />PDF Generator
      </button>
    </header>

    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">Linked record type
          <select value={entityType} onChange={e => { setEntityType(e.target.value as DocumentEntityType); setSelectedId(''); setMessage(''); }} className="w-full mt-2 border rounded p-2.5">
            {types.map(t => <option key={t} value={t}>{ENTITY_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">Transaction reference
          <select value={recordId} onChange={e => { setSelectedId(e.target.value); setMessage(''); }} className="w-full mt-2 border rounded p-2.5">
            {records.length === 0 ? <option value="">No accessible records</option> : records.map(r => <option key={r.id} value={r.id}>{r.id} — {String(r.itemTitle || r.supplierName || r.department || '')}</option>)}
          </select>
        </label>
      </div>
      <form onSubmit={upload} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3 items-end border-t pt-5">
        <label className="block text-sm font-semibold text-slate-700">Document category
          <select className="w-full mt-2 border rounded p-2.5" value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}>
            {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">File (max 5 MB)
          <input key={file?.name ?? 'empty'} className="w-full mt-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-stone-100 file:px-3 file:py-2" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" onChange={e => setFile(e.currentTarget.files?.[0] ?? null)} />
        </label>
        <button type="submit" disabled={!recordId || !file || loading} className="rounded bg-[#a64f32] text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><i className="fa-solid fa-upload mr-2" />Upload</button>
      </form>
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {!CLOUD_API_BASE && <p className="text-xs text-amber-700">Files in demo mode are stored only in this browser (IndexedDB). Use Cloudflare KV + D1 for shared and secure document storage.</p>}
    </div>

    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b bg-[#eee9dd] flex justify-between items-center"><h3 className="font-bold text-slate-800">Attached Documents ({documents.length})</h3>
        <button type="button" onClick={() => void refresh()} className="text-sm text-[#a64f32]" disabled={loading}><i className="fa-solid fa-rotate-right mr-1"/>Refresh</button></div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{['File','Category','Uploaded by','Date','Size','Actions'].map(x => <th className="p-3" key={x}>{x}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {documents.map(doc => <tr key={doc.id}>
            <td className="p-3 font-medium max-w-xs break-words">{doc.fileName}</td><td className="p-3">{doc.category}</td>
            <td className="p-3">{doc.uploaderName}</td><td className="p-3 whitespace-nowrap">{date(doc.createdAt)}</td>
            <td className="p-3">{Math.ceil(doc.size / 1024)} KB</td>
            <td className="p-3 whitespace-nowrap space-x-3">
              <button type="button" className="font-semibold text-[#a64f32]" onClick={() => void downloadDocument(doc).catch(e => setError(String(e)))}>Download</button>
              {(doc.uploaderId === DB.currentUser?.id || ['Admin','Procurement Head'].includes(DB.currentUser?.role ?? '')) &&
                <button type="button" className="font-semibold text-rose-700" disabled={loading} onClick={() => void remove(doc)}>Delete</button>}
            </td>
          </tr>)}
          {documents.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">{loading ? 'Loading documents…' : 'No documents attached to this transaction.'}</td></tr>}
        </tbody>
      </table></div>
    </section>
  </div>;
}
