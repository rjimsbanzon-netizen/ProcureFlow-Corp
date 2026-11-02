import { formatQuantityRatio } from '../domain/measurementUnits';
import { DB } from '../store/state';
import { useDeliveries } from '../hooks/useProcurementData';
import { hasPermission, canManageDeliveryIssues } from '../domain/permissions';
import { openInitiateAmendmentModal, openInspectDeliveryModal } from '../actions/orderActions';
import { EmptyState } from '../components/FeedbackState';
import { ScreenPanel, StatusPill, secondaryButton } from '../components/CoreScreenUI';

/** Native React delivery register; existing inspection and amendment actions stay intact. */
export default function DeliveryPage() {
  const deliveries = useDeliveries();
  const canInspect = hasPermission('record_delivery');
  const canAmend = canManageDeliveryIssues();
  return <div className="pb-6">
    <ScreenPanel heading="Delivery Receipts & Inspection Progress" description="Log incoming shipments, perform specification inspections, and verify orders">
      {deliveries.length === 0 ? <EmptyState icon="fa-truck-ramp-box" title="No deliveries recorded" description="Verified shipments and delivery inspections will appear here."/> :
        <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm text-slate-700"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase"><tr>{['PO Ref','Supplier & Dept','Item & Specifications','Qty (Ord/Del)','Delivery Dates','Inspection Status','Actions'].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{deliveries.map(delivery => {
            const flagged = /Issue|Non-Compliant/i.test(delivery.complianceStatus || '');
            const amendmentOpen = DB.amendments.some(a => a.delId === delivery.id && ['Pending Supplier Response', 'Supplier Responded'].includes(a.approvalStatus));
            const alreadyPaid = DB.payments.some(payment => payment.poId === delivery.poId && payment.status === 'Paid');
            return <tr key={delivery.id} className="hover:bg-slate-50/70"><td className="whitespace-nowrap p-3 font-bold text-[#a64f32]">{delivery.poId}</td><td className="p-3"><strong>{delivery.supplierName}</strong><p className="text-xs text-slate-500">{delivery.department}</p></td><td className="max-w-[250px] p-3"><strong>{delivery.itemTitle}</strong><p title={delivery.specs || ''} className="mt-1 truncate text-xs text-slate-500">{delivery.specs || '—'}</p></td><td className="whitespace-nowrap p-3"><span className={delivery.deliveredQty < delivery.orderedQty ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>{formatQuantityRatio(delivery.deliveredQty, delivery.orderedQty, delivery.unit || DB.orders.find(order=>order.id===delivery.poId)?.unit)}</span></td><td className="whitespace-nowrap p-3 text-xs"><p>Expected: {delivery.expectedDate || 'N/A'}</p><p className="mt-1 text-slate-500">Actual: {delivery.actualDate || 'Pending'}</p></td><td className="p-3"><StatusPill status={delivery.complianceStatus}/></td><td className="p-3"><div className="flex flex-wrap gap-2">{canInspect && <button type="button" className={secondaryButton} onClick={() => openInspectDeliveryModal(delivery.id)}><i className="fa-solid fa-clipboard-check" aria-hidden="true"/>Inspect</button>}{flagged && canAmend && !amendmentOpen && !alreadyPaid && <button type="button" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100" onClick={() => openInitiateAmendmentModal(delivery.poId, delivery.id)}>Amend</button>}</div></td></tr>;
          })}</tbody></table></div>}
    </ScreenPanel>
  </div>;
}
