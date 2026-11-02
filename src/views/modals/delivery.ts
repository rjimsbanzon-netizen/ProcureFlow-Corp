// @ts-nocheck
import { formatQuantity, displayUnit, formatQuantityRatio } from '../../domain/measurementUnits';
import { getRemainingOrderQuantity } from '../../domain/procurement';
import { isPhysicalPurchase } from '../../domain/procurementClassification';
import { DB, ui } from '../../store/state';

// Initial checklist is a preliminary screening, not a final acceptance.
const initialInspectionQuestions = [
    {
        id: 'quantity',
        label: 'Does the received quantity match the supplier delivery receipt?'
    },
    {
        id: 'condition',
        label: 'Are the items and packaging free from visible damage?'
    },
    {
        id: 'specifications',
        label: 'Do the model and visible specifications match the purchase order?'
    },
    {
        id: 'accessories',
        label: 'Are the required accessories and components included?'
    },
    {
        id: 'functionality',
        label: 'Have the items been tested and found functional?'
    }
];

const serviceChecklist = [
 {id:'quantity',label:'Are the completed service units or milestones consistent with the report?'},
 {id:'condition',label:'Is the work quality acceptable and free of unresolved defects?'},
 {id:'specifications',label:'Does the work meet the agreed scope and technical specifications?'},
 {id:'accessories',label:'Have required reports, deliverables and supporting documents been provided?'},
 {id:'functionality',label:'Has the work, outcome, or service functionality been verified?'},
];
export function renderRecordDeliveryModal() {
    const order = DB.orders.find(o => o.id === ui.selectedRecord);
    const remainingQty = getRemainingOrderQuantity(ui.selectedRecord);
    const physical = isPhysicalPurchase(order?.purchaseCategory);
    const checklist = physical ? initialInspectionQuestions : serviceChecklist;
    if (!order || !['Approved & Signed', 'Issued'].includes(order.status) || remainingQty < 1) return '';

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">${physical ? 'Log Incoming Shipment' : 'Record Service / Work Completion'}</h3>
                        <p class="text-xs text-slate-500 mt-1">${physical ? 'Record delivery details and complete the initial checklist.' : 'Record completed services or works and the evidence of acceptance.'}</p>
                    </div>
                    <button type="button" data-command="closeModal" class="text-slate-400 hover:text-slate-600" aria-label="Close">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form id="record-delivery-form" class="space-y-4">
                    <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                        <p class="font-bold text-slate-800">${order.id}: ${order.itemTitle}</p>
                        <p class="text-slate-500 mt-0.5">Vendor: ${order.supplierName} &bull; Ordered Qty: ${formatQuantity(order.quantity, order.unit)}</p>
                        <p class="text-slate-500 mt-1">${physical ? 'Remaining Qty to receive' : 'Outstanding service / work units'}: ${formatQuantity(remainingQty, order.unit)}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label for="del-qty" class="block text-xs font-semibold uppercase text-slate-600 mb-1">${physical ? 'Delivered Qty' : 'Completed Qty'} (${displayUnit(order.unit)})</label>
                            <input type="number" id="del-qty" min="1" max="${remainingQty}" value="${remainingQty}" required class="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div>
                            <label for="del-date" class="block text-xs font-semibold uppercase text-slate-600 mb-1">${physical ? 'Delivery Date' : 'Completion Date'}</label>
                            <input type="date" id="del-date" required class="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                        </div>
                    </div>

                    <section aria-labelledby="del-inspection-heading" class="space-y-3">
                        <div>
                            <h4 id="del-inspection-heading" class="font-bold text-sm text-slate-800">${physical ? 'Initial Inspection Checklist' : 'Service Completion Checklist'}</h4>
                            <p class="text-xs text-slate-500 mt-1">Choose Yes, No, or Not Checked for each item. The final technical inspection is completed separately.</p>
                        </div>
                        ${checklist.map((question, index) => `
                            <fieldset class="rounded-xl border border-slate-200 px-3 py-3 bg-white">
                                <legend class="px-1 text-xs font-semibold text-slate-700">${index + 1}. ${question.label}</legend>
                                <div class="flex flex-wrap items-center gap-x-5 gap-y-2 mt-1">
                                    <label class="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                        <input type="radio" name="del-check-${question.id}" value="yes" required class="accent-emerald-600"> Yes
                                    </label>
                                    <label class="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                        <input type="radio" name="del-check-${question.id}" value="no" required class="accent-rose-600"> No
                                    </label>
                                    <label class="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                        <input type="radio" name="del-check-${question.id}" value="unchecked" required class="accent-slate-500"> Not Checked
                                    </label>
                                </div>
                            </fieldset>
                        `).join('')}
                    </section>

                    <div>
                        <label for="del-notes" class="block text-xs font-semibold uppercase text-slate-600 mb-1">Additional Inspection Notes <span class="normal-case font-normal text-slate-400">(Optional)</span></label>
                        <textarea id="del-notes" rows="2" placeholder="Describe missing items, visible damage, delivery slip numbers, or other observations..." class="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"></textarea>
                    </div>

                    <div class="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button type="button" data-command="closeModal" class="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm">${physical ? 'Save Delivery Record' : 'Save Completion Report'}</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// This existing final technical inspection step is intentionally unchanged.
export function renderInspectDeliveryModal() {
    const delivery = DB.deliveries.find(d => d.id === ui.selectedRecord);
    if (!delivery) return '';
    const physical = isPhysicalPurchase(delivery.purchaseCategory || DB.orders.find(o=>o.id===delivery.poId)?.purchaseCategory);
    const checklist = physical ? initialInspectionQuestions : serviceChecklist;

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <h3 class="font-bold text-slate-800 text-lg">${physical ? 'Technical Inspection & Verification' : 'Service / Work Acceptance & Verification'}</h3>
                    <button data-command="closeModal" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <form id="inspect-delivery-form" class="space-y-4">
                    <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                        <p class="font-bold text-slate-800">${delivery.poId}: ${delivery.itemTitle}</p>
                        <p class="text-slate-500">${physical ? 'Delivered' : 'Completed'}: ${formatQuantityRatio(delivery.deliveredQty, delivery.orderedQty, delivery.unit || DB.orders.find(o => o.id === delivery.poId)?.unit)}</p>
                        <p class="text-slate-600 font-medium">Specs: ${delivery.specs}</p>
                    </div>

                    ${delivery.initialInspection ? `
                        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                            <p class="text-xs font-bold text-slate-700 uppercase">${physical ? 'Initial Shipment Checklist' : 'Initial Service Checklist'}</p>
                            ${checklist.map(question => {
                                const answer = delivery.initialInspection[question.id] || 'unchecked';
                                const label = answer === 'yes' ? 'Yes' : answer === 'no' ? 'No' : 'Not Checked';
                                const color = answer === 'yes' ? 'text-emerald-700' : answer === 'no' ? 'text-rose-700' : 'text-amber-700';
                                return `<div class="flex justify-between gap-3 text-xs">
                                    <span class="text-slate-600">${question.label}</span>
                                    <span class="shrink-0 font-semibold ${color}">${label}</span>
                                </div>`;
                            }).join('')}
                        </div>
                    ` : ''}

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Inspection Outcome</label>
                        <select id="inspect-status" class="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500">
                            <option value="Completed - Verified">${physical ? 'Completed - Verified (All Items Conform to Specs)' : 'Completed - Verified (Service / Work Accepted)'}</option>
                            <option value="Issue Flagged - Quantity Shortage">${physical ? 'Issue Flagged - Quantity Shortage' : 'Issue Flagged - Work / Deliverable Shortfall'}</option>
                            <option value="Issue Flagged - Damaged / Defective Goods">${physical ? 'Issue Flagged - Damaged / Defective Goods' : 'Issue Flagged - Defective / Unsatisfactory Work'}</option>
                            <option value="Non-Compliant Specifications">Non-Compliant Specifications</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Inspection & Verification Remarks</label>
                        <textarea id="inspect-remarks" rows="3" required placeholder="Detailed verification report, test results, serial numbers..." class="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"></textarea>
                    </div>

                    <div class="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                        <button type="button" data-command="closeModal" class="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm">Submit Inspection Log</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}
