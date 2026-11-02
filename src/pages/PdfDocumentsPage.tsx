import { useMemo, useState } from 'react';
import { DB } from '../store/state';
import { exportProcurementPDF, printableRecords, PRINT_TITLES } from '../services/pdfDocuments';
import type { PrintableType } from '../services/pdfDocuments';

const types: PrintableType[] = ['PR', 'PO', 'AGREEMENT', 'INSPECTION', 'PAYMENT'];

export default function PdfDocumentsPage() {
  const [kind, setKind] = useState<PrintableType>(DB.currentUser?.role === 'Supplier' ? 'PO' : 'PR');
  const [recordId, setRecordId] = useState('');
  const [error, setError] = useState('');
  const records = useMemo(() => printableRecords(kind), [kind]);
  const id = records.some(r => r.id === recordId) ? recordId : records[0]?.id || '';

  const exportPDF = () => {
    setError('');
    try { exportProcurementPDF(kind, id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not generate PDF.'); }
  };

  return <div className="mx-auto max-w-4xl space-y-5">
    <div className="border border-slate-200 bg-white p-6 rounded-lg shadow-sm">
      <div className="flex gap-3 items-center mb-2"><i className="fa-solid fa-file-pdf text-2xl text-[#a64f32]" />
        <h2 className="text-xl font-bold text-slate-800">PDF Document Generator</h2></div>
      <p className="text-sm text-slate-500">Generate printable procurement records using current system data.</p>
    </div>
    <div className="grid md:grid-cols-2 gap-4 p-6 bg-white rounded-lg border border-slate-200">
      <label className="text-sm font-semibold text-slate-700">Document type
        <select className="mt-2 block w-full border rounded p-2.5" value={kind} onChange={e => { setKind(e.target.value as PrintableType); setRecordId(''); }}>
          {types.map(t => <option key={t} value={t}>{PRINT_TITLES[t]}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700">Transaction reference
        <select className="mt-2 block w-full border rounded p-2.5" value={id} onChange={e => setRecordId(e.target.value)}>
          {records.length === 0 ? <option value="">No accessible records</option> : records.map(r => <option key={r.id} value={r.id}>{r.id} — {String(r.itemTitle || r.supplierName || r.department || '')}</option>)}
        </select>
      </label>
      <div className="md:col-span-2 flex justify-between items-center gap-3 flex-wrap">
        <p className="text-xs text-slate-500">No approval signatures are fabricated. Upload a signed copy through Document Management when needed.</p>
        <button type="button" disabled={!id} onClick={exportPDF} className="px-4 py-2.5 bg-[#a64f32] text-white rounded disabled:opacity-50"><i className="fa-solid fa-download mr-2" />Generate PDF</button>
      </div>
      {error && <div role="alert" className="md:col-span-2 text-red-700 text-sm">{error}</div>}
    </div>
  </div>;
}
