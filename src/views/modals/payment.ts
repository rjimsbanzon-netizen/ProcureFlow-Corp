// @ts-nocheck
import { closeModal } from '../../actions/modalActions';
import { DB, ui } from '../../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderProcessPaymentModal() {
    const payment = DB.payments.find(p => p.id === ui.selectedRecord);
    if (!payment) return '';

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <h3 class="font-bold text-slate-800 text-lg">Process Financial Disbursement</h3>
                    <button data-command="closeModal" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <form id="process-payment-form" class="space-y-4">
                    <div class="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs text-emerald-800 space-y-1">
                        <p class="font-bold">${payment.poId} &bull; ${payment.supplierName}</p>
                        <p>Verified Total Payable: <b>₱${(payment.totalAmount || 0).toLocaleString()}</b></p>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Payment Method</label>
                        <select id="pay-method" class="w-full text-xs p-3 border border-slate-300 rounded-lg">
                            <option value="Bank Transfer">Direct Wire / Bank Transfer</option>
                            <option value="Corporate Check">Corporate Check</option>
                            <option value="Letter of Credit">Letter of Credit (LC)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Transaction Ref / Check Number</label>
                        <input type="text" id="pay-ref" required placeholder="e.g. TRX-8849201" class="w-full text-xs p-3 border border-slate-300 rounded-lg">
                    </div>

                    <div class="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                        <button type="button" data-command="closeModal" class="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm">Confirm & Release Disbursement</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}
