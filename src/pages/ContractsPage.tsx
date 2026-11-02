import { EmptyState, LoadingState } from '../components/FeedbackState';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CLOUD_API_BASE } from '../services/cloud';
import { DB } from '../store/state';
import { navigateTo } from '../core/renderBridge';
import { contractsAPI, type Contract, type Renewal } from '../services/contracts';
import { confirmAction, requestInput } from '../services/actionDialogs';

const php = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PH_today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
type ContractForm = { reference: string; title: string; supplierId: string; poId: string; bidId: string; saveAsDraft: boolean; startsOn: string; endsOn: string; price: string; pricingTerms: string; renewalNoticeDays: string; notes: string };
const initial = (): ContractForm => ({ reference: '', title: '', supplierId: '', poId: '', bidId: '', saveAsDraft: false, startsOn: PH_today(), endsOn: '', price: '', pricingTerms: '', renewalNoticeDays: '30', notes: '' });
function statusTag(status: string) { return status === 'Draft' ? 'bg-slate-100 text-slate-700' : status === 'Active' ? 'bg-emerald-100 text-emerald-800' : status === 'Expired' ? 'bg-rose-100 text-rose-700' : status === 'Terminated' ? 'bg-slate-200 text-slate-700' : 'bg-sky-100 text-sky-800'; }
function actionBtn(tone: 'neutral' | 'warm' | 'success' | 'danger') {
  const base = 'inline-flex min-h-[34px] items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50';
  switch (tone) {
    case 'success': return `${base} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`;
    case 'danger': return `${base} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`;
    case 'warm': return `${base} border-[#e4c7bb] bg-[#fbf3ef] text-[#a64f32] hover:bg-[#f4e3db]`;
    default: return `${base} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
  }
}

export default function ContractsPage() {
  const [records, setRecords] = useState<Contract[]>([]), [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('All'), [search, setSearch] = useState('');
  const [mode, setMode] = useState<'none' | 'new' | 'edit' | 'renew' | 'history'>('none');
  const [selected, setSelected] = useState<Contract | null>(null), [form, setForm] = useState<ContractForm>(initial());
  const [renewEnd, setRenewEnd] = useState(''), [renewPrice, setRenewPrice] = useState(''), [renewReason, setRenewReason] = useState('');
  const [history, setHistory] = useState<Renewal[]>([]);
  const me = DB.currentUser;
  const manager = me?.role === 'Admin' || me?.role === 'Procurement Head';
  const suppliers = DB.suppliers.filter(s => s?.id && s?.name);
  const refresh = useCallback(async () => { const data = await contractsAPI.list(); setRecords(data.contracts); setLoaded(true); }, []);
  useEffect(() => { if (!CLOUD_API_BASE) { setLoaded(true); return; } void refresh().catch(e => { setError(e instanceof Error ? e.message : String(e)); setLoaded(true); }); }, [refresh]);
  const alerts = records.filter(r => !['Draft', 'Terminated'].includes(r.status) && r.daysUntilExpiry <= r.renewal_notice_days);
  const shown = useMemo(() => records.filter(r => (filter === 'All' || r.status === filter || filter === 'Expiring' && !['Draft', 'Terminated'].includes(r.status) && r.daysUntilExpiry <= r.renewal_notice_days) && [r.reference, r.title, r.supplier_name, r.po_id, r.bid_id, r.status].some(t => String(t ?? '').toLowerCase().includes(search.toLowerCase()))), [records, filter, search]);
  const close = () => { setMode('none'); setSelected(null); setHistory([]); };
  const modify = (key: keyof ContractForm, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const create = () => { setForm(initial()); setSelected(null); setMode('new'); setError(''); };
  const edit = (r: Contract) => { setSelected(r); setForm({ reference: r.reference, title: r.title, supplierId: r.supplier_id, poId: r.po_id ?? '', bidId: r.bid_id ?? '', saveAsDraft: r.status === 'Draft', startsOn: r.starts_on, endsOn: r.ends_on, price: String(r.price), pricingTerms: r.pricing_terms, renewalNoticeDays: String(r.renewal_notice_days), notes: r.notes }); setMode('edit'); setError(''); };
  const renew = (r: Contract) => { setSelected(r); setRenewEnd(''); setRenewPrice(String(r.price)); setRenewReason(''); setMode('renew'); setError(''); };
  async function loadHistory(r: Contract) {
    setSelected(r); setError(''); setBusy(true);
    try { const result = await contractsAPI.renewals(r.id); setHistory(result.renewals); setMode('history'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const payload = { reference: form.reference.trim(), title: form.title.trim(), supplierId: form.supplierId, poId: form.poId.trim(), bidId: form.bidId.trim(), saveAsDraft: form.saveAsDraft, startsOn: form.startsOn, endsOn: form.endsOn, price: Number(form.price), pricingTerms: form.pricingTerms, renewalNoticeDays: Number(form.renewalNoticeDays), notes: form.notes };
      if (mode === 'new') await contractsAPI.create(payload);
      else if (mode === 'edit' && selected) await contractsAPI.update(selected.id, payload);
      else return;
      close(); await refresh(); setNotice('Contract saved successfully to the cloud database.');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function renewSubmit(e: FormEvent) {
    e.preventDefault(); if (!selected) return; setBusy(true); setError(''); setNotice('');
    try {
      await contractsAPI.renew(selected.id, { newEndsOn: renewEnd, price: Number(renewPrice), reason: renewReason.trim() });
      close(); await refresh(); setNotice('Contract renewed. Previous dates and negotiated prices are in renewal history.');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function activate(r: Contract) {
    if (!await confirmAction({ title: 'Activate contract', message: `Publish ${r.reference} for the supplier? Active agreements become visible to the linked supplier and can generate expiration reminders.`, confirmText: 'Activate contract' })) return;
    setBusy(true); setError(''); setNotice('');
    try { await contractsAPI.activate(r.id); await refresh(); setNotice('Draft contract activated and visible to the linked supplier.'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function terminate(r: Contract) {
    const reason = await requestInput({ title: 'Terminate Contract', message: `Terminate ${r.reference}? This is a final action.`, label: 'Termination reason', required: true, multiline: true, tone: 'danger', confirmText: 'Review termination' });
    if (!reason) return;
    if (!await confirmAction({ title: 'Confirm Contract Termination', message: `Permanently mark contract ${r.reference} as terminated? Procurement history will remain visible.`, tone: 'danger', confirmText: 'Terminate contract' })) return;
    setBusy(true); setError(''); setNotice('');
    try { await contractsAPI.terminate(r.id, reason); await refresh(); setNotice('Contract marked as terminated.'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  if (!loaded && !records.length) return <LoadingState title="Loading contracts" description="Checking validity dates, pricing terms, and renewal alerts…" />;
  return <section className="space-y-5">
    <header className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Contract Management</h2>
          <p className="mt-1 text-slate-500">Monitor supplier agreements, validity, negotiated prices, renewal history and expiration warnings.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => { setLoaded(false); void refresh().catch(e => { setError(e instanceof Error ? e.message : String(e)); setLoaded(true); }); }} className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50">Refresh</button>
          {manager && <button type="button" onClick={create} className="pf-primary-action rounded-xl bg-[#a64f32] px-5 py-3 font-bold text-white"><i className="fa-solid fa-plus mr-2" />New Contract</button>}
        </div>
      </div>
    </header>

    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="text-slate-500 text-sm font-semibold uppercase tracking-wide"><i className="fa-solid fa-file-contract mr-2 text-[#a64f32]" />Contracts</div><div className="mt-2 text-4xl font-bold text-slate-900">{records.length}</div></div>
      <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="text-slate-500 text-sm font-semibold uppercase tracking-wide"><i className="fa-solid fa-circle-check mr-2 text-[#a64f32]" />Active</div><div className="mt-2 text-4xl font-bold text-slate-900">{records.filter(r => r.status === 'Active').length}</div></div>
      <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="text-slate-500 text-sm font-semibold uppercase tracking-wide"><i className="fa-solid fa-bell mr-2 text-[#a64f32]" />Expiring / expired</div><div className="mt-2 text-4xl font-bold text-slate-900">{alerts.length}</div></div>
      <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="text-slate-500 text-sm font-semibold uppercase tracking-wide"><i className="fa-solid fa-circle-xmark mr-2 text-[#a64f32]" />Terminated</div><div className="mt-2 text-4xl font-bold text-slate-900">{records.filter(r => r.status === 'Terminated').length}</div></div>
    </div>

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contract, supplier, PO…" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm" aria-label="Search contracts" />
        <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm lg:w-40">{['All', 'Draft', 'Active', 'Upcoming', 'Expired', 'Expiring', 'Terminated'].map(s => <option key={s}>{s}</option>)}</select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {['Reference / Agreement', 'Supplier', 'Winning bid / PO', 'Validity', 'Negotiated price', 'Status / notice', 'Actions'].map(x => <th key={x} className="px-4 py-4 font-bold">{x}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map(c => (
              <tr className="border-t border-slate-100 align-top" key={c.id}>
                <td className="px-4 py-4">
                  <strong className="block text-base text-[#a64f32]">{c.reference}</strong>
                  <p className="mt-1 max-w-[15rem] text-slate-700">{c.title}</p>
                </td>
                <td className="px-4 py-4">
                  <div className="font-semibold text-slate-900">{c.supplier_name}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-2 whitespace-nowrap">
                    {c.bid_id ? <button type="button" onClick={() => navigateTo('bid_comparison')} className="inline-flex rounded-full border border-[#e4c7bb] bg-[#fbf3ef] px-3 py-1 text-xs font-semibold text-[#a64f32] hover:bg-[#f4e3db]" title="Open submitted bids">{c.bid_id}</button> : <span className="text-xs text-slate-400">No bid</span>}
                    {c.po_id ? <div><button type="button" onClick={() => navigateTo('orders')} className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Open purchase orders">{c.po_id}</button></div> : <div className="text-xs text-slate-400">No PO</div>}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="font-medium text-slate-900">{c.starts_on}</div>
                  <p className="text-slate-500">to {c.ends_on}</p>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="font-semibold text-slate-900">{php(c.price)}</div>
                  <p className="mt-1 max-w-[13rem] text-xs leading-5 text-slate-500">{c.pricing_terms || 'Price per agreement'}</p>
                </td>
                <td className="px-4 py-4">
                  <span className={'inline-block rounded-full px-3 py-1 text-xs font-bold ' + statusTag(c.status)}>{c.status}</span>
                  {c.status !== 'Terminated' && c.daysUntilExpiry <= c.renewal_notice_days && <p className="mt-2 text-xs font-medium text-amber-700">{c.status === 'Expired' ? 'Past expiry' : 'Renewal notice'}</p>}
                </td>
                <td className="px-4 py-4">
                  <div className="flex min-w-[14rem] flex-wrap gap-2">
                    {manager && c.status === 'Draft' && <button disabled={busy} onClick={() => void activate(c)} className={actionBtn('success')}>Activate</button>}
                    {manager && c.status !== 'Terminated' && <>
                      <button disabled={busy} onClick={() => edit(c)} className={actionBtn('neutral')}>Edit</button>
                      {c.status !== 'Draft' && <button disabled={busy} onClick={() => renew(c)} className={actionBtn('success')}>Renew</button>}
                      <button disabled={busy} onClick={() => void terminate(c)} className={actionBtn('danger')}>Terminate</button>
                    </>}
                    {manager && <button disabled={busy} onClick={() => void loadHistory(c)} className={actionBtn('warm')}>History</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loaded && shown.length === 0 && <EmptyState title="No contracts found" icon="fa-file-contract" description="New contract records and renewals will appear here. Try clearing your filters if you expected a contract." />}
        {!loaded && <LoadingState title="Loading contracts" description="Checking validity dates, pricing terms, and renewal alerts…" />}
      </div>
    </div>

    {mode !== 'none' && <div role="presentation" className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-label={mode === 'new' ? 'New contract' : mode === 'edit' ? 'Edit contract' : mode === 'renew' ? 'Renew contract' : 'Renewal history'} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">{mode === 'new' ? 'New supplier contract' : mode === 'edit' ? 'Edit contract' : mode === 'renew' ? `Renew ${selected?.reference}` : `Renewal history · ${selected?.reference}`}</h3><p className="text-xs text-slate-500">{mode === 'renew' ? 'Renewals keep the previous expiration and pricing history.' : 'Changes are saved to the shared cloud database.'}</p></div><button type="button" onClick={close} className="text-slate-500 hover:text-slate-900" aria-label="Close"><i className="fa-solid fa-xmark" /></button></div>
      {(mode === 'new' || mode === 'edit') && <form className="space-y-4" onSubmit={save}><div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold uppercase text-slate-600">Contract reference<input required disabled={mode === 'edit'} value={form.reference} onChange={e => modify('reference', e.target.value)} className="mt-1 block w-full rounded-lg border p-2.5 text-sm font-normal" placeholder="CTR-2026-001" maxLength={60} /></label>
        <label className="text-xs font-semibold uppercase text-slate-600">Title<input required value={form.title} onChange={e => modify('title', e.target.value)} className="mt-1 block w-full rounded-lg border p-2.5 text-sm font-normal" placeholder="Office IT supply agreement" maxLength={180} /></label>
        <label className="text-xs font-semibold uppercase text-slate-600">Supplier<select required disabled={mode === 'edit'} value={form.supplierId} onChange={e => setForm(prev => ({ ...prev, supplierId: e.target.value, poId: '', bidId: '' }))} className="mt-1 block w-full rounded-lg border p-2.5 text-sm font-normal"><option value="">Choose registered supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-xs font-semibold uppercase text-slate-600">Linked PO (optional)<select disabled={mode === 'edit'} value={form.poId} onChange={e => setForm(prev => ({ ...prev, poId: e.target.value, bidId: DB.orders.find(o => o.id === e.target.value)?.bidId || '' }))} className="mt-1 block w-full rounded-lg border p-2.5 text-sm font-normal"><option value="">Not linked to a PO</option>{DB.orders.filter(o => !form.supplierId || o.supplierId === form.supplierId).map(o => <option key={o.id} value={o.id}>{o.id} · {o.itemTitle}</option>)}</select></label>
        <label className="text-xs font-semibold uppercase text-slate-600">Linked winning bid (optional)<select disabled={mode === 'edit'} value={form.bidId} onChange={e => modify('bidId', e.target.value)} className="mt-1 block w-full rounded-lg border p-2.5 text-sm font-normal"><option value="">No winning bid linked</option>{DB.bids.filter(b => !form.supplierId || b.supplierId === form.supplierId).filter(b => b.status === 'Selected' || DB.stockNeeds.some(n => n.id === b.needId && n.selectedBidId === b.id) || DB.orders.some(o => o.bidId === b.id)).filter(b => !form.poId || !DB.orders.find(o => o.id === form.poId)?.bidId || DB.orders.find(o => o.id === form.poId)?.bidId === b.id).map(b => <option key={b.id} value={b.id}>{b.id} · {b.supplierName}</option>)}</select></label>
        <label className="text-xs font-semibold uppercase text-slate-600">Start date<input required disabled={mode === 'edit'} type="date" value={form.startsOn} onChange={e => modify('startsOn', e.target.value)} className="mt-1 block w-full rounded-lg border p-2.5 text-sm font-normal" /></label>
        <label className="text-xs font-semibold uppercase text-slate-600">Expiration date<input required disabled={mode === 'edit'} type="date" min={form.startsOn} value={form.endsOn} onChange={e => modify('endsOn', e.target.value)} className="mt-1 block w-full rounded-lg border p-2.5 text-sm font-normal" /></label>
        <label className="text-xs font-semibold uppercase text-slate-600">Negotiated unit price (PHP)<input required type="number" min="0" step="0.01" value={form.price} onChange={e => modify('price', e.target.value)} className="mt-1 block w-full rounded-lg border p-2.5 text-sm font-normal" /></label>
        <label className="text-xs font-semibold uppercase text-slate-600">Renewal alert (days)<input required type="number" min="1" max="365" step="1" value={form.renewalNoticeDays} onChange={e => modify('renewalNoticeDays', e.target.value)} className="mt-1 block w-full rounded-lg border p-2.5 text-sm font-normal" /></label>
      </div><label className="block text-xs font-semibold uppercase text-slate-600">Pricing terms<textarea value={form.pricingTerms} onChange={e => modify('pricingTerms', e.target.value)} className="mt-1 block w-full rounded-lg border p-2.5 text-sm font-normal" rows={2} maxLength={1500} placeholder="Per item, fixed rate, discount schedule, etc." /></label>
        <label className="block text-xs font-semibold uppercase text-slate-600">Notes<textarea value={form.notes} onChange={e => modify('notes', e.target.value)} className="mt-1 block w-full rounded-lg border p-2.5 text-sm font-normal" rows={2} maxLength={2000} /></label>
        {mode === 'new' && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.saveAsDraft} onChange={e => setForm(old => ({ ...old, saveAsDraft: e.target.checked }))} />Save as draft (not yet visible to suppliers; no expiration alerts)</label>}
        {mode === 'edit' && <p className="text-xs text-amber-700">Supplier, reference, and term dates cannot be changed here. Use Renew to extend expiration and keep a dated history.</p>}
        <div className="flex justify-end gap-2 border-t pt-4"><button type="button" className="rounded-lg border px-4 py-2" onClick={close}>Cancel</button><button type="submit" disabled={busy} className="pf-primary-action rounded-lg bg-[#a64f32] px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save contract'}</button></div>
      </form>}
      {mode === 'renew' && <form onSubmit={renewSubmit} className="space-y-4"><p className="text-sm text-slate-600">Current expiration: <strong>{selected?.ends_on}</strong>. Current negotiated price: <strong>{php(selected?.price ?? 0)}</strong>.</p><label className="block text-sm font-semibold">New expiration<input required type="date" min={selected?.ends_on} value={renewEnd} onChange={e => setRenewEnd(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 font-normal" /></label><label className="block text-sm font-semibold">Renewed negotiated price (PHP)<input required type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border p-2.5 font-normal" value={renewPrice} onChange={e => setRenewPrice(e.target.value)} /></label><label className="block text-sm font-semibold">Renewal reason / terms<textarea required minLength={5} maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border p-2.5 font-normal" value={renewReason} onChange={e => setRenewReason(e.target.value)} /></label><div className="flex justify-end gap-2"><button type="button" onClick={close} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={busy || !renewEnd || renewEnd <= (selected?.ends_on || '')} className="pf-primary-action rounded-lg bg-[#a64f32] px-4 py-2 font-semibold text-white">{busy ? 'Saving…' : 'Renew contract'}</button></div></form>}
      {mode === 'history' && <div className="space-y-3">{!history.length ? <p className="text-sm text-slate-500">No renewals recorded yet.</p> : history.map(r => <div className="rounded-lg border p-3 text-sm" key={r.id}><strong>{r.previous_ends_on} → {r.new_ends_on}</strong><p className="text-slate-600">{php(r.previous_price_cents / 100)} → {php(r.new_price_cents / 100)}</p><p className="mt-1">{r.reason}</p><p className="mt-1 text-xs text-slate-500">{r.renewed_at}</p></div>)}<div className="flex justify-end"><button className="rounded-lg border px-4 py-2" onClick={close}>Close</button></div></div>}
    </section></div>}
  </section>;
}
