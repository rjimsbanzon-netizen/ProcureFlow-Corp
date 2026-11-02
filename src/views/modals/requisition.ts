import { measurementUnitOptionsHtml } from '../../domain/measurementUnits';
// @ts-nocheck

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderCreatePRModal() {
    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <h3 class="font-bold text-slate-800 text-lg">New Purchase Requisition</h3>
                    <button data-command="closeModal" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <form id="create-pr-form" class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Item Title / Description</label>
                        <input type="text" id="pr-title" required placeholder="e.g. Server Rack Equipment" class="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500">
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Specifications & Requirements</label>
                        <textarea id="pr-specs" rows="3" required placeholder="Detailed dimensions, specifications, brand..." class="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"></textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                            <label for="pr-qty" id="pr-qty-label" class="block text-xs font-semibold uppercase text-slate-600 mb-1">Quantity (units)</label>
                            <input type="number" id="pr-qty" min="1" step="1" value="1" required class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                        <div>
                            <label for="pr-unit" class="block text-xs font-semibold uppercase text-slate-600 mb-1">Unit of Measurement</label>
                            <input id="pr-unit-search" type="search" autocomplete="off" placeholder="Search unit or type…" aria-label="Search units of measurement" class="mb-1.5 w-full text-sm p-2.5 border border-slate-300 rounded-lg" />
                            <select id="pr-unit" required aria-label="Select unit of measurement" class="w-full text-sm p-2.5 border border-slate-300 rounded-lg">
                                ${measurementUnitOptionsHtml()}
                            </select>
                        </div>
                        <div>
                            <label id="pr-price-label" class="block text-xs font-semibold uppercase text-slate-600 mb-1">Est. Price (₱ per units)</label>
                            <input type="number" id="pr-price" min="0" step="0.01" required class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Target Needed</label>
                            <input type="date" id="pr-date" required class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Remarks / Justification</label>
                        <input type="text" id="pr-remarks" placeholder="Purpose for procurement request" class="w-full text-xs p-3 border border-slate-300 rounded-lg">
                    </div>

                    <div class="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                        <button type="button" data-command="closeModal" class="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm">Submit Requisition</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}
