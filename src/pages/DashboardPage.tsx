import { formatQuantity } from '../domain/measurementUnits';
import { useCurrentUser, useOrders, useRequisitions } from '../hooks/useProcurementData';
import { DB, ui } from '../store/state';
import { renderApp, navigateTo } from '../core/renderBridge';
import { canAccessTab, hasPermission } from '../domain/permissions';
import { getSupplierRatingStats } from '../domain/procurement';
import { EmptyState } from '../components/FeedbackState';
import { MetricCard, ScreenPanel, StatusPill, mainButton, peso, secondaryButton } from '../components/CoreScreenUI';

function startNewPR() { ui.currentModal = 'create_pr'; renderApp(); }
function Go({ tab, children }: { tab: string; children: React.ReactNode }) {
  return canAccessTab(tab) ? <button type="button" className={secondaryButton} onClick={() => navigateTo(tab)}>{children}</button> : null;
}

/** Role-specific dashboard built with React nodes; no injected HTML or DOM listeners. */
export default function DashboardPage() {
  const user = useCurrentUser();
  const accessibleOrders = useOrders();
  const accessiblePRs = useRequisitions();
  if (!user) return null;
  const supplier = user.role === 'Supplier';
  const employee = user.role === 'Employee';
  const myOrders = supplier ? accessibleOrders : [];
  const supplierRecord = supplier ? DB.suppliers.find(s => s.id === user.supplierId) : null;
  const supplierName = supplierRecord?.name || user.companyName || 'External Supplier';
  const myPRs = employee ? accessiblePRs : DB.requisitions;
  const recent = [...myPRs].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 5);
  const rating = supplier ? getSupplierRatingStats(user.supplierId) : null;
  const pendingMeetings = supplier ? DB.proposalMeetings.filter(m => m.supplierId === user.supplierId && m.status === 'Pending Response').length : 0;

  const metrics = supplier ? [
    { label: 'Active Orders', value: myOrders.length, icon: 'fa-file-invoice-dollar', tab: 'orders' },
    { label: 'Completed Shipments', value: DB.deliveries.filter(d => myOrders.some(o => o.id === d.poId) && d.complianceStatus === 'Completed - Verified').length, icon: 'fa-circle-check', tab: 'delivery' },
    { label: 'Disbursements Received', value: peso(DB.payments.filter(p => myOrders.some(o => o.id === p.poId) && p.status === 'Paid').reduce((sum, p) => sum + Number(p.paymentAmount || 0), 0)), icon: 'fa-sack-dollar', tab: 'payments' }
  ] : employee ? [
    { label: 'My Requests', value: myPRs.length, icon: 'fa-file-signature', tab: 'requisitions' },
    { label: 'Pending Review', value: myPRs.filter(r => r.status === 'Pending').length, icon: 'fa-clock', tab: 'requisitions' },
    { label: 'Approved', value: myPRs.filter(r => r.status === 'Approved').length, icon: 'fa-circle-check', tab: 'requisitions' },
    { label: 'In Process', value: myPRs.filter(r => r.status === 'In Process').length, icon: 'fa-truck-fast', tab: 'tracking' },
    { label: 'Completed', value: myPRs.filter(r => r.status === 'Completed').length, icon: 'fa-check-double', tab: 'tracking' },
    { label: 'Rejected', value: myPRs.filter(r => r.status === 'Rejected').length, icon: 'fa-circle-xmark', tab: 'requisitions' }
  ] : [
    { label: 'Total PRs', value: DB.requisitions.length, icon: 'fa-file-signature', tab: 'requisitions' },
    { label: 'Pending PR Approvals', value: DB.requisitions.filter(r => r.status === 'Pending').length, icon: 'fa-clock', tab: 'approvals' },
    { label: 'Orders in Process', value: DB.orders.filter(o => o.status === 'Issued').length, icon: 'fa-truck-fast', tab: 'orders' },
    { label: 'Upcoming Deliveries', value: DB.deliveries.filter(d => ['Pending', 'Partial'].includes(d.deliveryStatus)).length, icon: 'fa-box-open', tab: 'delivery' },
    { label: 'Verified Completed', value: DB.deliveries.filter(d => d.complianceStatus === 'Completed - Verified').length, icon: 'fa-circle-check', tab: 'delivery' },
    { label: 'Delivery Issues', value: DB.deliveries.filter(d => /Issue|Non-Compliant/.test(d.complianceStatus || '')).length, icon: 'fa-triangle-exclamation', tab: 'delivery_discrepancies' },
    { label: 'Pending Amendments', value: DB.amendments.filter(a => ['Pending Supplier Response', 'Supplier Responded'].includes(a.approvalStatus)).length, icon: 'fa-pen-to-square', tab: 'amendments' },
    { label: 'Payments Awaiting', value: DB.payments.filter(p => ['Pending', 'Processing'].includes(p.status)).length, icon: 'fa-hourglass-half', tab: 'payments' },
    { label: 'Payments On Hold', value: DB.payments.filter(p => p.status === 'On Hold').length, icon: 'fa-hand', tab: 'payments' },
    { label: 'Completed Payments', value: peso(DB.payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + Number(p.paymentAmount || 0), 0)), icon: 'fa-sack-dollar', tab: 'payments' }
  ];
  return <div className="enterprise-dashboard space-y-5 pb-6">
    <section className="dashboard-hero flex flex-col justify-between gap-5 rounded-2xl bg-[#222d28] p-5 text-white shadow-lg sm:flex-row sm:items-center sm:p-7">
      <div className="min-w-0">
        {supplier && <span className="inline-block rounded-full border border-white/20 px-3 py-1 text-xs font-bold text-white/90">Supplier Portal</span>}
        <h2 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{supplier ? supplierName : employee ? 'My Purchase Requests' : 'System Status Overview'}</h2>
        <p className="mt-1 text-sm text-white/80">{supplier ? 'Track your vendor orders, deliveries, and proposal meetings.' : employee ? 'Monitor the requests you submitted and their procurement progress.' : 'Enterprise procurement metrics and lifecycle monitor.'}</p>
      </div>
      {supplier ? <div className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-5 py-3 sm:text-right"><div className="text-xs text-white/80">Vendor rating</div><div className="text-2xl font-bold">{rating?.avg ? `★ ${rating.avg}` : 'N/A'}</div><div className="text-xs text-white/80">{rating?.count || 0} evaluations</div></div>
        : hasPermission('create_pr') && <button type="button" className={mainButton} onClick={startNewPR}><i className="fa-solid fa-plus" aria-hidden="true"/>New Requisition</button>}
    </section>

    {pendingMeetings > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><div><h3 className="font-bold text-amber-900">{pendingMeetings} pending proposal meeting invite{pendingMeetings > 1 ? 's' : ''}</h3><p className="text-xs text-amber-700">Review and respond to your invitations.</p></div><Go tab="proposal_meetings">Review invites</Go></div>}

    <div className={`grid gap-3 sm:grid-cols-2 ${supplier ? 'lg:grid-cols-3' : employee ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-3 xl:grid-cols-5'}`}>
      {metrics.map(metric => <MetricCard key={metric.label} label={metric.label} value={metric.value} icon={metric.icon} action={canAccessTab(metric.tab) ? () => navigateTo(metric.tab) : undefined}/>)}
    </div>

    {supplier ? <ScreenPanel heading="Recent Purchase Orders" description="Your organization's orders only" action={<Go tab="orders">View all orders</Go>}>
      {myOrders.length === 0 ? <EmptyState title="No purchase orders yet" description="Orders assigned to your supplier account will appear here."/> : <div className="divide-y divide-slate-100">{myOrders.slice(0, 5).map(order => <div className="flex flex-wrap items-center justify-between gap-2 p-4" key={order.id}><div><div className="font-semibold text-slate-900">{order.id} · {order.itemTitle}</div><p className="text-xs text-slate-500">{peso(order.totalCost)} · {order.poDate || 'Date pending'}</p></div><StatusPill status={order.status}/></div>)}</div>}
    </ScreenPanel> : <ScreenPanel heading={employee ? 'My Recent Requests' : 'Recent Requisitions'} description="Follow each request from submission through fulfillment" action={<Go tab="requisitions">View requisitions</Go>}>
      {recent.length === 0 ? <EmptyState title="No recent requests" description={hasPermission('create_pr') ? 'Select New Requisition to submit a purchase request.' : 'New requisitions will appear when they are submitted.'}/> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{['Reference', 'Item', 'Quantity', 'Needed by', 'Est. Cost', 'Status'].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{recent.map(pr => <tr key={pr.id} className="hover:bg-slate-50"><td className="p-3 font-bold text-[#a64f32]">{pr.id}</td><td className="p-3 font-medium">{pr.itemTitle}</td><td className="p-3 whitespace-nowrap">{formatQuantity(pr.quantity, pr.unit)}</td><td className="p-3">{pr.targetDate || '—'}</td><td className="p-3 font-semibold">{peso(pr.totalCost)}</td><td className="p-3"><StatusPill status={pr.status}/></td></tr>)}</tbody></table></div>}
    </ScreenPanel>}
    {canAccessTab('audit') && <ScreenPanel heading="Recent Activity" description="Latest recorded actions in the procurement workspace" action={<Go tab="audit">Full activity log</Go>}>
      {DB.auditLogs.length ? <div className="divide-y divide-slate-100">{[...DB.auditLogs].sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || ''))).slice(0, 5).map(log => <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3" key={log.id}><div className="min-w-0"><strong className="text-sm text-slate-900">{log.action || 'System event'}</strong><p className="max-w-3xl break-words text-xs text-slate-500">{log.details || '—'}</p></div><time className="text-xs text-slate-500">{log.timestamp || '—'}</time></div>)}</div> : <EmptyState title="No recent activity" description="Recorded procurement actions will appear here."/>}
    </ScreenPanel>}
    <div className="flex flex-wrap gap-2"><Go tab="requisitions">Purchase Requisitions</Go><Go tab="approvals">Approval Workflow</Go><Go tab="orders">Purchase Orders</Go><Go tab="invoice_matching">Invoice Matching</Go><Go tab="tracking">Procurement Tracking</Go></div>
  </div>;
}
