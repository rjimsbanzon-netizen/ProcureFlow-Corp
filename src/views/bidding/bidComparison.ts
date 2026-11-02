// @ts-nocheck
import { emptyTableRow } from '../shared/feedback';
import { canManageBidding, getAgreementFinalizationError } from '../../domain/permissions';
import { DB } from '../../store/state';
import { detectSupplierClauseFindings, getSupplierQuotationTerms } from '../../domain/bidTerms';
import { escapeMeetingText } from '../../domain/meetingSchedule';
import { safeBidText } from './shared';

/** Procurement-only bids, comparison, supplier selection, and PO handoff. */
export function renderBidComparisonView() {
    if (!['Admin','Procurement Head'].includes(DB.currentUser.role)) return '';
    const canCreateNeed = canManageBidding();
    return `
                <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div class="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <div>
                            <h4 class="font-bold text-slate-800">Submitted Vendor Bids & Comparison</h4>
                            <p class="text-xs text-slate-500">Review vendor offers and schedule proposal presentation meetings.</p>
                        </div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm text-slate-600">
                            <thead class="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                                <tr>
                                    <th class="p-4">Stock Need</th>
                                    <th class="p-4">Supplier</th>
                                    <th class="p-4 text-right">Unit Price</th>
                                    <th class="p-4 text-right">Total Offer</th>
                                    <th class="p-4">Lead Time</th>
                                    <th class="p-4">Product Notes</th>
                                    <th class="p-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-200">
                                ${DB.bids.length === 0 ? `
                                    ${emptyTableRow(7, 'No vendor bids received', 'Suppliers can submit quotations for open published stock needs. Submitted offers will appear here.', 'fa-scale-balanced')}
                                ` : DB.bids.map(b => {
                                    const need = DB.stockNeeds.find(s => s.id === b.needId) || { title: b.needId };
                                    const meeting = DB.proposalMeetings.find(m => m.bidId === b.id);
                                    const finalizeError = getAgreementFinalizationError(b.id);
                                    return `
                                        <tr class="hover:bg-slate-50">
                                            <td class="p-4 font-bold text-sky-600">${need.title}</td>
                                            <td class="p-4 font-medium text-slate-900">${b.supplierName}</td>
                                            <td class="p-4 text-right font-semibold">₱${b.unitPrice.toLocaleString()}</td>
                                            <td class="p-4 text-right font-bold text-slate-900">₱${b.totalCost.toLocaleString()}</td>
                                            <td class="p-4 text-xs font-medium text-slate-700">${b.leadTimeDays} Days</td>
                                            <td class="p-4 text-xs text-slate-600 max-w-xs">
                                                <div class="truncate" title="${safeBidText(b.notes)}">${safeBidText(b.notes)}</div>
                                                ${getSupplierQuotationTerms(b) ? `
                                                    <div class="mt-1 text-[11px] text-sky-700 font-semibold">Structured quotation terms attached</div>
                                                    ${detectSupplierClauseFindings(b, need).some(f => f.severity !== 'info') ? `
                                                      <span class="mt-1 inline-block rounded bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">${detectSupplierClauseFindings(b, need).filter(f => f.severity !== 'info').length} clause flag(s) — review in scorecard</span>
                                                    ` : ''}
                                                ` : `<span class="mt-1 text-[11px] text-slate-400">Legacy free-text quotation</span>`}
                                            </td>
                                            <td class="p-4 text-center space-y-2">
                                                ${b.status === 'Selected' ? `
                                                    <span class="block px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Selected supplier</span>
                                                    ${meeting?.status === 'Agreed' ? `
                                                        ${canCreateNeed && !finalizeError
                                                            ? `<button data-command="openFinalizeAgreementModal" data-arg1="${b.id}" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold">Finalize Terms & Issue PO</button>`
                                                            : canCreateNeed
                                                                ? `<span class="block max-w-xs text-xs text-rose-700">Cannot issue PO: ${finalizeError}</span>`
                                                                : ''}
                                                    ` : meeting?.status === 'Pending Response' ? `
                                                        <span class="text-xs text-amber-700">Meeting response pending</span>
                                                    ` : canCreateNeed && !DB.orders.some(order => order.bidId === b.id) ? `
                                                        <button data-command="${meeting?.status === 'Declined' ? 'openRescheduleMeetingModal' : 'openScheduleMeetingModal'}" data-arg1="${meeting?.status === 'Declined' ? escapeMeetingText(meeting.id) : escapeMeetingText(b.id)}" class="pf-primary-action px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold transition-colors">
                                                            <i class="fa-solid fa-calendar-plus mr-1"></i>${meeting?.status === 'Declined' ? 'Reschedule Meeting' : 'Schedule Meeting'}
                                                        </button>
                                                    ` : ''}
                                                ` : b.status === 'Submitted' && need.status === 'Published' && canCreateNeed ? `
                                                    <button data-command="selectBid" data-arg1="${b.id}" class="pf-primary-action px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-semibold">
                                                        <i class="fa-solid fa-check mr-1"></i>Select Supplier
                                                    </button>
                                                ` : `
                                                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${b.status === 'Not Selected' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}">${b.status}</span>
                                                `}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
    `;
}
