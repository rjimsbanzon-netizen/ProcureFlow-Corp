// @ts-nocheck
import { formatQuantity } from '../domain/measurementUnits';
import { emptyTableRow } from './shared/feedback';
import { navigateTo } from '../core/renderBridge';
import { hasPermission } from '../domain/permissions';
import { getCurrentUserRequisitions, getSupplierRatingStats } from '../domain/procurement';
import { DB } from '../store/state';
import { renderPRStatusBadge } from './requisitions';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderDashboardView() {
    if (DB.currentUser.role === 'Supplier') {
        const mySupplier = DB.suppliers.find(s => s.id === DB.currentUser.supplierId) || { name: DB.currentUser.companyName || 'External Supplier' };
        const myOrders = DB.orders.filter(o => o.supplierId === DB.currentUser.supplierId);
        const ratingStats = getSupplierRatingStats(DB.currentUser.supplierId);
        const myMeetings = DB.proposalMeetings.filter(m => m.supplierId === DB.currentUser.supplierId && m.status === 'Pending Response');

        return `
            <div class="enterprise-dashboard space-y-6">
                <div class="dashboard-hero bg-gradient-to-r from-slate-900 to-sky-900 rounded-2xl p-6 text-white shadow-lg">
                    <div class="flex justify-between items-center">
                        <div>
                            <span class="px-3 py-1 bg-sky-500/30 text-sky-200 border border-sky-400/30 rounded-full text-xs font-semibold">Supplier Portal</span>
                            <h2 class="text-2xl font-bold mt-2">${mySupplier.name}</h2>
                            <p class="text-sky-200 text-sm">Welcome to your enterprise vendor fulfillment portal.</p>
                        </div>
                        <div class="bg-white/10 backdrop-blur-md p-4 rounded-xl text-center border border-white/10">
                            <div class="text-xs text-sky-200 uppercase font-semibold">Vendor Rating</div>
                            <div class="text-3xl font-bold text-amber-400 mt-1">
                                ${ratingStats.avg > 0 ? `<i class="fa-solid fa-star text-amber-400 mr-1"></i>${ratingStats.avg}` : 'N/A'}
                            </div>
                            <div class="text-xs text-slate-300 mt-1">${ratingStats.count} Evaluations</div>
                        </div>
                    </div>
                </div>

                ${myMeetings.length > 0 ? `
                    <div class="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-3">
                                <i class="fa-solid fa-calendar-check text-amber-600 text-xl"></i>
                                <div>
                                    <h4 class="font-bold text-amber-900">Pending Proposal Meeting Invites (${myMeetings.length})</h4>
                                    <p class="text-xs text-amber-700">Procurement officers have requested proposal meetings for your submitted bids.</p>
                                </div>
                            </div>
                            <button data-command="navigateTo" data-arg1="bidding" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm">
                                Review Invites
                            </button>
                        </div>
                    </div>
                ` : ''}

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p class="text-xs font-semibold uppercase text-slate-500">Active Orders</p>
                            <p class="text-2xl font-bold text-slate-800 mt-1">${myOrders.length}</p>
                        </div>
                        <div class="w-10 h-10 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-file-invoice-dollar"></i>
                        </div>
                    </div>

                    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p class="text-xs font-semibold uppercase text-slate-500">Completed Shipments</p>
                            <p class="text-2xl font-bold text-emerald-600 mt-1">
                                ${DB.deliveries.filter(d => d.supplierName === mySupplier.name && d.complianceStatus === 'Completed - Verified').length}
                            </p>
                        </div>
                        <div class="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                    </div>

                    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p class="text-xs font-semibold uppercase text-slate-500">Disbursements Received</p>
                            <p class="text-2xl font-bold text-sky-600 mt-1">
                                ₱${DB.payments.filter(p => p.supplierName === mySupplier.name && p.status === 'Paid').reduce((a, b) => a + (b.paymentAmount || 0), 0).toLocaleString()}
                            </p>
                        </div>
                        <div class="w-10 h-10 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center text-lg">
                            <i class="fa-solid fa-sack-dollar"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    if (DB.currentUser.role === 'Employee') {
        const myRequisitions = getCurrentUserRequisitions();
        const pendingRequisitions = myRequisitions.filter(request => request.status === 'Pending').length;
        const approvedRequisitions = myRequisitions.filter(request => request.status === 'Approved').length;
        const inProcessRequisitions = myRequisitions.filter(request => request.status === 'In Process').length;
        const completedRequisitions = myRequisitions.filter(request => request.status === 'Completed').length;
        const rejectedRequisitions = myRequisitions.filter(request => request.status === 'Rejected').length;
        const recentRequisitions = [...myRequisitions]
            .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
            .slice(0, 5);

        return `
            <div class="enterprise-dashboard space-y-6">
                <div class="dashboard-hero bg-gradient-to-r from-slate-900 to-sky-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <h2 class="text-2xl font-bold">My Purchase Requests</h2>
                        <p class="text-sky-200 text-sm mt-1">Track the status of requests you submitted.</p>
                    </div>
                    ${hasPermission('create_pr') ? `
                        <button id="quick-create-pr-btn" class="pf-primary-action mt-4 md:mt-0 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-sm font-semibold shadow-md transition-all flex items-center space-x-2">
                            <i class="fa-solid fa-plus"></i>
                            <span>New Requisition</span>
                        </button>
                    ` : ''}
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    ${[
                        { label: 'My Requests', count: myRequisitions.length, icon: 'fa-file-signature', color: 'sky' },
                        { label: 'Pending Review', count: pendingRequisitions, icon: 'fa-clock', color: 'amber' },
                        { label: 'Approved', count: approvedRequisitions, icon: 'fa-thumbs-up', color: 'indigo' },
                        { label: 'In Process', count: inProcessRequisitions, icon: 'fa-spinner', color: 'blue' },
                        { label: 'Completed', count: completedRequisitions, icon: 'fa-circle-check', color: 'emerald' },
                        { label: 'Rejected', count: rejectedRequisitions, icon: 'fa-circle-xmark', color: 'rose' }
                    ].map(metric => `
                        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                            <div>
                                <p class="text-xs font-semibold uppercase text-slate-500">${metric.label}</p>
                                <p class="text-2xl font-bold text-${metric.color}-600 mt-1">${metric.count}</p>
                            </div>
                            <div class="w-10 h-10 rounded-lg bg-${metric.color}-100 text-${metric.color}-600 flex items-center justify-center text-lg">
                                <i class="fa-solid ${metric.icon}"></i>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div class="p-4 border-b border-slate-200 flex items-center justify-between">
                        <div>
                            <h3 class="font-bold text-slate-800">My Recent Requests</h3>
                            <p class="text-xs text-slate-500">Only requests submitted by your account are shown.</p>
                        </div>
                        <button data-command="navigateTo" data-arg1="requisitions" class="text-sm font-semibold text-sky-700 hover:text-sky-900">
                            View all
                        </button>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm text-slate-600">
                            <thead class="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                                <tr>
                                    <th class="p-4">Request</th>
                                    <th class="p-4">Item</th>
                                    <th class="p-4">Quantity</th>
                                    <th class="p-4">Needed by</th>
                                    <th class="p-4 text-right">Estimated Cost</th>
                                    <th class="p-4">Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-200">
                                ${recentRequisitions.length === 0 ? `
                                    ${emptyTableRow(6, 'No recent requests', 'Use New Requisition to submit your first purchase request.', 'fa-file-signature')}
                                ` : recentRequisitions.map(request => `
                                    <tr class="hover:bg-slate-50/80">
                                        <td class="p-4 font-bold text-sky-600">${request.id}</td>
                                        <td class="p-4 font-medium text-slate-900">${request.itemTitle}</td>
                                        <td class="p-4">${formatQuantity(request.quantity, request.unit)}</td>
                                        <td class="p-4">${request.targetDate || '—'}</td>
                                        <td class="p-4 text-right font-semibold text-slate-900">₱${(request.totalCost || 0).toLocaleString()}</td>
                                        <td class="p-4">${renderPRStatusBadge(request.status)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    const totalPRs = DB.requisitions.length;
    const pendingApprovals = DB.requisitions.filter(r => r.status === 'Pending').length;
    const ordersInProcess = DB.orders.filter(o => o.status === 'Issued').length;
    const upcomingDeliveries = DB.deliveries.filter(d => d.deliveryStatus === 'Pending' || d.deliveryStatus === 'Partial').length;
    const completedVerified = DB.deliveries.filter(d => d.complianceStatus === 'Completed - Verified').length;
    const deliveryIssues = DB.deliveries.filter(d => d.complianceStatus.includes('Issue') || d.complianceStatus.includes('Non-Compliant')).length;
    const pendingAmendments = DB.amendments.filter(a =>
        ['Pending Supplier Response', 'Supplier Responded'].includes(a.approvalStatus)
    ).length;
    const paymentsAwaiting = DB.payments.filter(p => p.status === 'Pending' || p.status === 'Processing').length;
    const paymentsOnHold = DB.payments.filter(p => p.status === 'On Hold').length;
    const totalPaidSum = DB.payments.filter(p => p.status === 'Paid').reduce((acc, p) => acc + (p.paymentAmount || 0), 0);

    return `
        <div class="enterprise-dashboard space-y-6">
        <div class="dashboard-hero bg-gradient-to-r from-slate-900 to-sky-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h2 class="text-2xl font-bold">System Status Overview</h2>
                    <p class="text-sky-200 text-sm mt-1">Real-time enterprise metrics & procurement lifecycle monitor</p>
                </div>
                ${hasPermission('create_pr') ? `
                    <button id="quick-create-pr-btn" class="pf-primary-action mt-4 md:mt-0 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-sm font-semibold shadow-md transition-all flex items-center space-x-2">
                        <i class="fa-solid fa-plus"></i>
                        <span>New Requisition</span>
                    </button>
                ` : ''}
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase text-slate-500">Total PRs</p>
                        <p class="text-2xl font-bold text-slate-800 mt-1">${totalPRs}</p>
                    </div>
                    <div class="w-10 h-10 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-file-signature"></i>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase text-slate-500">Pending PR Approvals</p>
                        <p class="text-2xl font-bold text-amber-600 mt-1">${pendingApprovals}</p>
                    </div>
                    <div class="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-clock"></i>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase text-slate-500">Orders in Process</p>
                        <p class="text-2xl font-bold text-blue-600 mt-1">${ordersInProcess}</p>
                    </div>
                    <div class="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-truck-fast"></i>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase text-slate-500">Upcoming Deliveries</p>
                        <p class="text-2xl font-bold text-indigo-600 mt-1">${upcomingDeliveries}</p>
                    </div>
                    <div class="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-box-open"></i>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase text-slate-500">Verified Completed</p>
                        <p class="text-2xl font-bold text-emerald-600 mt-1">${completedVerified}</p>
                    </div>
                    <div class="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase text-slate-500">Delivery Issues</p>
                        <p class="text-2xl font-bold text-rose-600 mt-1">${deliveryIssues}</p>
                    </div>
                    <div class="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase text-slate-500">Pending Amendments</p>
                        <p class="text-2xl font-bold text-purple-600 mt-1">${pendingAmendments}</p>
                    </div>
                    <div class="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase text-slate-500">Payments Awaiting</p>
                        <p class="text-2xl font-bold text-amber-600 mt-1">${paymentsAwaiting}</p>
                    </div>
                    <div class="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-hourglass-half"></i>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase text-slate-500">Payments On Hold</p>
                        <p class="text-2xl font-bold text-rose-600 mt-1">${paymentsOnHold}</p>
                    </div>
                    <div class="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-hand"></i>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase text-slate-500">Completed Payments</p>
                        <p class="text-xl font-bold text-emerald-600 mt-1">₱${totalPaidSum.toLocaleString()}</p>
                    </div>
                    <div class="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-sack-dollar"></i>
                    </div>
                </div>
            </div>
        </div>
    `;
}
