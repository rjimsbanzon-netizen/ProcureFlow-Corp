// @ts-nocheck
import { renderApp } from '../core/renderBridge';
import { canApproveAmendments } from '../domain/permissions';
import { logAudit } from '../services/audit';
import { Storage } from '../services/storage';
import { showToast } from '../services/toast';
import { DB } from '../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function approveAmendment(id) {
    const amd = DB.amendments.find(a => a.id === id);
    const po = DB.orders.find(order => order.id === amd?.poId);
    const delivery = DB.deliveries.find(item => item.id === amd?.delId && item.poId === amd?.poId);
    if (!canApproveAmendments() || !amd || amd.approvalStatus !== 'Supplier Responded' ||
        !po || !delivery || !Number.isInteger(amd.revisedQty) || amd.revisedQty < 1) {
        showToast('The amendment cannot be approved until a supplier response is available.', 'error');
        return;
    }

    const unitPrice = Number.isFinite(po.unitPrice) ? po.unitPrice : po.totalCost / po.quantity;
    amd.approvalStatus = 'Approved Amendment';
    po.quantity = amd.revisedQty;
    po.specs = amd.revisedSpecs;
    po.unitPrice = unitPrice;
    po.totalCost = unitPrice * amd.revisedQty;
    delivery.orderedQty = po.quantity;
    delivery.specs = po.specs;
    delivery.complianceStatus = 'Pending Inspection';
    delivery.remarks += ' | Amendment approved; re-inspection required after corrective action.';
    const payment = DB.payments.find(item => item.poId === amd.poId);
    if (payment) {
        payment.totalAmount = po.totalCost;
        payment.paymentAmount = po.totalCost;
        payment.deliveryVerified = false;
        payment.status = 'Pending';
    }
    logAudit('Amendment Approved', `Order amendment ${id} approved for ${amd.poId}; delivery re-inspection required.`);
    Storage.save(DB);
    showToast(`Amendment ${id} approved. Re-inspect the resolved delivery before payment.`, 'success');
    renderApp();
}


export function rejectAmendment(id) {
    const amendment = DB.amendments.find(item => item.id === id);
    if (!canApproveAmendments() || !amendment || amendment.approvalStatus !== 'Supplier Responded') {
        showToast('Only a responded amendment can be rejected.', 'error');
        return;
    }
    amendment.approvalStatus = 'Rejected Amendment';
    logAudit('Amendment Rejected', `Order amendment ${id} rejected for ${amendment.poId}.`);
    Storage.save(DB);
    showToast(`Amendment ${id} rejected.`, 'warning');
    renderApp();
}


export function respondToAmendment(id, response) {
    const amendment = DB.amendments.find(item => item.id === id);
    const order = DB.orders.find(item => item.id === amendment?.poId);
    if (DB.currentUser.role !== 'Supplier' || !amendment || !order ||
        order.supplierId !== DB.currentUser.supplierId ||
        amendment.approvalStatus !== 'Pending Supplier Response' || !response.trim()) {
        showToast('This amendment response cannot be submitted for your supplier account.', 'error');
        return false;
    }
    amendment.supplierResponse = response.trim();
    amendment.respondedAt = new Date().toISOString();
    amendment.approvalStatus = 'Supplier Responded';
    logAudit('Supplier Amendment Response', `Supplier responded to amendment ${id} for PO ${order.id}.`);
    Storage.save(DB);
    showToast('Supplier explanation submitted for review.', 'success');
    renderApp();
    return true;
}
