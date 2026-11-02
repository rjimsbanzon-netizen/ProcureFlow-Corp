import { displayUnit } from '../../domain/measurementUnits';
// @ts-nocheck
import { DB, ui } from '../../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderFinalizeAgreementModal() {
    const bid = DB.bids.find(item => item.id === ui.selectedRecord);
    const need = DB.stockNeeds.find(item => item.id === bid?.needId);
    if (!bid || !need || !need.prId) return '';

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">Finalize Supplier Agreement</h3>
                        <p class="text-xs text-slate-500">${bid.supplierName} &bull; ${need.title}</p>
                    </div>
                    <button data-command="closeModal" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>
                <form id="finalize-agreement-form" class="space-y-4">
                    <p class="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">Confirm the negotiated price, quantity, and requirements. The resulting Purchase Order will require the supplier's signature before delivery.</p>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Agreed Price (₱ per ${displayUnit(need.unit)})</label>
                            <input type="number" id="agreement-unit-price" min="0" step="0.01" value="${bid.unitPrice}" required class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Agreed Quantity (${displayUnit(need.unit)})</label>
                            <input type="number" id="agreement-quantity" min="1" value="${need.targetQty}" required class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Final Specifications / Requirements</label>
                        <textarea id="agreement-specs" rows="3" required class="w-full text-xs p-3 border border-slate-300 rounded-lg">${need.techSpecs}</textarea>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Agreed Terms</label>
                        <textarea id="agreement-terms" rows="3" required class="w-full text-xs p-3 border border-slate-300 rounded-lg">${bid.notes}</textarea>
                    </div>
                    <div class="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                        <button type="button" data-command="closeModal" class="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm">Issue Purchase Order</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}
