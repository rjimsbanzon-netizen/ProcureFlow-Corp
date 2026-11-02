import { formatQuantity, formatQuantityRatio } from '../domain/measurementUnits';
import { EmptyState, LoadingState } from '../components/FeedbackState';
import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { financeAPI } from '../services/finance';
import type { FinanceSettings, InvoiceRow } from '../services/finance';
import { DB } from '../store/state';
import { CLOUD_API_BASE } from '../services/cloud';
import { listDocuments, uploadDocument, validateDocument } from '../services/documents';
import type { ProcurementDocument } from '../types/documents';
import { RestoreMissingRecord } from '../components/RestoreMissingRecord';

const money = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cents = (value: number) => Math.round(value * 100);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

type Status = 'pass' | 'wait' | 'fail';
function Check({ status, children }: { status: Status; children: React.ReactNode }) {
  const color = status === 'pass' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : status === 'fail' ? 'text-rose-700 bg-rose-50 border-rose-200'
    : 'text-amber-800 bg-amber-50 border-amber-200';
  const symbol = status === 'pass' ? '✓' : status === 'fail' ? '!' : '…';
  return <div className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${color}`}>
    <span aria-hidden="true" className="font-bold">{symbol}</span><span>{children}</span>
  </div>;
}

export default function InvoiceMatchingPage() {
  const me = DB.currentUser;
  const isSupplier = me?.role === 'Supplier';
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceListAccessible, setInvoiceListAccessible] = useState(false);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [poId, setPoId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [amount, setAmount] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<ProcurementDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [filter, setFilter] = useState<'all' | 'review' | 'matched'>('all');
  const [search, setSearch] = useState('');
  const [selectedReview, setSelectedReview] = useState<string | null>(null);

  // Supplier identities are resolved from the same PO ownership rules used by Document Management.
  const orders = DB.orders.filter(order => !isSupplier ||
    (me?.supplierId && order.supplierId === me.supplierId) ||
    (me?.companyName && String(order.supplierName || '').trim().toLowerCase() === me.companyName.trim().toLowerCase())
  );
  const po = orders.find(order => order.id === poId);
  const deliveries = DB.deliveries.filter(delivery => delivery.poId === poId);
  const deliveredQty = deliveries.reduce((sum, delivery) => sum + Number(delivery.deliveredQty || 0), 0);
  const quantity = Number(po?.quantity || 0);
  const deliveryVerified = Boolean(po && deliveries.length && quantity > 0 &&
    deliveredQty >= quantity && deliveries.every(delivery => delivery.complianceStatus === 'Completed - Verified'));
  const poSigned = Boolean(po && ['Approved & Signed', 'Issued'].includes(po.status));
  const amountMatches = Boolean(po && amount.trim() && Number.isFinite(Number(amount)) &&
    cents(Number(amount)) === cents(Number(po.totalCost)));
  // The Worker's D1-validated effective access is authoritative. A local
  // role or appointment label alone is not sufficient for a sign-off.
  const canVerify = !isSupplier && settings?.invoiceVerification?.allowed === true;
  const actingFinance = canVerify && Boolean(settings?.invoiceVerification?.acting);
  const canSubmit = isSupplier;
  const reviewInvoice = invoices.find(invoice => invoice.id === selectedReview) ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Load these independently. Even if invoice access is denied, the user
      // still needs the server's explanation of their current delegation.
      const [list, config] = await Promise.allSettled([
        financeAPI.invoices(),
        isSupplier ? Promise.resolve(null) : financeAPI.settings(),
      ]);
      if (config.status === 'fulfilled') setSettings(config.value);
      else setSettings(null);
      if (list.status === 'fulfilled') {
        setInvoices(list.value.invoices || []);
        setInvoiceListAccessible(true);
      } else {
        setInvoices([]);
        setInvoiceListAccessible(false);
      }
      const issues = [
        list.status === 'rejected' ? `Invoice list unavailable: ${errorMessage(list.reason)}` : '',
        config.status === 'rejected' ? `Finance permissions unavailable: ${errorMessage(config.reason)}` : '',
      ].filter(Boolean);
      setError(issues.join(' '));
    } finally {
      setLoading(false);
    }
  }, [isSupplier]);

  useEffect(() => { void refresh(); }, [refresh]);
  const loadDocuments = useCallback(async (id: string, cancelled: () => boolean) => {
    setDocsLoading(true);
    setDocsError('');
    try {
      const result = await listDocuments('PO', id);
      if (!cancelled()) setDocuments(result.filter(doc => doc.category === 'Invoice' && doc.uploaderId === me?.id));
    } catch (err) {
      if (!cancelled()) { setDocuments([]); setDocsError(errorMessage(err)); }
    } finally {
      if (!cancelled()) setDocsLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!isSupplier || !poId) { setDocuments([]); setDocsError(''); setDocsLoading(false); return; }
    let cancelled = false;
    void loadDocuments(poId, () => cancelled);
    return () => { cancelled = true; };
  }, [poId, loadDocuments, isSupplier]);

  function changePO(id: string) {
    setPoId(id);
    setAmount(id ? String(orders.find(order => order.id === id)?.totalCost ?? '') : '');
    setDocumentId(''); setFile(null); setDocuments([]); setDocsError(''); setMessage('');
  }
  function reviewChecks(invoice: InvoiceRow) {
    setSelectedReview(invoice.id);
    setPoId(invoice.poId);
    setAmount(String(invoice.amount));
    setDocumentId(invoice.documentId || '');
    setFile(null);
    setError('');
  }
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.currentTarget.files?.[0] || null;
    setFile(chosen);
    if (chosen) setDocumentId('');
    setDocsError('');
  }
  async function submitInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canSubmit) return;
    if (!po || !['Approved & Signed', 'Issued'].includes(po.status) || !invoiceNo.trim() || !invoiceDate || !amount || (!file && !documentId)) {
      setError('Choose an accepted/issued Purchase Order and provide the invoice details and attachment.');
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) { setError('Enter a valid invoice amount.'); return; }
    setBusy(true); setError(''); setMessage('');
    let linkedId = documentId;
    let uploadedThisTime = false;
    try {
      if (file) {
        validateDocument(file);
        const uploaded = await uploadDocument('PO', po.id, 'Invoice', file);
        linkedId = uploaded.id;
        uploadedThisTime = true;
        setDocumentId(linkedId);
        setFile(null);
        setDocuments(current => [uploaded, ...current]);
      }
      // The server stores only the linked document ID; the file itself is retained in private Workers KV.
      await financeAPI.submitInvoice(po.id, invoiceNo.trim(), value, invoiceDate, linkedId);
      setMessage(`Invoice ${invoiceNo.trim()} submitted. Finance can verify it after the PO and delivery checks pass.`);
      setInvoiceNo(''); setDocumentId(''); setFile(null);
      await refresh();
    } catch (err) {
      setError(`Could not submit the invoice: ${errorMessage(err)}${uploadedThisTime ? ' Your file is saved and selected; you can retry without uploading again.' : ''}`);
    } finally { setBusy(false); }
  }

  async function verifyInvoice(invoice: InvoiceRow) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await financeAPI.matchInvoice(invoice.id);
      setMessage(`${invoice.invoiceNo} verified. The matching requirement for payment is satisfied.`);
      await refresh();
    } catch (err) { setError(`Matching failed: ${errorMessage(err)}`); }
    finally { setBusy(false); }
  }
  async function downloadInvoice(invoice: InvoiceRow) {
    if (downloading) return;
    setDownloading(invoice.id); setError('');
    try { await financeAPI.downloadInvoiceAttachment(invoice.id, invoice.invoiceNo); }
    catch (err) { setError(`Could not download invoice ${invoice.invoiceNo}: ${errorMessage(err)}`); }
    finally { setDownloading(null); }
  }

  const isValidMatch = (invoice: InvoiceRow) => invoice.status === 'Matched' && invoice.reasons.length === 0;
  const displayed = invoices.filter(invoice => {
    const matchesText = [invoice.poId, invoice.invoiceNo, invoice.supplierName].join(' ').toLowerCase().includes(search.toLowerCase().trim());
    return matchesText && (filter === 'all' || (filter === 'matched' ? isValidMatch(invoice) : !isValidMatch(invoice)));
  });
  const awaiting = invoices.filter(invoice => !isValidMatch(invoice)).length;
  const matched = invoices.filter(isValidMatch).length;

  return <div className="max-w-6xl mx-auto space-y-5 pb-6">
    <header className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex flex-wrap justify-between items-start gap-2">
        <div><h2 className="text-xl font-bold text-slate-900">{isSupplier ? 'Supplier Invoice Submission' : 'Invoice & PO Matching'}</h2>
          <p className="text-sm text-slate-500 mt-1">{isSupplier
            ? 'Upload your company invoice for an issued PO. You can track the checks, but only an assigned Finance reviewer can confirm the match.'
            : 'Review supplier-submitted invoices against issued POs and inspected deliveries. Only an assigned Finance reviewer can confirm a match.'}</p></div>
        <button type="button" className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => void refresh()} disabled={busy || loading}>Refresh invoices</button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-5">
        {[
          ['1', 'Supplier submits', 'Only the supplier attaches their invoice to an issued PO.'],
          ['2', 'Delivery inspection', 'Staff confirms the items were received correctly.'],
          ['3', 'Finance confirms', 'The assigned Finance Officer reviews and confirms the match.'],
        ].map(step => <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-start gap-2" key={step[0]}>
          <span className="rounded-full bg-[#aa5638] text-white font-bold text-xs w-6 h-6 flex items-center justify-center shrink-0">{step[0]}</span>
          <div><div className="text-sm font-semibold text-slate-800">{step[1]}</div><p className="text-xs text-slate-500 mt-1">{step[2]}</p></div>
        </div>)}
      </div>
    </header>

    {!isSupplier && !loading && <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-sm text-sky-900">
      {canVerify ? <><strong>{actingFinance ? 'Acting Finance Officer:' : 'Assigned Finance Reviewer:'}</strong> Inspect the supplier's file and three-way checks before confirming a match.
        {actingFinance && settings?.invoiceVerification?.validUntil && <> Your delegation is valid through <strong>{settings.invoiceVerification.validUntil}</strong> (Philippine time).</>}</>
        : <><strong>Finance verification not assigned:</strong> {settings?.invoiceVerification?.reason || 'The Worker has not confirmed an active Finance Officer assignment or delegation. Refresh after deploying the latest Worker.'} Admin can review appointments in Staff Assignments and temporary coverage in Approval Delegation.</>}
    </div>}
    {!CLOUD_API_BASE && <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">Invoices and matching require an active Cloudflare Worker connection.</div>}
    {error && <div role="alert" className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-800">{error}</div>}
    {message && <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">{message}</div>}

    <section aria-label="Invoice matching summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[{label:'Total invoices',value:invoices.length,icon:'fa-file-invoice-dollar'},{label:'Awaiting verification',value:awaiting,icon:'fa-clock'},{label:'Successfully matched',value:matched,icon:'fa-circle-check'}].map(metric=><div key={metric.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div><p className="text-xs font-bold uppercase text-slate-500">{metric.label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{loading?'…':!invoiceListAccessible?'—':metric.value}</p></div><i aria-hidden="true" className={`fa-solid ${metric.icon} text-xl text-[#a64f32]`} /></div>)}
    </section>
    <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)] gap-4 items-start">
      {isSupplier ? <form className="bg-white border border-slate-200 rounded-xl p-5 space-y-4" onSubmit={e => void submitInvoice(e)}>
        <div><h3 className="font-bold text-slate-900">Step 1 · Submit your invoice</h3>
          <p className="text-xs text-slate-500 mt-1">Select your accepted PO and upload the invoice issued by your company. This submission is not an approval.</p></div>
        <label className="block text-sm font-semibold text-slate-700">1. Purchase Order
          <select className="w-full mt-1.5 p-2.5 border border-slate-300 rounded-lg bg-white text-sm" required value={poId} onChange={e => changePO(e.target.value)}>
            <option value="">Select Purchase Order</option>
            {orders.map(order => <option value={order.id} key={order.id}>{order.id} — {order.supplierName} — {money(Number(order.totalCost || 0))}</option>)}
          </select>
        </label>
        {orders.length === 0 && <p className="text-xs text-amber-800">No accessible Purchase Orders yet. A PO must be created and assigned before submitting an invoice.</p>}
        {po && <div className="grid sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
          <div><span className="text-slate-500">Supplier</span><p className="font-semibold text-slate-800 mt-1">{po.supplierName}</p></div>
          <div><span className="text-slate-500">PO value</span><p className="font-bold text-slate-800 mt-1">{money(Number(po.totalCost || 0))}</p></div>
          <div><span className="text-slate-500">Items / quantity</span><p className="font-semibold text-slate-800 mt-1">{po.itemTitle || 'Purchase order'} · {formatQuantity(po.quantity, po.unit)}</p></div>
          <div><span className="text-slate-500">PO status</span><p className="font-semibold text-slate-800 mt-1">{po.status}</p></div>
        </div>}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-700">2. Invoice number
            <input className="w-full mt-1.5 p-2.5 border border-slate-300 rounded-lg text-sm" maxLength={100} required placeholder="INV-2026-0042" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}/>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Invoice date
            <input className="w-full mt-1.5 p-2.5 border border-slate-300 rounded-lg text-sm" type="date" required value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}/>
          </label>
          <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Invoice total (PHP)
            <input className="w-full mt-1.5 p-2.5 border border-slate-300 rounded-lg text-sm" type="number" min="0" step="0.01" required placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}/>
            <span className="block text-xs mt-1 font-normal text-slate-500">The total should match the full PO amount; partial billing is not supported in this workflow.</span>
          </label>
        </div>
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <label className="block text-sm font-semibold text-slate-700">3. Upload the invoice file (PDF, JPG, PNG, DOCX · maximum 5 MB)
            <input className="block w-full mt-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:px-3 file:py-2 file:font-medium" type="file" key={poId + (file?.name ?? 'empty')} accept=".pdf,.png,.jpg,.jpeg,.docx" disabled={!po || busy} onChange={chooseFile}/>
          </label>
          <p className="text-xs text-slate-500">The file is saved privately under the selected PO in Document Management. You only need one uploaded invoice file per submission.</p>
          <div className="text-center text-xs font-semibold uppercase text-slate-400">or use a previously uploaded invoice</div>
          <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm" value={file ? '' : documentId} disabled={!po || busy || docsLoading} onChange={e => { setDocumentId(e.target.value); setFile(null); }}>
            <option value="">{docsLoading ? 'Loading documents…' : 'Select existing invoice document (optional)'}</option>
            {documents.map(doc => <option key={doc.id} value={doc.id}>{doc.fileName} · {doc.createdAt.slice(0, 10)}</option>)}
          </select>
          {docsError && <p role="alert" className="text-xs text-rose-700">Could not load existing files: {docsError}. You can still upload a new file.</p>}
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-slate-200">
          <button type="button" className="w-full sm:w-auto border border-slate-300 text-slate-700 rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50" disabled={busy} onClick={() => { setInvoiceNo(''); setAmount(po ? String(po.totalCost) : ''); setDocumentId(''); setFile(null); setDocsError(''); }}>Clear fields</button>
          <button className="w-full sm:w-auto bg-[#aa5638] hover:bg-[#91462e] text-white px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50" type="submit" disabled={!canSubmit || busy || !po || !poSigned || !invoiceNo.trim() || !amount.trim() || (!file && !documentId)}>
            {busy ? 'Submitting invoice…' : 'Submit to Finance'}
          </button>
        </div>
      </form> : <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div><h3 className="font-bold text-slate-900">Step 3 · Review supplier invoice</h3>
          <p className="text-xs text-slate-500 mt-1">Click <strong>Review checks</strong> next to an invoice below. Supplier submission and Finance verification are separate actions.</p></div>
        {reviewInvoice ? <>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{reviewInvoice.invoiceNo}</strong><span className="text-xs text-slate-500">{isValidMatch(reviewInvoice) ? 'Finance verified' : reviewInvoice.status === 'Matched' ? 'Match needs repair' : 'Awaiting Finance verification'}</span></div>
            <div>Supplier: <strong>{reviewInvoice.supplierName}</strong></div>
            <div>Purchase Order: <strong>{reviewInvoice.poId}</strong></div>
            <div>Invoice total: <strong>{money(reviewInvoice.amount)}</strong></div>
          </div>
          {reviewInvoice.reasons.length > 0 && <div role="status" className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-sm text-amber-900"><strong>Matching issues:</strong><ul className="list-disc pl-5 mt-2 space-y-1">{reviewInvoice.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}
          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="w-full sm:w-auto border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" disabled={Boolean(downloading)} onClick={() => void downloadInvoice(reviewInvoice)}>{downloading === reviewInvoice.id ? 'Downloading…' : 'Download invoice file'}</button>
            {canVerify && reviewInvoice.status === 'Submitted' && <button type="button" className="w-full sm:w-auto bg-[#aa5638] hover:bg-[#91462e] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" disabled={busy || reviewInvoice.reasons.length > 0} onClick={() => void verifyInvoice(reviewInvoice)}>Confirm three-way match</button>}
          </div>
        </> : <p className="bg-slate-50 rounded-lg p-4 text-sm text-slate-500">No invoice selected. Use <strong>Review checks</strong> in the invoice register below.</p>}
      </section>}

      <aside className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div><h3 className="font-bold text-slate-900">Step 2 · Automatic matching checklist</h3>
          <p className="text-xs text-slate-500 mt-1">The system compares PO status, delivery inspection, invoiced amount and attached evidence. Passing these checks does not count as Finance approval.</p></div>
        {!po ? <p className="bg-slate-50 rounded-lg p-4 text-sm text-slate-500">{isSupplier ? 'Select a Purchase Order to see what still needs verification.' : 'Choose Review checks for an invoice to inspect its Purchase Order.'}</p> : <>
          <Check status={poSigned ? 'pass' : 'wait'}>{poSigned ? 'Purchase Order accepted / issued.' : 'Waiting for the supplier to accept the Purchase Order.'}</Check>
          <Check status={deliveryVerified ? 'pass' : 'wait'}>{deliveryVerified ? `All ${formatQuantity(quantity, po?.unit)} received and inspected.` : `Delivery: ${formatQuantityRatio(deliveredQty, quantity, po?.unit)} recorded. All deliveries must pass inspection.`}</Check>
          <Check status={!amount.trim() ? 'wait' : amountMatches ? 'pass' : 'fail'}>{!amount.trim() ? 'Enter the invoice total to compare with the PO.' : amountMatches ? 'Invoice amount equals PO total.' : `Invoice amount differs from ${money(Number(po.totalCost || 0))}.`}</Check>
          <Check status={file || documentId ? 'pass' : 'wait'}>{file ? `New file selected: ${file.name}` : documentId ? 'An invoice document is selected.' : 'An invoice file is required.'}</Check>
          <div className="bg-sky-50 border border-sky-100 text-sky-900 rounded-lg p-3 text-xs">
            <strong>Good to know:</strong> A supplier may submit after PO acceptance while delivery is still underway. The invoice cannot be officially verified or paid until all checks pass.
          </div>
        </>}
      </aside>
    </div>

    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <div><h3 className="font-bold text-slate-900">Invoice register</h3>
            <p className="text-xs text-slate-500 mt-1">{isSupplier ? 'Your company’s submitted invoices and verification status.' : 'Review submitted invoices and the reasons a match is blocked.'}</p></div>
          <div className="flex gap-2 text-xs font-semibold"><span className="bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full">{awaiting} awaiting</span><span className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full">{matched} matched</span></div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <input type="search" aria-label="Search invoices" className="flex-1 min-w-40 rounded-lg border border-slate-300 p-2 text-sm" placeholder="Search invoice, PO or supplier…" value={search} onChange={e => setSearch(e.target.value)}/>
          <select aria-label="Filter invoices" className="rounded-lg border border-slate-300 p-2 text-sm" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
            <option value="all">All invoices</option><option value="review">Needs review</option><option value="matched">Matched</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[790px] text-left text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase"><tr>
          {['Purchase Order / Supplier', 'Invoice', 'Amount', 'Three-way check', 'Status', 'Actions'].map(label => <th className="p-3" key={label}>{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {displayed.map(invoice => <tr key={invoice.id} className="align-top">
            <td className="p-3"><span className="font-semibold text-slate-900">{invoice.poId}</span><div className="text-xs text-slate-500 mt-1">{invoice.supplierName}</div></td>
            <td className="p-3"><span className="font-semibold">{invoice.invoiceNo}</span><div className="text-xs text-slate-500 mt-1">{invoice.invoiceDate}</div></td>
            <td className="p-3 font-semibold whitespace-nowrap">{money(invoice.amount)}</td>
            <td className="p-3 min-w-52">{invoice.reasons.length > 0 ? <ul className="list-disc pl-4 space-y-1 text-xs text-amber-800">{invoice.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
              : <span className="text-xs text-emerald-700 font-medium">✓ Automatic checks passed (Finance confirmation still required)</span>}</td>
            <td className="p-3"><span className={`inline-block text-xs rounded-full px-2.5 py-1 font-semibold ${isValidMatch(invoice) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{isValidMatch(invoice) ? 'Matched' : invoice.status === 'Matched' ? 'Match invalid — review' : 'Awaiting verification'}</span></td>
            <td className="p-3"><div className="flex flex-wrap items-center gap-2 min-w-[190px]">
              {!isSupplier && <button type="button" className={`text-xs font-semibold border rounded-lg px-3 py-2 whitespace-nowrap ${selectedReview === invoice.id ? 'border-[#aa5638] bg-orange-50 text-[#91462e]' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`} onClick={() => reviewChecks(invoice)}>Review checks</button>}
              <button type="button" className="text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg px-3 py-2 whitespace-nowrap disabled:opacity-50" disabled={Boolean(downloading)} onClick={() => void downloadInvoice(invoice)}>{downloading === invoice.id ? 'Downloading…' : 'Invoice file'}</button>
              {canVerify && invoice.status === 'Submitted' && invoice.reasons.length === 0 &&
                <button type="button" className="bg-[#aa5638] hover:bg-[#91462e] text-white rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap disabled:opacity-50" disabled={busy} onClick={() => void verifyInvoice(invoice)}>Confirm match</button>}
            </div>
            {invoice.status === 'Submitted' && invoice.reasons.length !== 0 && <p className="text-xs text-amber-700 mt-2">Automatic checks incomplete</p>}
            {invoice.status === 'Submitted' && invoice.reasons.length === 0 && !canVerify && <p className="text-xs text-slate-500 mt-2">Awaiting assigned Finance Officer</p>}
            {isValidMatch(invoice) && <p className="text-xs text-emerald-700 mt-2">Ready for payment review</p>}
            {invoice.status === 'Matched' && !isValidMatch(invoice) && <p className="text-xs text-rose-700 mt-2">Previously matched, but the required PO / receipt is now missing. Payment is blocked.</p>}
            {me?.role === 'Admin' && invoice.reasons.includes('Purchase Order is missing.') && <RestoreMissingRecord kind='PO' recordId={invoice.poId} onRestored={refresh}/>}</td>
          </tr>)}
          {!loading && !invoiceListAccessible && <tr><td colSpan={6} className="p-4 text-sm text-amber-800 bg-amber-50">Invoice records are unavailable to this account right now. See the access explanation above or ask Admin to review the current Finance Officer assignment and delegation. The system has not confirmed that the invoice register is empty.</td></tr>}
          {!loading && invoiceListAccessible && displayed.length === 0 && <tr><td colSpan={6} className="p-0"><EmptyState title={invoices.length ? 'No invoices match the filter' : 'No supplier invoices yet'} icon="fa-file-invoice" description={invoices.length ? 'Change your search or status filter to find invoices.' : 'Supplier invoices will appear after upload for matching against a signed PO and verified delivery.'} /></td></tr>}
          {loading && <tr><td colSpan={6} className="p-0"><LoadingState title="Loading supplier invoices" description="Retrieving the latest cloud invoices and matching statuses…" /></td></tr>}
        </tbody>
      </table></div>
      {canVerify && <p className="border-t border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">Finance reviewer: open the supplier invoice, compare its invoice number, date, items and total against the signed PO and verified delivery, then select <strong>Confirm match</strong>. Automatic checks alone do not approve an invoice.</p>}
    </section>
  </div>;
}
