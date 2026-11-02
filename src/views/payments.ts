// @ts-nocheck
import { emptyTableRow } from './shared/feedback';
import { openProcessPaymentModal } from '../actions/orderActions';
import { isOrderFullyVerified } from '../domain/procurement';
import { DB } from '../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderPaymentsView(settings: import('../services/finance').FinanceSettings | null = null, authorities:Record<string,{allowed:boolean;requiredRole:'Finance Officer'|'Finance Head';threshold:number;reason:string}>={}) {
    let payList = DB.payments;
    if (DB.currentUser.role === 'Supplier') {
        const mySup = DB.suppliers.find(s => s.id === DB.currentUser.supplierId);
        if (mySup) payList = payList.filter(p => p.supplierName === mySup.name);
    }

    const headThreshold=settings?.financeHeadFrom ?? null;
    const currentUser=DB.currentUser;
    const requiredReviewer=(p)=>{
       const amount=Number(DB.orders.find(o=>o.id===p.poId)?.totalCost ?? p.totalAmount);
       return headThreshold!==null && amount>=headThreshold?'Finance Head':'Finance Officer';
    };
    const authorizedFor=(p)=>{
       // Never infer payment authority from an account title. The Worker checks
       // the formal appointment OR active delegation and the PO value threshold.
       return authorities[p.poId]?.allowed === true;
    };
    return `
        <div class="space-y-4">
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-slate-800">Financial Disbursements & Payment Approvals</h3>
                        <p class="text-xs text-slate-500">Payments require a signed PO, verified receipt, and matched invoice. Only the appointed Finance Officer or an active authorized substitute may process amounts below the Finance Head threshold; the Finance Head or authorized substitute handles amounts at or above it.</p><button data-command="navigateTo" data-arg1="invoice_matching" class="mt-2 text-xs font-bold text-[#a64f32]">Open Invoice &amp; PO Matching</button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                            <tr>
                                <th class="p-4">PO Ref</th>
                                <th class="p-4">Supplier</th>
                                <th class="p-4">Delivery Status</th>
                                <th class="p-4 text-right">Order Amount</th>
                                <th class="p-4">Method & Reference</th>
                                <th class="p-4">Payment Status</th>
                                <th class="p-4 text-center">Payment Control</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            ${payList.length === 0 ? `
                                ${emptyTableRow(7, 'No payment transactions yet', 'Payments become available after the purchase order is signed, delivery is verified, and invoice is matched.', 'fa-credit-card')}
                            ` : payList.map(p => `
                                <tr class="hover:bg-slate-50">
                                    <td class="p-4 font-bold text-sky-600">${p.poId}</td>
                                    <td class="p-4 font-medium text-slate-900">${p.supplierName}</td>
                                    <td class="p-4">
                                        ${isOrderFullyVerified(p.poId)
                                            ? `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full"><i class="fa-solid fa-check mr-1"></i> Verified</span>`
                                            : `<span class="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-semibold rounded-full"><i class="fa-solid fa-lock mr-1"></i> Unverified / On Hold</span>`
                                        }
                                    </td>
                                    <td class="p-4 text-right font-bold text-slate-900">₱${(p.totalAmount || 0).toLocaleString()}</td>
                                    <td class="p-4 text-xs">
                                        <div class="font-semibold text-slate-800">${p.paymentMethod || 'Not Selected'}</div>
                                        <div class="text-slate-500">${p.refNumber ? 'Ref: ' + p.refNumber : 'No Ref'}</div>
                                    </td>
                                    <td class="p-4">${renderPaymentStatusBadge(p.status)}</td>
                                    <td class="p-4 text-center">
                                        ${p.status==='Paid'?'<span class="text-xs text-emerald-600 font-semibold">Confirmed Paid</span>': authorizedFor(p) ? `
                                                <button data-command="openProcessPaymentModal" data-arg1="${p.id}" ${!isOrderFullyVerified(p.poId) ? 'disabled' : ''} class="px-3 py-1.5 ${!isOrderFullyVerified(p.poId) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} rounded-md text-xs font-semibold shadow-sm transition-colors">
                                                    <i class="fa-solid fa-money-check-dollar mr-1"></i> Process Payment
                                                </button>
                                        ` : `<div class="text-xs text-slate-500">${headThreshold===null && currentUser?.role!=='Supplier'?'Loading Finance settings…':authorities[p.poId]?.reason || `Assigned or acting ${requiredReviewer(p)} required`}</div>`}
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


export function renderPaymentStatusBadge(status) {
    switch(status) {
        case 'Paid':
            return `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-check-circle mr-1"></i> Paid</span>`;
        case 'Processing':
            return `<span class="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Processing</span>`;
        case 'On Hold':
            return `<span class="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-hand mr-1"></i> On Hold</span>`;
        default:
            return `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold inline-flex items-center"><i class="fa-solid fa-clock mr-1"></i> Pending</span>`;
    }
}
