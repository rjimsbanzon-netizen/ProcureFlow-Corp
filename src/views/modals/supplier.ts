// @ts-nocheck
import { closeModal } from '../../actions/modalActions';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderAddSupplierModal() {
    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <h3 class="font-bold text-slate-800 text-lg">Add Approved Vendor</h3>
                    <button data-command="closeModal" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <form id="add-supplier-form" class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Company / Vendor Name</label>
                        <input type="text" id="sup-name" required placeholder="e.g. Apex Hardware Co." class="w-full text-xs p-3 border border-slate-300 rounded-lg">
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Contact Person</label>
                        <input type="text" id="sup-contact" required placeholder="e.g. Robert Smith" class="w-full text-xs p-3 border border-slate-300 rounded-lg">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Email</label>
                            <input type="email" id="sup-email" required placeholder="vendor@domain.com" class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Phone</label>
                            <input type="text" id="sup-phone" required placeholder="+1 (555) 000-0000" class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Category</label>
                        <input type="text" id="sup-category" required placeholder="e.g. Electronics, Office Furniture" class="w-full text-xs p-3 border border-slate-300 rounded-lg">
                    </div>

                    <div class="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                        <button type="button" data-command="closeModal" class="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm">Save Supplier</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}
