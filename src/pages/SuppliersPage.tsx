import { useState } from 'react';
import { DB } from '../store/state';
import { useSuppliers } from '../hooks/useProcurementData';
import { hasPermission } from '../domain/permissions';
import { getSupplierRatingStats, isOrderFullyVerified } from '../domain/procurement';
import { openAddSupplierModal, openRateSupplierModal, viewSupplierRatingsModal } from '../actions/orderActions';
import { EmptyState } from '../components/FeedbackState';
import { ScreenPanel, mainButton, secondaryButton, fieldClass } from '../components/CoreScreenUI';

/** React directory: supplier data is escaped by React instead of injected into HTML. */
export default function SuppliersPage() {
  const suppliers = useSuppliers();
  const [query, setQuery] = useState('');
  const canManage = hasPermission('manage_suppliers');
  const canRate = hasPermission('rate_supplier');
  const filtered = suppliers.filter(supplier =>
    [supplier.name, supplier.category, supplier.contact, supplier.email]
      .some(value => String(value || '').toLowerCase().includes(query.trim().toLowerCase())));

  return <div className="space-y-4 pb-6">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div><h2 className="text-lg font-bold text-slate-900">Approved Vendor Directory & Performance Ratings</h2><p className="mt-1 text-sm text-slate-500">Evaluated vendor profiles, quality compliance, and supplier reviews</p></div>
      {canManage && <button className={mainButton} type="button" onClick={openAddSupplierModal}><i className="fa-solid fa-plus" aria-hidden="true"/> Add New Supplier</button>}
    </header>
    <ScreenPanel heading="Suppliers" description={`${filtered.length} of ${suppliers.length} suppliers displayed`} action={<label className="text-xs font-semibold text-slate-700">Find supplier<input className={`${fieldClass} mt-1`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, category, contact…"/></label>}>
      {!filtered.length ? <EmptyState icon="fa-building" title={suppliers.length ? 'No suppliers match the search' : 'No suppliers listed yet'} description={suppliers.length ? 'Try a different name or category.' : 'Verified and managed suppliers will appear here.'}/> :
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(supplier => {
        const stats = getSupplierRatingStats(supplier.id);
        const latestReview = DB.ratings.find(rating => rating.supplierId === supplier.id);
        const paidOrders = canRate ? DB.payments.filter(payment =>
          payment.status === 'Paid' &&
          DB.orders.some(order => order.id === payment.poId && order.supplierId === supplier.id) &&
          isOrderFullyVerified(payment.poId) &&
          !DB.ratings.some(rating => rating.poId === payment.poId)) : [];
        return <article key={supplier.id} className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f8eee9] text-[#a64f32]" aria-hidden="true"><i className="fa-solid fa-building"/></span><div className="text-right"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{supplier.category || 'Supplier'}</span><p className="mt-2 text-sm font-bold text-amber-700" aria-label={`${stats.avg} out of 5 stars`}>★ {stats.avg.toFixed(1)} <span className="font-normal text-slate-500">({stats.count} reviews)</span></p></div></div>
            <h3 className="mt-3 break-words text-base font-bold text-slate-900">{supplier.name}</h3>
            <div className="mt-2 space-y-1 text-sm text-slate-600"><p className="break-words"><i className="fa-solid fa-user mr-2 text-slate-400" aria-hidden="true"/>{supplier.contact || 'No contact specified'}</p><p className="break-all"><i className="fa-solid fa-envelope mr-2 text-slate-400" aria-hidden="true"/>{supplier.email || 'No email specified'}</p><p><i className="fa-solid fa-phone mr-2 text-slate-400" aria-hidden="true"/>{supplier.phone || 'No phone specified'}</p></div>
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">{latestReview ? <><div className="flex justify-between gap-2 font-semibold"><span>{latestReview.evaluatorName || 'Evaluator'}</span><span>★ {latestReview.rating}/5</span></div><p className="mt-1 break-words">{latestReview.feedback || 'No comments'}</p></> : <p className="text-center italic text-slate-400">No ratings recorded yet.</p>}</div>
          </div>
          <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3"><button type="button" className={secondaryButton} onClick={() => viewSupplierRatingsModal(supplier.id)}><i className="fa-solid fa-comments" aria-hidden="true"/> {stats.count} Reviews</button>{canRate && <div className="flex flex-wrap gap-1.5">{paidOrders.length ? paidOrders.map(payment => <button type="button" key={payment.id} className={mainButton} onClick={() => openRateSupplierModal(supplier.id, payment.poId)}>Rate {payment.poId}</button>) : <span className="text-xs text-slate-500">Rate after completed, paid orders</span>}</div>}</footer>
        </article>;
      })}</div>}
    </ScreenPanel>
  </div>;
}
