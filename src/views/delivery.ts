// @ts-nocheck
import { formatQuantityRatio } from '../domain/measurementUnits';
import { emptyTableRow } from './shared/feedback';
import { openInitiateAmendmentModal, openInspectDeliveryModal } from '../actions/orderActions';
import { canManageDeliveryIssues, hasPermission } from '../domain/permissions';
import { DB } from '../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderDeliveryView() {
    let deliveries = DB.deliveries;
    if (DB.currentUser.role === 'Employee') {
        deliveries = deliveries.filter(d => d.department === DB.currentUser.department);
    } else if (DB.currentUser.role === 'Supplier') {
        const supObj = DB.suppliers.find(s => s.id === DB.currentUser.supplierId);
        if (supObj) deliveries = deliveries.filter(d => d.supplierName === supObj.name);
    }

    return `
        <div class="space-y-4">
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-slate-800">Delivery Receipts & Inspection Progress</h3>
                        <p class="text-xs text-slate-500">Log incoming shipments, perform spec inspections, and verify orders</p>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                            <tr>
                                <th class="p-4">PO Ref</th>
                                <th class="p-4">Supplier & Dept</th>
                                <th class="p-4">Item & Specifications</th>
                                <th class="p-4">Qty (Ord/Del)</th>
                                <th class="p-4">Delivery Dates</th>
                                <th class="p-4">Inspection Status</th>
                                <th class="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            ${deliveries.length === 0 ? `
                                ${emptyTableRow(7, 'No deliveries recorded', 'Verified shipments and delivery inspections will appear here.', 'fa-truck-ramp-box')}
                            ` : deliveries.map(d => `
                                <tr class="hover:bg-slate-50">
                                    <td class="p-4 font-bold text-sky-600">${d.poId}</td>
                                    <td class="p-4">
                                        <div class="font-medium text-slate-900">${d.supplierName}</div>
                                        <div class="text-xs text-slate-500">${d.department}</div>
                                    </td>
                                    <td class="p-4">
                                        <div class="font-semibold text-slate-800">${d.itemTitle}</div>
                                        <div class="text-xs text-slate-500 truncate max-w-xs" title="${d.specs}">${d.specs}</div>
                                    </td>
                                    <td class="p-4 font-medium">
                                        <span class="${d.deliveredQty < d.orderedQty ? 'text-amber-600 font-bold' : 'text-emerald-600'}">
                                            ${formatQuantityRatio(d.deliveredQty, d.orderedQty, d.unit || DB.orders.find(o=>o.id===d.poId)?.unit)}
                                        </span>
                                    </td>
                                    <td class="p-4 text-xs">
                                        <div>Expected: ${d.expectedDate || 'N/A'}</div>
                                        <div class="text-slate-500">Actual: ${d.actualDate || 'Pending'}</div>
                                    </td>
                                    <td class="p-4">${renderComplianceBadge(d.complianceStatus)}</td>
                                    <td class="p-4 text-center space-x-1">
                                        ${hasPermission('record_delivery') ? `
                                            <button data-command="openInspectDeliveryModal" data-arg1="${d.id}" class="px-2.5 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-md text-xs font-medium transition-colors">
                                                <i class="fa-solid fa-clipboard-check"></i> Inspect
                                            </button>
                                        ` : ''}

                                        ${(d.complianceStatus.includes('Issue') || d.complianceStatus.includes('Non-Compliant')) &&
                                            canManageDeliveryIssues() &&
                                            !DB.amendments.some(a => a.delId === d.id && ['Pending Supplier Response', 'Supplier Responded'].includes(a.approvalStatus)) &&
                                            DB.payments.find(p => p.poId === d.poId)?.status !== 'Paid' ? `
                                            <button data-command="openInitiateAmendmentModal" data-arg1="${d.poId}" data-arg2="${d.id}" class="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-md text-xs font-semibold transition-colors">
                                                <i class="fa-solid fa-triangle-exclamation"></i> Amend
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}


export function renderComplianceBadge(status) {
    if (status === 'Completed - Verified') {
        return `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-check-double mr-1"></i> Completed - Verified</span>`;
    } else if (status.includes('Issue') || status.includes('Non-Compliant')) {
        return `<span class="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Issue Flagged</span>`;
    } else {
        return `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-clock mr-1"></i> ${status}</span>`;
    }
}
