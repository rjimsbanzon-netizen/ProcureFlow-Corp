import { displayUnit } from '../../domain/measurementUnits';
// @ts-nocheck
import { getAvailableRequisitions } from '../../domain/procurement';
import { ui } from '../../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderCreateStockNeedModal() {
    const availablePRs = getAvailableRequisitions();
    const preferredPR = availablePRs.find(pr => pr.id === ui.selectedRecord) || availablePRs[0];
    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <h3 class="font-bold text-slate-800 text-lg">Publish Procurement Requirement for Bidding</h3>
                    <button data-command="closeModal" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <form id="create-stock-need-form" class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Approved Purchase Request</label>
                        <select id="sn-pr-id" required class="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500" ${availablePRs.length === 0 ? 'disabled' : ''}>
                            ${availablePRs.length === 0 ? '<option value="">No approved requests available</option>' : availablePRs.map(pr => `
                                <option value="${pr.id}" ${preferredPR?.id === pr.id ? 'selected' : ''}>${pr.id} — ${pr.itemTitle}</option>
                            `).join('')}
                        </select>
                        ${availablePRs.length === 0 ? '<p class="mt-1 text-xs text-rose-600">Approve a purchase request before publishing its procurement need.</p>' : ''}
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Requirement Title</label>
                        <input type="text" id="sn-title" required readonly value="${preferredPR?.itemTitle || ''}" placeholder="Select an approved request" class="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500">
                    </div>

                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                            <label id="sn-qty-label" class="block text-xs font-semibold uppercase text-slate-600 mb-1">Target Quantity (${displayUnit(preferredPR?.unit)})</label>
                            <input type="number" id="sn-qty" min="1" required readonly value="${preferredPR?.quantity || ''}" placeholder="Select request" class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                        <div>
                            <label for="sn-unit" class="block text-xs font-semibold uppercase text-slate-600 mb-1">Unit of Measurement</label>
                            <input id="sn-unit" type="text" readonly value="${preferredPR?.unit || 'units'}" class="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-slate-50" title="Inherited from the approved purchase requisition">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Budget Cap (₱ PHP)</label>
                            <input type="number" id="sn-budget" min="0" step="0.01" required readonly value="${preferredPR?.totalCost || ''}" placeholder="Select request" class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Technical Specifications & Requirements</label>
                        <textarea id="sn-specs" rows="4" required readonly placeholder="Select an approved request" class="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500">${preferredPR?.specs || ''}</textarea>
                    </div>

                    <div class="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                        <button type="button" data-command="closeModal" class="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                        <button type="submit" ${availablePRs.length === 0 ? 'disabled' : ''} class="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm">Publish Need for Bidding</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}
