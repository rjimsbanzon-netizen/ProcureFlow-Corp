// @ts-nocheck
import { formatQuantity } from '../domain/measurementUnits';
import { confirmAction } from '../services/actionDialogs';
import { renderApp } from '../core/renderBridge';
import { CLOUD_API_BASE } from '../services/cloud';
import { financeAPI } from '../services/finance';
import { canManageDeliveryIssues, hasPermission } from '../domain/permissions';
import { getRemainingOrderQuantity, isOrderFullyVerified } from '../domain/procurement';
import { logAudit } from '../services/audit';
import { Storage } from '../services/storage';
import { showToast } from '../services/toast';
import { DB, ui } from '../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function openRecordDeliveryModal(poId) {
    const order = DB.orders.find(item => item.id === poId);
    if (!hasPermission('record_delivery') || !order ||
        !['Approved & Signed', 'Issued'].includes(order.status) ||
        getRemainingOrderQuantity(poId) < 1) {
        showToast('Delivery can be recorded only for an accepted Purchase Order with outstanding quantity.', 'error');
        return;
    }
    ui.selectedRecord = poId;
    ui.currentModal = 'record_delivery';
    renderApp();
}


export async function acceptPurchaseOrder(poId) {
    const order = DB.orders.find(item => item.id === poId);
    if (DB.currentUser.role !== 'Supplier' || !order ||
        order.supplierId !== DB.currentUser.supplierId ||
        order.status !== 'Awaiting Supplier Signature') {
        showToast('This Purchase Order is not awaiting acceptance for your supplier account.', 'error');
        return;
    }
    if (!await confirmAction({title:'Sign and accept Purchase Order',message:`By confirming, you accept and sign Purchase Order ${order.id} for ${formatQuantity(order.quantity, order.unit)} of ${order.itemTitle} at ₱${order.totalCost.toLocaleString()}.`,confirmText:'Accept & sign PO'})) return;

    order.status = 'Approved & Signed';
    order.signedBy = DB.currentUser.name;
    order.signedAt = new Date().toISOString();
    logAudit('PO Signed by Supplier', `Supplier ${order.supplierName} accepted Purchase Order ${order.id}.`);
    Storage.save(DB);
    showToast(`Purchase Order ${order.id} accepted and signed.`, 'success');
    renderApp();
}


export function openInspectDeliveryModal(delId) {
    const delivery = DB.deliveries.find(item => item.id === delId);
    if (!hasPermission('record_delivery') || !delivery) {
        showToast('Only procurement staff can inspect a recorded delivery.', 'error');
        return;
    }
    ui.selectedRecord = delId;
    ui.currentModal = 'inspect_delivery';
    renderApp();
}


export function openRateSupplierModal(supId, poId) {
    const payment = DB.payments.find(item => item.poId === poId);
    const order = DB.orders.find(item => item.id === poId && item.supplierId === supId);
    if (!hasPermission('rate_supplier') || !payment || payment.status !== 'Paid' || !order ||
        !isOrderFullyVerified(poId) || DB.ratings.some(item => item.poId === poId)) {
        showToast('Supplier evaluations are available once per completed and paid transaction.', 'error');
        return;
    }
    ui.selectedRecord = { supplierId: supId, poId };
    ui.currentModal = 'rate_supplier';
    renderApp();
}


export function viewSupplierRatingsModal(supId) {
    ui.selectedRecord = supId;
    ui.currentModal = 'view_ratings';
    renderApp();
}


export function openAddSupplierModal() {
    ui.currentModal = 'add_supplier';
    renderApp();
}


export async function openProcessPaymentModal(payId) {
    const payment = DB.payments.find(item => item.id === payId);
    if (!payment || payment.status !== 'Pending' || !isOrderFullyVerified(payment.poId)) {
        showToast('Payment is available only after the complete Purchase Order passes inspection.', 'error');
        return;
    }
    // The Worker's per-PO authority check includes approved acting Finance Officers
    // and Finance Heads. The local matrix only represents permanent appointments,
    // so it must not block an authorized substitute before the server is consulted.
    // Keep the original local permission guard when running without the cloud API.
    if (!CLOUD_API_BASE && !hasPermission('process_payment')) {
        showToast('Only a Finance approver may process this payment.', 'error');
        return;
    }
    if (CLOUD_API_BASE) {
        try {
            await Storage.flush();
            const authorization = await financeAPI.paymentAuthority(payment.poId);
            if (!authorization.allowed) {
                showToast(authorization.reason || `Only the ${authorization.requiredRole} may process this payment.`, 'error');
                return;
            }
            const match = await financeAPI.matchStatus(payment.poId);
            if (!match.matched) {
                showToast('Payment blocked: ' + (match.reasons?.join(' ') || 'Verify supplier invoice against PO and delivery first.'), 'error');
                return;
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Could not verify invoice match.', 'error');
            return;
        }
    }
    ui.selectedRecord = payId;
    ui.currentModal = 'process_payment';
    renderApp();
}


export function openInitiateAmendmentModal(poId, delId) {
    const delivery = DB.deliveries.find(item => item.id === delId && item.poId === poId);
    const payment = DB.payments.find(item => item.poId === poId);
    if (!canManageDeliveryIssues() || !delivery ||
        payment?.status === 'Paid' ||
        !['Issue Flagged - Quantity Shortage', 'Issue Flagged - Damaged / Defective Goods', 'Non-Compliant Specifications'].includes(delivery.complianceStatus) ||
        DB.amendments.some(item => item.delId === delId && ['Pending Supplier Response', 'Supplier Responded'].includes(item.approvalStatus))) {
        showToast('An amendment can be issued only by the Procurement Head or Admin for an unresolved delivery issue.', 'error');
        return;
    }
    ui.selectedRecord = { poId, delId };
    ui.currentModal = 'initiate_amendment';
    renderApp();
}
