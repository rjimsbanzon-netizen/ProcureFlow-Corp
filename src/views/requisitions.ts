// @ts-nocheck
import { formatQuantity } from '../domain/measurementUnits';
import { openCreateStockNeedModal } from '../actions/biddingActions';
import { approvePR, rejectPR, viewPRDetails } from '../actions/requisitionActions';
import { canManageBidding, hasPermission } from '../domain/permissions';
import { getAvailableRequisitions, getCurrentUserRequisitions } from '../domain/procurement';
import { DB, ui } from '../store/state';
import { CLOUD_API_BASE } from '../services/cloud';
import { emptyTableRow } from './shared/feedback';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderRequisitionsView() {
    let reqs = DB.requisitions;
    if (DB.currentUser.role === 'Employee') {
        reqs = getCurrentUserRequisitions();
    }

    return `
        <div class="space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div class="relative flex-1 w-full max-w-xs">
                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-3 text-slate-400 text-sm"></i>
                    <input type="text" id="search-pr" placeholder="Search Title, PR #, Dept..." value="${ui.searchQuery}" class="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
                </div>

                ${hasPermission('create_pr') ? `
                    <button id="open-create-pr-modal" class="pf-primary-action px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center space-x-2">
                        <i class="fa-solid fa-plus"></i>
                        <span>Create Purchase Requisition</span>
                    </button>
                ` : ''}
            </div>

            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                            <tr>
                                <th class="p-4">PR Number</th>
                                <th class="p-4">Department</th>
                                <th class="p-4">Item Details & Specs</th>
                                <th class="p-4">Target Needed Date</th>
                                <th class="p-4 text-right">Est. Cost</th>
                                <th class="p-4">Status</th>
                                <th class="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            ${reqs.length === 0 ? `
                                ${emptyTableRow(7, 'No purchase requisitions found', 'Create a requisition to begin procurement, or adjust your search to see matching requests.', 'fa-file-signature')}
                            ` : reqs.map(r => `
                                <tr class="hover:bg-slate-50/80 transition-colors">
                                    <td class="p-4 font-bold text-sky-600">${r.id}</td>
                                    <td class="p-4">
                                        <span class="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs font-semibold text-slate-700">${r.department}</span>
                                    </td>
                                    <td class="p-4">
                                        <div class="font-bold text-slate-900">${r.itemTitle}</div>
                                        <div class="text-xs text-slate-500 truncate max-w-xs" title="${r.specs}">${r.specs}</div>
                                        <div class="text-xs text-slate-400 mt-1">Qty: ${formatQuantity(r.quantity, r.unit)} &bull; Unit price: ₱${r.unitPrice}</div>
                                    </td>
                                    <td class="p-4">${r.targetDate}</td>
                                    <td class="p-4 text-right font-bold text-slate-900">₱${(r.totalCost || 0).toLocaleString()}</td>
                                    <td class="p-4">${renderPRStatusBadge(r.status)}</td>
                                    <td class="p-4">
                                        <div class="pr-actions">
                                        ${r.status === 'Pending' && CLOUD_API_BASE ? `
                                            <button data-command="navigateTo" data-arg1="approvals" class="pr-action" title="View the multi-level approval status for this request">
                                                <i class="fa-solid fa-list-check"></i> View Approvals
                                            </button>
                                        ` : r.status === 'Pending' && hasPermission('approve_pr') ? `
                                            <button data-command="approvePR" data-arg1="${r.id}" class="pr-action pr-approve">
                                                <i class="fa-solid fa-check"></i> Approve
                                            </button>
                                            <button data-command="rejectPR" data-arg1="${r.id}" class="pr-action pr-reject">
                                                <i class="fa-solid fa-xmark"></i> Reject
                                            </button>
                                        ` : ''}

                                        ${r.status === 'Approved' && canManageBidding() && getAvailableRequisitions().some(pr => pr.id === r.id) ? `
                                            <button data-command="openCreateStockNeedModal" data-arg1="${r.id}" class="p-1.5 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-md text-xs font-semibold transition-colors">
                                                <i class="fa-solid fa-bullhorn"></i> Publish Need
                                            </button>
                                        ` : ''}
                                        <button data-command="openTracking" data-arg1="${r.id}" class="pr-action" title="Track procurement progress" aria-label="Track ${r.id}"><i class="fa-solid fa-route"></i> Track</button>
                                        <button data-command="viewPRDetails" data-arg1="${r.id}" class="pr-view" title="View requisition details" aria-label="View requisition details">
                                            <i class="fa-solid fa-eye"></i>
                                        </button>
                                        </div>
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


export function renderPRStatusBadge(status) {
    switch(status) {
        case 'Pending':
            return `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-clock mr-1"></i> Pending</span>`;
        case 'Approved':
            return `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-circle-check mr-1"></i> Approved</span>`;
        case 'Completed':
            return `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-circle-check mr-1"></i> Completed</span>`;
        case 'In Process':
            return `<span class="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-spinner fa-spin mr-1"></i> In Process</span>`;
        case 'Rejected':
            return `<span class="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-circle-xmark mr-1"></i> Rejected</span>`;
        default:
            return `<span class="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-semibold">${status}</span>`;
    }
}
