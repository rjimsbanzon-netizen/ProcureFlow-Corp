// @ts-nocheck
import { formatQuantity } from '../domain/measurementUnits';
import { emptyTableRow } from './shared/feedback';
import { approveAmendment, rejectAmendment } from '../actions/amendmentActions';
import { hasPermission } from '../domain/permissions';
import { DB } from '../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderAmendmentsView() {
    let amendments = DB.amendments;
    if (DB.currentUser.role === 'Supplier') {
        amendments = amendments.filter(amendment =>
            DB.orders.some(order => order.id === amendment.poId && order.supplierId === DB.currentUser.supplierId)
        );
    }
    return `
        <div class="space-y-4">
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-slate-800">Order Discrepancies & Amendment Control</h3>
                        <p class="text-xs text-slate-500">Formal amendment records preserving original PO history</p>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                            <tr>
                                <th class="p-4">Amendment Ref</th>
                                <th class="p-4">Original PO</th>
                                <th class="p-4">Reason for Amendment</th>
                                <th class="p-4">Proposed Revision Specs / Qty</th>
                                <th class="p-4">Supplier Explanation</th>
                                <th class="p-4">Approval Status</th>
                                <th class="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            ${amendments.length === 0 ? `
                                ${emptyTableRow(7, 'No order amendments', 'Amendments are displayed when delivery discrepancies or order changes require resolution.', 'fa-clipboard-list')}
                            ` : amendments.map(a => `
                                <tr class="hover:bg-slate-50">
                                    <td class="p-4 font-bold text-purple-600">${a.id}</td>
                                    <td class="p-4 font-medium text-slate-900">${a.poId}</td>
                                    <td class="p-4 text-xs font-medium text-slate-800">${a.reason}</td>
                                    <td class="p-4 text-xs">
                                        <div class="font-semibold text-slate-800">${a.revisedSpecs}</div>
                                        <div class="text-slate-500">Revised Qty: ${formatQuantity(a.revisedQty, DB.orders.find(o=>o.id===a.poId)?.unit)}</div>
                                    </td>
                                    <td class="p-4 text-xs text-slate-600">${a.supplierResponse || 'Awaiting supplier explanation'}</td>
                                    <td class="p-4">
                                        <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            a.approvalStatus === 'Approved Amendment' ? 'bg-emerald-100 text-emerald-800' :
                                            a.approvalStatus === 'Rejected Amendment' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                        }">${a.approvalStatus}</span>
                                    </td>
                                    <td class="p-4 text-center">
                                        ${DB.currentUser.role === 'Supplier' && a.approvalStatus === 'Pending Supplier Response' ? `
                                            <form data-amendment-response-form="${a.id}" class="min-w-52 space-y-1">
                                                <textarea data-amendment-response rows="2" required placeholder="Explain and describe corrective action" class="w-full text-xs p-2 border border-slate-300 rounded"></textarea>
                                                <button type="submit" class="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold">Send Explanation</button>
                                            </form>
                                        ` : a.approvalStatus === 'Supplier Responded' && hasPermission('approve_amendment') ? `
                                            <div class="space-x-1">
                                                <button data-command="approveAmendment" data-arg1="${a.id}" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold">Approve & Reinspect</button>
                                                <button data-command="rejectAmendment" data-arg1="${a.id}" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold">Reject</button>
                                            </div>
                                        ` : `<span class="text-xs text-slate-400">Processed</span>`}
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
