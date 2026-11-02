// @ts-nocheck
import { closeModal } from '../../actions/modalActions';
import { DB, ui } from '../../store/state';
import { renderStarRatingHTML } from '../suppliers';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderRateSupplierModal() {
    const supplierId = typeof ui.selectedRecord === 'object' ? ui.selectedRecord.supplierId : ui.selectedRecord;
    const poId = typeof ui.selectedRecord === 'object' ? ui.selectedRecord.poId : null;
    const supplier = DB.suppliers.find(s => s.id === supplierId);
    if (!supplier || !poId) return '';

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">Evaluate Vendor</h3>
                        <p class="text-xs text-slate-500">${supplier.name} &bull; Completed transaction ${poId}</p>
                    </div>
                    <button data-command="closeModal" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <form id="rate-supplier-form" class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Overall Rating (1 to 5 Stars)</label>
                        <div class="flex items-center space-x-2 text-2xl text-amber-400 star-rating" id="star-picker">
                            <i class="fa-regular fa-star" data-star="1"></i>
                            <i class="fa-regular fa-star" data-star="2"></i>
                            <i class="fa-regular fa-star" data-star="3"></i>
                            <i class="fa-regular fa-star" data-star="4"></i>
                            <i class="fa-regular fa-star" data-star="5"></i>
                        </div>
                        <input type="hidden" id="rating-value" value="5">
                    </div>

                    <div class="grid grid-cols-3 gap-3">
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Quality Score</label>
                            <select id="score-quality" class="w-full text-xs p-2 border border-slate-300 rounded-lg">
                                <option value="5">5 - Excellent</option>
                                <option value="4">4 - Good</option>
                                <option value="3">3 - Satisfactory</option>
                                <option value="2">2 - Poor</option>
                                <option value="1">1 - Failed</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Delivery Speed</label>
                            <select id="score-delivery" class="w-full text-xs p-2 border border-slate-300 rounded-lg">
                                <option value="5">5 - On Time</option>
                                <option value="4">4 - Minor Delay</option>
                                <option value="3">3 - Delayed</option>
                                <option value="2">2 - Late</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Pricing Competence</label>
                            <select id="score-pricing" class="w-full text-xs p-2 border border-slate-300 rounded-lg">
                                <option value="5">5 - Competitive</option>
                                <option value="4">4 - Fair</option>
                                <option value="3">3 - High</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Evaluation & Feedback Remarks</label>
                        <textarea id="rating-feedback" rows="3" required placeholder="Describe product quality, compliance, packaging, and service level..." class="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"></textarea>
                    </div>

                    <div class="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                        <button type="button" data-command="closeModal" class="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm">Submit Vendor Rating</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}


export function renderViewRatingsModal() {
    const supplier = DB.suppliers.find(s => s.id === ui.selectedRecord);
    if (!supplier) return '';

    const reviews = DB.ratings.filter(r => r.supplierId === supplier.id);

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">Vendor Evaluation History</h3>
                        <p class="text-xs text-slate-500">${supplier.name}</p>
                    </div>
                    <button data-command="closeModal" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <div class="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                    ${reviews.length === 0 ? `
                        <div class="text-center py-8 text-slate-400 text-xs">No evaluation records for this supplier yet.</div>
                    ` : reviews.map(r => `
                        <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <div class="flex justify-between items-start">
                                <div>
                                    <div class="font-bold text-slate-800 text-sm">${r.evaluatorName}</div>
                                    <div class="text-xs text-sky-600 font-medium">${r.evaluatorRole} &bull; ${r.createdAt}</div>
                                </div>
                                <div class="text-amber-400 text-sm">
                                    ${renderStarRatingHTML(r.rating)}
                                </div>
                            </div>
                            <p class="text-xs text-slate-700 leading-relaxed">${r.feedback}</p>
                            <div class="flex space-x-4 text-xs text-slate-500 border-t border-slate-200 pt-2 mt-2">
                                <span>Quality: <b>${r.qualityScore}/5</b></span>
                                <span>Delivery: <b>${r.deliveryScore}/5</b></span>
                                <span>Pricing: <b>${r.pricingScore}/5</b></span>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="mt-4 pt-3 border-t border-slate-100 text-right">
                    <button data-command="closeModal" class="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg">Close</button>
                </div>
            </div>
        </div>
    `;
}
