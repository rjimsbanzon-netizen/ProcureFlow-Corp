import { formatQuantity } from '../domain/measurementUnits';
import { ownsRequisition } from '../domain/ownerIdentity';
import { useCurrentUser, useRequisitions } from '../hooks/useProcurementData';
import { useState } from 'react';
import { ui } from '../store/state';
import { renderApp, navigateTo, openTracking } from '../core/renderBridge';
import { canManageBidding, hasPermission } from '../domain/permissions';
import { getAvailableRequisitions } from '../domain/procurement';
import { approvePR, rejectPR } from '../actions/requisitionActions';
import { openCreateStockNeedModal } from '../actions/biddingActions';
import { CLOUD_API_BASE } from '../services/cloud';
import { EmptyState } from '../components/FeedbackState';
import { priorityClass, priorityLabel, PURCHASE_CATEGORIES, PRIORITIES } from '../domain/procurementClassification';
import { ScreenPanel, StatusPill, fieldClass, mainButton, peso, secondaryButton } from '../components/CoreScreenUI';

/** Real React list/search/actions, not an HTML string injected into the page. */
export default function RequisitionsPage() {
  const [query, setQuery] = useState(ui.searchQuery || '');
  const [status, setStatus] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const user = useCurrentUser();
  const all = useRequisitions();
  const details = all.find(r => r.id === detailsId);
  const available = new Set(getAvailableRequisitions().map(pr => pr.id));
  const search = query.trim().toLowerCase();
  const reqs = all.filter(r => (status === 'All' || r.status === status) && (priorityFilter === 'All' || (priorityFilter === 'Unclassified' ? !r.priority : r.priority === priorityFilter)) && (categoryFilter === 'All' || r.purchaseCategory === categoryFilter) &&
    (!search || [r.id, r.department, r.itemTitle, r.specs, r.status, r.requestedBy].some(value => String(value || '').toLowerCase().includes(search))));
  const statuses = [...new Set(all.map(r => String(r.status)))].sort();
  const openCreate = () => { ui.currentModal = 'create_pr'; renderApp(); };
  const canEditLocal = (r: typeof all[number]) => !CLOUD_API_BASE && r.status === 'Pending' &&
    ownsRequisition(r,user);
  const edit = (id: string) => { ui.selectedRecord = id; ui.currentModal = 'edit_pr'; renderApp(); };
  return <div className="space-y-4 pb-6">
    <div className="flex flex-col flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <div><h2 className="text-lg font-bold text-slate-900">Purchase Requisitions</h2><p className="text-xs text-slate-500">{reqs.length} of {all.length} requests shown</p></div>
      {hasPermission('create_pr') && <button type="button" className={mainButton} onClick={openCreate}><i aria-hidden="true" className="fa-solid fa-plus"/>Create Purchase Requisition</button>}
    </div>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_160px_200px]">
      <label className="min-w-0 text-sm font-semibold text-slate-700">Search requests<input type="search" className={`${fieldClass} mt-1`} value={query} onChange={event => { setQuery(event.target.value); ui.searchQuery = event.target.value; }} placeholder="PR number, item, department…"/></label>
      <label className="text-sm font-semibold text-slate-700">Priority<select className={`${fieldClass} mt-1`} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="All">All priorities</option>{PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}<option value="Unclassified">Not classified (legacy)</option></select></label>
      <label className="text-sm font-semibold text-slate-700">Category<select className={`${fieldClass} mt-1`} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="All">All categories</option>{PURCHASE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Status<select className={`${fieldClass} mt-1`} value={status} onChange={event => setStatus(event.target.value)}><option value="All">All statuses</option>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
    </div>
    <ScreenPanel heading="Requisition register" description="Track the request, review its approval status, or publish an approved procurement need.">
      {reqs.length === 0 ? <EmptyState icon="fa-file-signature" title={all.length ? 'No matching requisitions' : 'No purchase requisitions yet'} description={all.length ? 'Try another reference, department or status.' : 'Create a requisition to begin procurement.'} action={hasPermission('create_pr') && !all.length ? <button type="button" className={mainButton} onClick={openCreate}>Create requisition</button> : undefined}/>
        : <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr>{['PR Number', 'Department', 'Priority / Type', 'Item & Specifications', 'Target Needed', 'Estimated Cost', 'Status', 'Actions'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{reqs.map(r => <tr key={r.id} className="hover:bg-slate-50/80"><td className="p-3 font-bold text-[#a64f32]">{r.id}</td><td className="p-3"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold">{r.department}</span></td>
            <td className="p-3"><span className={`inline-block whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ${priorityClass(r.priority)}`}>{priorityLabel(r.priority)}</span><p className="mt-1 text-xs text-slate-500">{r.purchaseCategory || 'Legacy · unspecified'}</p><p className="mt-1 text-xs text-slate-500">{r.recurrence || '—'}</p></td><td className="max-w-[320px] p-3"><strong className="text-slate-900">{r.itemTitle}</strong><p className="mt-1 truncate text-xs text-slate-500" title={String(r.specs || '')}>{r.specs}</p><div className="mt-1 text-xs text-slate-400">Qty: {formatQuantity(r.quantity, r.unit)} · Unit price: {peso(r.unitPrice)}</div></td><td className="whitespace-nowrap p-3">{r.targetDate || '—'}</td><td className="whitespace-nowrap p-3 font-semibold">{peso(r.totalCost)}</td><td className="p-3"><StatusPill status={r.status}/></td>
            <td className="p-3"><div className="flex flex-wrap gap-1.5">
              {r.status === 'Pending' && (CLOUD_API_BASE ? <button type="button" className={secondaryButton} onClick={() => navigateTo('approvals')}>View Approvals</button> : hasPermission('approve_pr') && <><button type="button" className={secondaryButton} onClick={() => approvePR(r.id)}>Approve</button><button type="button" className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700" onClick={() => rejectPR(r.id)}>Reject</button></>)}
              {r.status === 'Approved' && canManageBidding() && available.has(r.id) && <button type="button" className={mainButton} onClick={() => openCreateStockNeedModal(r.id)}>Publish Need</button>}
              {canEditLocal(r) && <button type="button" className={secondaryButton} onClick={() => edit(r.id)}>Edit</button>}
              <button type="button" className={secondaryButton} onClick={() => openTracking(r.id)}><i className="fa-solid fa-route" aria-hidden="true"/> Track</button>
              <button type="button" className={secondaryButton} title="View requisition details" aria-label={`View ${r.id} details`} onClick={() => setDetailsId(r.id)}><i className="fa-solid fa-eye" aria-hidden="true"/> Details</button>
            </div></td></tr>)}</tbody></table></div>}
    </ScreenPanel>
    {details && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setDetailsId(null); }}><section role="dialog" aria-modal="true" aria-label={`Requisition ${details.id} details`} className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><header className="mb-4 flex items-start justify-between gap-3 border-b pb-3"><div><p className="text-xs font-bold uppercase text-[#a64f32]">Purchase Requisition · {details.id}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{details.itemTitle}</h3></div><button type="button" className={secondaryButton} onClick={() => setDetailsId(null)} aria-label="Close requisition details"><i className="fa-solid fa-xmark"/></button></header><div className="grid gap-3 text-sm sm:grid-cols-2">{[['Department',details.department],['Procurement priority',priorityLabel(details.priority)],['Category',details.purchaseCategory || 'Not specified (legacy)'],['Frequency',details.recurrence || 'Not specified'],['Requested by',details.requestedBy || '—'],['Quantity',formatQuantity(details.quantity, details.unit)],['Unit price',peso(details.unitPrice)],['Estimated total',peso(details.totalCost)],['Needed by',details.targetDate || '—'],['Created',details.createdAt || '—']].map(([label, value]) => <div key={label}><div className="text-xs font-semibold text-slate-500">{label}</div><div className="mt-1 break-words font-medium text-slate-900">{value}</div></div>)}<div className="sm:col-span-2"><div className="text-xs font-semibold text-slate-500">Specifications & requirements</div><p className="mt-1 whitespace-pre-wrap break-words">{details.specs}</p></div><div className="sm:col-span-2"><div className="text-xs font-semibold text-slate-500">Justification</div><p className="mt-1 whitespace-pre-wrap break-words">{details.remarks || '—'}</p></div><div className="sm:col-span-2"><StatusPill status={details.status}/></div></div><footer className="mt-5 flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" className={secondaryButton} onClick={() => { setDetailsId(null); openTracking(details.id); }}>Track</button><button type="button" className={mainButton} onClick={() => setDetailsId(null)}>Close</button></footer></section></div>}
    {CLOUD_API_BASE && <p className="text-xs text-slate-500">Submitted requisitions are protected by the multi-step cloud approval process. Editing an active cloud requisition is disabled until a secured change-request workflow is available.</p>}
  </div>;
}
