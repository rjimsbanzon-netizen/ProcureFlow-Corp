// @ts-nocheck
import { formatQuantity } from '../domain/measurementUnits';
import { emptyTableRow } from './shared/feedback';
import { acceptPurchaseOrder, openRecordDeliveryModal } from '../actions/orderActions';
import { hasPermission } from '../domain/permissions';
import { getRemainingOrderQuantity } from '../domain/procurement';
import { DB } from '../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderOrdersView() {
    let ordersList = DB.orders;
    if (DB.currentUser.role === 'Supplier') {
        ordersList = ordersList.filter(o => o.supplierId === DB.currentUser.supplierId);
    }

    return `
        <div class="space-y-4">
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 class="font-bold text-slate-800">Purchase Orders & Supplier Acceptance</h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                            <tr>
                                <th class="p-4">PO Number</th>
                                <th class="p-4">PR Ref</th>
                                <th class="p-4">Supplier</th>
                                <th class="p-4">Requesting Dept</th>
                                <th class="p-4">Item & Quantity</th>
                                <th class="p-4 text-right">Total Amount</th>
                                <th class="p-4">PO Date</th>
                                <th class="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            ${ordersList.length === 0 ? `
                                ${emptyTableRow(8, 'No purchase orders yet', 'Purchase orders will appear after a supplier is selected and the agreement is finalized.', 'fa-file-invoice-dollar')}
                            ` : ordersList.map(o => `
                                <tr class="hover:bg-slate-50">
                                    <td class="p-4 font-bold text-sky-600">${o.id}<div class="mt-1 text-xs font-medium text-slate-500">${o.status}</div></td>
                                    <td class="p-4 text-xs font-semibold text-slate-500">${o.prId}</td>
                                    <td class="p-4 font-medium text-slate-900">${o.supplierName}</td>
                                    <td class="p-4">${o.department}</td>
                                    <td class="p-4">
                                        <div class="font-medium text-slate-800">${o.itemTitle}</div>
                                        <div class="text-xs text-slate-500">Qty: ${formatQuantity(o.quantity, o.unit)}</div>
                                    </td>
                                    <td class="p-4 text-right font-bold text-slate-900">₱${(o.totalCost || 0).toLocaleString()}</td>
                                    <td class="p-4">${o.poDate}</td>
                                    <td class="p-4 text-center">
                                        ${DB.currentUser.role === 'Supplier' && o.status === 'Awaiting Supplier Signature' ? `
                                            <button data-command="acceptPurchaseOrder" data-arg1="${o.id}" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors">
                                                <i class="fa-solid fa-file-signature mr-1"></i> Review & Sign PO
                                            </button>
                                        ` : hasPermission('record_delivery') && ['Approved & Signed', 'Issued'].includes(o.status) && getRemainingOrderQuantity(o.id) > 0 ? `
                                            <button data-command="openRecordDeliveryModal" data-arg1="${o.id}" class="pf-primary-action px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1 mx-auto">
                                                <i class="fa-solid fa-truck-ramp-box"></i>
                                                <span>Log Delivery</span>
                                            </button>
                                        ` : hasPermission('record_delivery') && ['Approved & Signed', 'Issued'].includes(o.status) ? `
                                            <span class="text-xs text-emerald-700">Order quantity received</span>
                                        ` : hasPermission('record_delivery') ? `
                                            <span class="text-xs text-amber-700">Awaiting supplier signature</span>
                                        ` : `
                                            <span class="text-xs text-slate-400">${o.status}</span>
                                        `}
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
