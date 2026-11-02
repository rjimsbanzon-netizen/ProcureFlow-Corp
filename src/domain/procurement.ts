// @ts-nocheck
import { DB } from '../store/state';
import { ownsRequisition } from './ownerIdentity';

// Migrated from enterprise.html. Business rules / markup preserved.
export function getAvailableRequisitions() {
    return DB.requisitions.filter(pr =>
        pr.status === 'Approved' &&
        !DB.stockNeeds.some(need => need.prId === pr.id) &&
        !DB.orders.some(order => order.prId === pr.id)
    );
}


export function isOrderFullyVerified(poId) {
    const order = DB.orders.find(item => item.id === poId);
    const deliveries = DB.deliveries.filter(item => item.poId === poId);
    return Boolean(order && deliveries.length > 0) &&
        deliveries.every(item => item.complianceStatus === 'Completed - Verified') &&
        deliveries.reduce((total, item) => total + Number(item.deliveredQty || 0), 0) >= order.quantity;
}


export function syncRequisitionStatuses(state = DB) {
    let changed = false;
    state.requisitions.forEach(requisition => {
        if (['Pending', 'Rejected'].includes(requisition.status)) return;
        const order = state.orders.find(item => item.prId === requisition.id);
        if (!order) return;

        const deliveries = state.deliveries.filter(item => item.poId === order.id);
        const fullyVerified = deliveries.length > 0 &&
            deliveries.every(item => item.complianceStatus === 'Completed - Verified') &&
            deliveries.reduce((total, item) => total + Number(item.deliveredQty || 0), 0) >= order.quantity;
        const payment = state.payments.find(item => item.poId === order.id);
        const status = fullyVerified && payment?.status === 'Paid' ? 'Completed' : 'In Process';
        if (requisition.status !== status) {
            requisition.status = status;
            changed = true;
        }
    });
    return changed;
}


export function getRemainingOrderQuantity(poId) {
    const order = DB.orders.find(item => item.id === poId);
    if (!order) return 0;
    const delivered = DB.deliveries
        .filter(item => item.poId === poId)
        .reduce((total, item) => total + Number(item.deliveredQty || 0), 0);
    return Math.max(0, order.quantity - delivered);
}


export function getSupplierRatingStats(supplierId) {
    const supplierRatings = DB.ratings.filter(r => r.supplierId === supplierId);
    if (supplierRatings.length === 0) return { avg: 0, count: 0 };

    const sum = supplierRatings.reduce((acc, curr) => acc + curr.rating, 0);
    const avg = (sum / supplierRatings.length).toFixed(1);
    return { avg: parseFloat(avg), count: supplierRatings.length };
}


export function getCurrentUserRequisitions() {
    return DB.requisitions.filter(request => ownsRequisition(request, DB.currentUser));
}
