// @ts-nocheck
import { formatQuantity } from '../../domain/measurementUnits';
import { emptyPanel } from '../shared/feedback';
import { getDeadline, deadlineIsOpen } from '../../services/sourcing';
import { canManageBidding } from '../../domain/permissions';
import { DB } from '../../store/state';
import { renderSupplierQuotationReceipt } from './shared';

/** Stock need publication, supplier opportunities, and supplier bid receipts. */
export function renderStockNeedsView() {
    const isSupplier = DB.currentUser.role === 'Supplier';
    const canCreateNeed = canManageBidding();
    const visibleStockNeeds = DB.stockNeeds.filter(sn => !isSupplier || sn.status === 'Published' ||
        DB.bids.some(bid => bid.needId === sn.id && bid.supplierId === DB.currentUser.supplierId));
    return `
      <div class="space-y-6">
            <div class="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h3 class="font-bold text-slate-800 text-lg">Procurement Needs & Vendor Bidding</h3>
                    <p class="text-xs text-slate-500">Publish procurement needs and receive supplier quotations. Bid comparison and meeting invitations are organized in separate modules.</p>
                </div>
                ${canCreateNeed ? `
                    <button data-command="openCreateStockNeedModal" class="pf-primary-action px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center space-x-2">
                        <i class="fa-solid fa-bullhorn"></i>
                        <span>Publish Procurement Need</span>
                    </button>
                ` : ''}
            </div>

            <!-- Published Stock Needs Section -->
            <div class="space-y-4">
                <h4 class="font-bold text-slate-800 flex items-center gap-2">
                    <i class="fa-solid fa-box-open text-sky-600"></i>
                    <span>Published Procurement Opportunities</span>
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${visibleStockNeeds.length === 0 ? `
                        <div class="col-span-full">${emptyPanel('No stock needs published', 'Approved purchase requests can be published as procurement opportunities. Available needs will appear here.', 'fa-box-open')}</div>
                    ` : visibleStockNeeds.map(sn => {
                        const bidCount = DB.bids.filter(b => b.needId === sn.id).length;
                        const userBid = isSupplier ? DB.bids.find(b => b.needId === sn.id && b.supplierId === DB.currentUser.supplierId) : null;
                        const linkedPR = DB.requisitions.find(pr => pr.id === sn.prId);
                        const deadline = getDeadline(sn.id);
                        const openForBids = deadlineIsOpen(sn.id);
                        return `
                            <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                                <div>
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <span class="text-xs font-bold text-sky-600">${sn.id}</span>
                                            <h5 class="font-bold text-slate-900 text-base mt-0.5">${sn.title}</h5>
                                        </div>
                                        <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">${sn.status}</span>
                                    </div>
                                    <div class="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1">
                                        <p><span class="font-semibold text-slate-700">Target Qty:</span> ${formatQuantity(sn.targetQty, sn.unit)}</p>
                                        <p><span class="font-semibold text-slate-700">Budget Cap:</span> ₱${(sn.budgetCap || 0).toLocaleString()}</p>
                                        <p><span class="font-semibold text-slate-700">Tech Specs:</span> ${sn.techSpecs}</p>
                                        <p class="font-semibold ${openForBids ? 'text-emerald-700' : 'text-amber-700'}">${!deadline ? 'Deadline not configured — bidding closed' : deadline.manuallyClosed ? 'Bidding manually closed' : openForBids ? `Bids accepted until ${new Date(deadline.closesAt).toLocaleString()}` : 'Submission deadline passed — bidding closed'}</p>
                                        ${linkedPR ? `<p><span class="font-semibold text-slate-700">Purchase Request:</span> ${linkedPR.id}</p><p><span class="font-semibold text-slate-700">Priority:</span> ${['A','B','C'].includes(linkedPR.priority) ? linkedPR.priority : 'Not classified'} · <span class="font-semibold text-slate-700">Category:</span> ${linkedPR.purchaseCategory || 'Goods & Materials (legacy)'}</p>` : ''}
                                    </div>
                                </div>

                                <div class="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                                    <span class="text-slate-500"><i class="fa-solid fa-gavel mr-1"></i> ${bidCount} Bids Submitted</span>

                                    ${isSupplier ? `
                                        ${userBid ? `
                                            <span class="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold">
                                                <i class="fa-solid fa-check mr-1"></i> Bid Submitted (₱${userBid.totalCost.toLocaleString()})
                                            </span>
                                        ` : !openForBids ? `
                                            <span class="text-amber-700 font-semibold">Bidding closed</span>
                                        ` : `
                                            <button data-command="openSubmitBidModal" data-arg1="${sn.id}" class="pf-primary-action px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold transition-colors flex items-center space-x-1.5">
                                                <i class="fa-solid fa-hand-holding-dollar"></i>
                                                <span>Apply / Submit Bid</span>
                                            </button>
                                        `}
                                    ` : ''}
                                </div>
                                ${isSupplier && userBid ? renderSupplierQuotationReceipt(userBid) : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

      </div>
    `;
}
