// @ts-nocheck
import { openAddSupplierModal, openRateSupplierModal, viewSupplierRatingsModal } from '../actions/orderActions';
import { hasPermission } from '../domain/permissions';
import { getSupplierRatingStats, isOrderFullyVerified } from '../domain/procurement';
import { DB } from '../store/state';
import { emptyPanel } from './shared/feedback';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderSuppliersView() {
    return `
        <div class="space-y-4">
            <div class="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h3 class="font-bold text-slate-800">Approved Vendor Directory & Performance Ratings</h3>
                    <p class="text-xs text-slate-500">Evaluated vendor profiles, quality compliance, and ratings</p>
                </div>
                ${hasPermission('manage_suppliers') ? `
                    <button data-command="openAddSupplierModal" class="pf-primary-action px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center space-x-2">
                        <i class="fa-solid fa-plus"></i>
                        <span>Add New Supplier</span>
                    </button>
                ` : ''}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${DB.suppliers.length===0?`<div class="md:col-span-3">${emptyPanel('No suppliers listed yet', 'Verified and managed suppliers will appear in this directory after they are added.', 'fa-building')}</div>`:''}
                ${DB.suppliers.map(s => {
                    const stats = getSupplierRatingStats(s.id);
                    const supplierRatings = DB.ratings.filter(r => r.supplierId === s.id);
                    return `
                        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between">
                            <div>
                                <div class="flex items-start justify-between">
                                    <div class="w-12 h-12 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-lg">
                                        <i class="fa-solid fa-building"></i>
                                    </div>
                                    <div class="text-right">
                                        <span class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">${s.category}</span>
                                        <div class="mt-2 flex items-center justify-end space-x-1 text-amber-400">
                                            ${renderStarRatingHTML(stats.avg)}
                                            <span class="text-xs font-bold text-slate-600 ml-1">(${stats.avg})</span>
                                        </div>
                                    </div>
                                </div>

                                <h4 class="font-bold text-slate-900 text-base mt-3">${s.name}</h4>
                                <div class="mt-3 space-y-1 text-xs text-slate-500">
                                    <p><i class="fa-solid fa-user w-4 text-slate-400"></i> ${s.contact}</p>
                                    <p><i class="fa-solid fa-envelope w-4 text-slate-400"></i> ${s.email}</p>
                                    <p><i class="fa-solid fa-phone w-4 text-slate-400"></i> ${s.phone}</p>
                                </div>

                                <!-- Recent Review Excerpt -->
                                ${supplierRatings.length > 0 ? `
                                    <div class="mt-4 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                                        <div class="font-semibold text-slate-700 flex justify-between">
                                            <span>${supplierRatings[0].evaluatorName}</span>
                                            <span class="text-amber-500"><i class="fa-solid fa-star"></i> ${supplierRatings[0].rating}/5</span>
                                        </div>
                                        <p class="text-slate-500 italic mt-1 truncate">"${supplierRatings[0].feedback}"</p>
                                    </div>
                                ` : `
                                    <div class="mt-4 p-2.5 bg-slate-50 rounded-lg text-xs text-slate-400 text-center italic">
                                        No ratings recorded yet.
                                    </div>
                                `}
                            </div>

                            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                <button data-command="viewSupplierRatingsModal" data-arg1="${s.id}" class="text-xs text-sky-600 hover:text-sky-800 font-semibold">
                                    <i class="fa-solid fa-comments mr-1"></i> ${stats.count} Reviews
                                </button>

                                ${hasPermission('rate_supplier') ? `
                                    <div class="flex flex-col items-end gap-1">
                                        ${DB.payments.filter(payment =>
                                            payment.status === 'Paid' &&
                                            DB.orders.some(order => order.id === payment.poId && order.supplierId === s.id) &&
                                            isOrderFullyVerified(payment.poId) &&
                                            !DB.ratings.some(rating => rating.poId === payment.poId)
                                        ).map(payment => `
                                            <button data-command="openRateSupplierModal" data-arg1="${s.id}" data-arg2="${payment.poId}" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors">
                                                <i class="fa-solid fa-star mr-1"></i>Rate ${payment.poId}
                                            </button>
                                        `).join('') || '<span class="text-xs text-slate-400">Rate after a completed, paid order</span>'}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}


export function renderStarRatingHTML(score) {
    let html = '';
    const numeric = parseFloat(score) || 0;
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(numeric)) {
            html += `<i class="fa-solid fa-star text-amber-400 text-xs"></i>`;
        } else if (i - 0.5 <= numeric) {
            html += `<i class="fa-solid fa-star-half-stroke text-amber-400 text-xs"></i>`;
        } else {
            html += `<i class="fa-regular fa-star text-slate-300 text-xs"></i>`;
        }
    }
    return html;
}
