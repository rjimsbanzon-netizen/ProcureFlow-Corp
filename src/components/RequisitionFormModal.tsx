import { useEffect, useId, useState, type FormEvent } from 'react';
import { ownsRequisition } from '../domain/ownerIdentity';
import { DB, ui } from '../store/state';
import { renderApp, navigateTo } from '../core/renderBridge';
import { CLOUD_API_BASE } from '../services/cloud';
import { financeAPI } from '../services/finance';
import { Storage } from '../services/storage';
import { logAudit } from '../services/audit';
import { showToast } from '../services/toast';
import { hasPermission } from '../domain/permissions';
import { fieldClass, mainButton, peso, secondaryButton } from './CoreScreenUI';
import { displayUnit, unitLabel, formatQuantity, type QuantityUnit } from '../domain/measurementUnits';
import { SearchableMeasurementUnit } from './SearchableMeasurementUnit';
import { PRIORITIES, PURCHASE_CATEGORIES, RECURRENCES, type ProcurementPriority, type PurchaseCategory, type ProcurementRecurrence } from '../domain/procurementClassification';

/** Requisition creation is React-managed; cloud submission still uses the existing D1 approval workflow. */
export function RequisitionFormModal({ editId }: { editId?: string }) {
  const titleId = useId();
  const existing = editId ? DB.requisitions.find(pr => pr.id === editId) : null;
  const [priority, setPriority] = useState<ProcurementPriority>(existing?.priority || 'B');
  const [purchaseCategory, setPurchaseCategory] = useState<PurchaseCategory>(existing?.purchaseCategory || 'Goods & Materials');
  const [recurrence, setRecurrence] = useState<ProcurementRecurrence>(existing?.recurrence || 'One-time');
  const [title, setTitle] = useState(String(existing?.itemTitle || ''));
  const [specs, setSpecs] = useState(String(existing?.specs || ''));
  const [quantity, setQuantity] = useState(String(existing?.quantity || 1));
  const [unitOfMeasure, setUnitOfMeasure] = useState<QuantityUnit>(unitLabel(existing?.unit));
  const [price, setPrice] = useState(String(existing?.unitPrice ?? ''));
  const [date, setDate] = useState(String(existing?.targetDate || ''));
  const [remarks, setRemarks] = useState(String(existing?.remarks || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canEdit = Boolean(existing && !CLOUD_API_BASE && existing.status === 'Pending' &&
    ownsRequisition(existing,DB.currentUser));
  const permitted = editId ? canEdit : hasPermission('create_pr');

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) { ui.currentModal = null; renderApp(); } };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [busy]);

  const dismiss = () => { if (!busy) { ui.currentModal = null; ui.selectedRecord = null; renderApp(); } };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permitted || busy || !DB.currentUser) return;
    const qty = Number(quantity), unit = Number(price);
    if (!title.trim() || !specs.trim() || !date || !Number.isInteger(qty) || qty < 1 || !Number.isFinite(unit) || unit < 0 || !price.trim()) {
      setError('Provide an item, specifications, valid quantity, unit price, and target date.'); return;
    }
    setBusy(true); setError('');
    try {
      const data = { itemTitle: title.trim(), specs: specs.trim(), quantity: qty, unit: unitOfMeasure, unitPrice: unit,
        targetDate: date, remarks: remarks.trim(), priority, purchaseCategory, recurrence, totalCost: Math.round(qty * unit * 100) / 100 };
      if (existing && canEdit) {
        Object.assign(existing, data);
        logAudit('PR Updated', `Pending requisition ${existing.id} edited by its requester.`);
        Storage.save(DB);
        dismissAfterSave();
        showToast(`Requisition ${existing.id} updated.`, 'success');
        return;
      }
      const nextId = Math.max(1000, ...DB.requisitions.map(r => Number(String(r.id).match(/^PR-(\d+)$/)?.[1] || 1000))) + 1;
      const prId = `PR-${nextId}`;
      const newPR = { id: prId, department: DB.currentUser.department, ...data, status: 'Pending',
        requestedBy: DB.currentUser.name, requestedByUsername: DB.currentUser.username,
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16) };
      DB.requisitions.unshift(newPR);
      logAudit('PR Created', `Requisition ${prId} created for ${data.itemTitle}.`);
      Storage.save(DB);
      // Keep the same shared snapshot + authorized Department Head submission sequence as the existing flow.
      if (CLOUD_API_BASE) {
        try {
          await Storage.flush();
          await financeAPI.start(prId);
          showToast(`${prId} submitted to Procurement Head for review.`, 'success');
        } catch (err) {
          showToast(`PR ${prId} created locally, but the cloud approval workflow was not confirmed: ${err instanceof Error ? err.message : String(err)}. Review the Approvals page before retrying.`, 'warning');
        }
      } else showToast(`Requisition ${prId} created successfully.`, 'success');
      dismissAfterSave();
      if (CLOUD_API_BASE) navigateTo('approvals');
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }
  function dismissAfterSave() { ui.currentModal = null; ui.selectedRecord = null; renderApp(); }

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/65 p-3 sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="my-auto w-full max-w-xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
      <header className="mb-4 flex items-center justify-between border-b pb-4"><h2 id={titleId} className="text-lg font-bold text-slate-900">{editId ? 'Edit Purchase Requisition' : 'New Purchase Requisition'}</h2><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close requisition form" onClick={dismiss}><i className="fa-solid fa-xmark"/></button></header>
      {!permitted ? <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">You cannot modify this requisition. Cloud approval records must be changed through an authorized server-side workflow.</p> : <form className="space-y-4" onSubmit={event => void submit(event)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">Procurement priority
            <select value={priority} onChange={e => setPriority(e.target.value as ProcurementPriority)} className={`${fieldClass} mt-1`} required>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Acquisition category
            <select value={purchaseCategory} onChange={e => setPurchaseCategory(e.target.value as PurchaseCategory)} className={`${fieldClass} mt-1`} required>
              {PURCHASE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-500">{PRIORITIES.find(p => p.value === priority)?.detail} Priority is operational; it does not replace budget approval or the separate financial ABC inventory analysis.</p>
        <label className="block text-sm font-semibold text-slate-700">Purchasing frequency
          <select className={`${fieldClass} mt-1`} value={recurrence} onChange={e => setRecurrence(e.target.value as ProcurementRecurrence)}>
            {RECURRENCES.map(r => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">Item title / description<input className={`${fieldClass} mt-1`} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required placeholder="e.g. PCB modules, software license, maintenance service, office chairs"/></label>
        <label className="block text-sm font-semibold text-slate-700">Specifications & requirements<textarea className={`${fieldClass} mt-1`} rows={3} value={specs} onChange={e => setSpecs(e.target.value)} required placeholder="Technical specifications, service scope, deliverables, acceptance criteria or service-level terms"/></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">Quantity ({displayUnit(unitOfMeasure)})
            <input className={`${fieldClass} mt-1`} type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} required/>
          </label>
          <SearchableMeasurementUnit
            value={unitOfMeasure}
            onChange={setUnitOfMeasure}
            inputClassName={fieldClass}
          />
          <label className="block text-sm font-semibold text-slate-700">Est. price (₱ per {displayUnit(unitOfMeasure)})
            <input className={`${fieldClass} mt-1`} type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required/>
          </label>
          <label className="block text-sm font-semibold text-slate-700">Target needed
            <input className={`${fieldClass} mt-1`} type="date" value={date} onChange={e => setDate(e.target.value)} required/>
          </label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">Remarks / justification<textarea className={`${fieldClass} mt-1`} rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Purpose for the request"/></label>
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Quantity: <strong>{formatQuantity(quantity, unitOfMeasure)}</strong><span className="mx-2">·</span>Estimated total: <strong className="text-slate-900">{peso(Number(quantity) * Number(price))}</strong></div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <footer className="flex flex-wrap justify-end gap-2 border-t pt-4"><button className={secondaryButton} type="button" disabled={busy} onClick={dismiss}>Cancel</button><button type="submit" disabled={busy} className={mainButton}>{busy ? 'Saving…' : editId ? 'Save changes' : 'Submit Requisition'}</button></footer>
      </form>}
    </section>
  </div>;
}
