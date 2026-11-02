import { formatQuantity } from '../domain/measurementUnits';
import { Fragment, useState } from 'react';
import { useCurrentUser, useOrders } from '../hooks/useProcurementData';
import { navigateTo } from '../core/renderBridge';
import { canAccessTab, hasPermission } from '../domain/permissions';
import { getRemainingOrderQuantity } from '../domain/procurement';
import { acceptPurchaseOrder, openRecordDeliveryModal } from '../actions/orderActions';
import { EmptyState } from '../components/FeedbackState';
import { ScreenPanel, StatusPill, fieldClass, peso, mainButton, secondaryButton } from '../components/CoreScreenUI';
import type { OrderRecord } from '../types/procurement';
import './orders-responsive.css';

type OrderActionsProps = {
  order: OrderRecord;
  isOpen: boolean;
  onToggle: () => void;
  supplier: boolean;
  canDeliver: boolean;
  remaining: number;
};

/** Keep all order actions and their existing permission checks in one place. */
function OrderActions({ order, isOpen, onToggle, supplier, canDeliver, remaining }: OrderActionsProps) {
  const accepted = ['Approved & Signed', 'Issued'].includes(order.status);

  return <div className="pf-order-actions">
    <button type="button" className={secondaryButton} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} details for ${order.id}`} onClick={onToggle}>
      {isOpen ? 'Hide Details' : 'Details'}
    </button>
    {supplier && order.status === 'Awaiting Supplier Signature' &&
      <button type="button" className={mainButton} onClick={() => void acceptPurchaseOrder(order.id)}>Review & Sign {order.type === 'Job Order' ? 'Job Order' : 'PO'}</button>}
    {!supplier && canDeliver && accepted && remaining > 0 &&
      <button type="button" className={mainButton} onClick={() => openRecordDeliveryModal(order.id)}>{['Goods & Materials','Equipment & Capital Assets'].includes(order.purchaseCategory || 'Goods & Materials') ? 'Log Delivery' : 'Record Completion'}</button>}
    {!supplier && canDeliver && accepted && remaining === 0 &&
      <span className="pf-order-hint text-emerald-700">{['Goods & Materials','Equipment & Capital Assets'].includes(order.purchaseCategory || 'Goods & Materials') ? 'Quantity received' : 'Service completion recorded'}</span>}
    {!supplier && canDeliver && !accepted &&
      <span className="pf-order-hint text-amber-700">Awaiting supplier signature</span>}
  </div>;
}

function OrderDetails({ order, remaining }: { order: OrderRecord; remaining: number }) {
  const details = [
    ['Order type', order.type || 'Purchase Order'],
    ['Priority', order.priority ? `Type ${order.priority}` : 'Not classified'],
    ['Acquisition category', order.purchaseCategory || 'Goods & Materials (legacy)'],
    ['Frequency', order.recurrence || '—'],
    ['Linked PR', order.prId || '—'],
    ['Expected delivery', order.expectedDate || '—'],
    ['Quantity outstanding', formatQuantity(remaining, order.unit)],
    ['Supplier', order.supplierName || '—'],
    ['Specifications', order.specs || '—'],
    ['Signed by', order.signedBy || 'Awaiting signature'],
  ];

  return <div className="pf-order-details">
    <h4 className="mb-3 text-sm font-bold text-slate-900">Order details · {order.id}</h4>
    <dl className="grid grid-cols-1 gap-3 text-sm min-[380px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
      {details.map(([label, value]) => <div className="min-w-0" key={label}>
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="mt-1 break-words font-medium text-slate-800">{value}</dd>
      </div>)}
    </dl>
    <div className="mt-4 flex flex-wrap gap-2">
      {order.prId && canAccessTab('requisitions') &&
        <button type="button" className={secondaryButton} onClick={() => navigateTo('requisitions')}>Open requisitions</button>}
      {canAccessTab('delivery') &&
        <button type="button" className={secondaryButton} onClick={() => navigateTo('delivery')}>View deliveries</button>}
      {order.bidId && canAccessTab('bid_comparison') &&
        <button type="button" className={secondaryButton} onClick={() => navigateTo('bid_comparison')}>Winning bid: {order.bidId}</button>}
    </div>
  </div>;
}

export default function OrdersPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const supplier = useCurrentUser()?.role === 'Supplier';
  const all = useOrders();
  const canDeliver = hasPermission('record_delivery');
  const statuses = [...new Set(all.map(order => String(order.status)))].sort();
  const q = query.trim().toLowerCase();
  const orders = all.filter(order =>
    (status === 'All' || order.status === status) &&
    (!q || [order.id, order.prId, order.supplierName, order.department, order.itemTitle, order.status]
      .some(value => String(value || '').toLowerCase().includes(q)))
  );

  return <div className="min-w-0 space-y-4 pb-6">
    <header className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Purchase & Job Orders</h2>
      <p className="mt-1 text-sm text-slate-500">Review signed purchase orders, supplier acceptance, and delivery progress. {orders.length} of {all.length} orders shown.</p>
    </header>
    <div className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_210px]">
      <label className="min-w-0 text-sm font-semibold text-slate-700">Search orders
        <input type="search" className={`${fieldClass} mt-1`} value={query} onChange={e => setQuery(e.target.value)} placeholder="PO, supplier, PR, department…" />
      </label>
      <label className="min-w-0 text-sm font-semibold text-slate-700">Status
        <select value={status} className={`${fieldClass} mt-1`} onChange={e => setStatus(e.target.value)}>
          <option value="All">All statuses</option>
          {statuses.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
    </div>
    <ScreenPanel heading="Purchase Orders & Supplier Acceptance" description="Open an order to see its originating requisition and fulfillment details.">
      {!orders.length ? <EmptyState icon="fa-file-invoice-dollar" title={all.length ? 'No matching orders' : 'No purchase orders yet'} description={all.length ? 'Adjust your search or status filter.' : 'Purchase orders appear after a supplier is selected and the agreement finalized.'} />
        : <div className="pf-orders-layout">
          {/* Proper table cells align the heading with data at wide container widths. */}
          <div className="pf-orders-table-wrap" role="region" aria-label="Purchase orders table" tabIndex={0}>
            <table className="pf-orders-table w-full table-fixed border-collapse text-left text-sm">
              <colgroup><col style={{ width: '15%' }} /><col style={{ width: '8%' }} /><col style={{ width: '13%' }} /><col style={{ width: '12%' }} /><col style={{ width: '18%' }} /><col style={{ width: '12%' }} /><col style={{ width: '10%' }} /><col style={{ width: '12%' }} /></colgroup>
              <thead><tr>
                {['PO Number', 'PR Ref', 'Supplier', 'Department', 'Item & Quantity', 'Total Amount', 'PO Date', 'Actions'].map(heading => <th scope="col" key={heading}>{heading}</th>)}
              </tr></thead>
              <tbody>
                {orders.map(order => {
                  const remaining = getRemainingOrderQuantity(order.id);
                  const isOpen = expanded === order.id;
                  const actions = { order, isOpen, onToggle: () => setExpanded(isOpen ? null : order.id), supplier, canDeliver, remaining };
                  return <Fragment key={order.id}>
                    <tr className="pf-orders-data-row">
                      <td><strong className="font-bold text-[#a64f32]">{order.id}</strong><div className="mt-1.5"><StatusPill status={order.status} /></div></td>
                      <td className="font-semibold text-slate-600">{order.prId || '—'}</td>
                      <td className="font-medium text-slate-900">{order.supplierName || '—'}</td>
                      <td>{order.department || '—'}</td>
                      <td><strong className="break-words font-semibold text-slate-900">{order.itemTitle}</strong><p className="mt-1 text-xs text-slate-500">Qty: {formatQuantity(order.quantity, order.unit)}</p></td>
                      <td className="font-bold text-slate-900"><span className="whitespace-nowrap">{peso(order.totalCost)}</span></td>
                      <td><span className="whitespace-nowrap">{order.poDate || '—'}</span></td>
                      <td><OrderActions {...actions} /></td>
                    </tr>
                    {isOpen && <tr className="pf-orders-details-row"><td colSpan={8}><OrderDetails order={order} remaining={remaining} /></td></tr>}
                  </Fragment>;
                })}
              </tbody>
            </table>
          </div>
          {/* Compact order cards instead of an overflowing eight-column table. */}
          <div className="pf-orders-cards">
            {orders.map(order => {
              const remaining = getRemainingOrderQuantity(order.id);
              const isOpen = expanded === order.id;
              const actions = { order, isOpen, onToggle: () => setExpanded(isOpen ? null : order.id), supplier, canDeliver, remaining };
              return <article key={order.id} className="pf-order-card">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><div className="text-base font-bold text-[#a64f32]">{order.id}</div><div className="mt-1.5"><StatusPill status={order.status} /></div></div>
                  <div className="text-right"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total amount</p><p className="mt-1 whitespace-nowrap text-base font-bold text-slate-900">{peso(order.totalCost)}</p></div>
                </div>
                <div className="mt-3 min-w-0 border-t border-slate-100 pt-3">
                  <p className="break-words font-semibold text-slate-900">{order.itemTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">Quantity: {formatQuantity(order.quantity, order.unit)}</p>
                </div>
                <dl className="pf-order-card-meta">
                  <div><dt>Supplier</dt><dd>{order.supplierName || '—'}</dd></div>
                  <div><dt>Department</dt><dd>{order.department || '—'}</dd></div>
                  <div><dt>PR reference</dt><dd>{order.prId || '—'}</dd></div>
                  <div><dt>PO date</dt><dd>{order.poDate || '—'}</dd></div>
                </dl>
                <div className="mt-3 border-t border-slate-100 pt-3"><OrderActions {...actions} /></div>
                {isOpen && <div className="mt-3"><OrderDetails order={order} remaining={remaining} /></div>}
              </article>;
            })}
          </div>
        </div>}
    </ScreenPanel>
  </div>;
}
