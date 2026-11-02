// @ts-nocheck
import { displayUnit } from '../../domain/measurementUnits';
import { closeModal } from '../../actions/modalActions';
import { DB, ui } from '../../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderInitiateAmendmentModal() {
    const order = DB.orders.find(item=>item.id===ui.selectedRecord?.poId);
    const unit = displayUnit(order?.unit);
    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <h3 class="font-bold text-slate-800 text-lg">Initiate Order Amendment</h3>
                    <button data-command="closeModal" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <form id="initiate-amendment-form" class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Discrepancy / Amendment Reason</label>
                        <input type="text" id="amend-reason" required placeholder="e.g. Partial quantity shortage, spec adjustment..." class="w-full text-xs p-3 border border-slate-300 rounded-lg">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Revised Quantity (${unit})</label>
                            <input type="number" id="amend-qty" min="1" required placeholder="Adjusted quantity" class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Revised Specs / Terms</label>
                            <input type="text" id="amend-specs" required placeholder="Updated technical terms" class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                    </div>

                    <div class="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                        <button type="button" data-command="closeModal" class="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm">Submit Order Amendment</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}
