// @ts-nocheck
import { formatQuantity } from '../../domain/measurementUnits';
import { DB, ui } from '../../store/state';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

/** Standardized quotation format: the supplier selects explicit terms that procurement can compare. */
export function renderSubmitBidModal() {
  const need = DB.stockNeeds.find(item => item.id === ui.selectedRecord);
  if (!need || need.status !== 'Published') return '';
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3 sm:p-4">
      <div class="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-widest text-sky-700">Standard Supplier Quotation & Clauses</p>
            <h3 class="mt-1 text-lg font-bold text-slate-900">Submit Proposal Bid</h3>
            <p class="mt-1 text-xs text-slate-500">${escapeHtml(need.title)} · ${escapeHtml(need.id)}</p>
          </div>
          <button type="button" data-command="closeModal" aria-label="Close bid form" class="rounded p-1 text-slate-500 hover:bg-slate-200"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="submit-bid-form" class="flex min-h-0 flex-1 flex-col">
          <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
            <div class="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
              The information below becomes part of your bid and will be automatically summarized for Procurement and Admin.
              Claims will still be checked against the official quotation and product evidence before supplier selection.
            </div>
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
              <p><strong>Required quantity:</strong> ${formatQuantity(need.targetQty, need.unit)}</p>
              <p><strong>Maximum budget:</strong> ₱${Number(need.budgetCap || 0).toLocaleString('en-PH')}</p>
              <p><strong>Required specifications:</strong> ${escapeHtml(need.techSpecs)}</p>
            </div>
            <fieldset class="space-y-3">
              <legend class="text-sm font-bold text-slate-900">1. Pricing and Delivery</legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="text-xs font-semibold text-slate-700">Price (PHP per ${formatQuantity(1, need.unit).replace(/^1 /, '')}) *
                  <input id="bid-unit-price" type="number" min="0.01" step="0.01" required placeholder="e.g. 1200" class="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal"/>
                </label>
                <label class="text-xs font-semibold text-slate-700">Lead time (calendar days) *
                  <input id="bid-lead-time" type="number" min="1" max="365" step="1" required placeholder="e.g. 10" class="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal"/>
                </label>
                <label class="text-xs font-semibold text-slate-700 sm:col-span-2">Delivery commitment *
                  <select id="bid-delivery-commitment" required class="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-normal">
                    <option value="" disabled selected>Choose a delivery clause</option>
                    <option value="firm">Firm delivery within the stated lead time</option>
                    <option value="estimated">Estimated lead time only</option>
                    <option value="conditional">Subject to stock availability / other conditions</option>
                  </select>
                </label>
              </div>
              <p class="text-xs text-slate-500"><strong>Calculated total:</strong> <span id="bid-total-preview">Enter a unit price</span></p>
            </fieldset>
            <fieldset class="space-y-3 border-t border-slate-200 pt-4">
              <legend class="text-sm font-bold text-slate-900">2. Offered Item & Technical Compliance</legend>
              <label class="block text-xs font-semibold text-slate-700">Brand / model / exact product identifier *
                <input id="bid-offered-model" maxlength="160" minlength="2" required placeholder="e.g. Dell OptiPlex 7010 SFF, i5 / 16GB / 512GB SSD" class="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal"/>
              </label>
              <label class="block text-xs font-semibold text-slate-700">Supplier declaration for required specifications *
                <select id="bid-specification-claim" required class="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-normal">
                  <option value="" disabled selected>Select compliance statement</option>
                  <option value="fully-compliant">All mandatory specifications are met</option>
                  <option value="minor-deviations">Minor deviations — details below</option>
                  <option value="non-compliant">At least one mandatory requirement is not met</option>
                </select>
              </label>
              <label class="block text-xs font-semibold text-slate-700">Exceptions or alternative specifications
                <textarea id="bid-specification-exceptions" maxlength="1000" rows="2" placeholder="Required when selecting deviations. List which requested requirements differ." class="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal"></textarea>
              </label>
            </fieldset>
            <fieldset class="space-y-3 border-t border-slate-200 pt-4">
              <legend class="text-sm font-bold text-slate-900">3. Warranty, Replacements & Support</legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="text-xs font-semibold text-slate-700">Warranty period (months) *
                  <input id="bid-warranty-months" type="number" min="0" max="120" step="1" required placeholder="0 if none" class="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal"/>
                </label>
                <label class="text-xs font-semibold text-slate-700">Warranty coverage *
                  <select id="bid-warranty-coverage" required class="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-normal">
                    <option value="" disabled selected>Select written coverage</option>
                    <option value="parts-labor">Parts and labor</option>
                    <option value="limited">Limited parts or services</option>
                    <option value="none">No warranty</option>
                  </select>
                </label>
                <label class="text-xs font-semibold text-slate-700">Replacement / return period *
                  <select id="bid-replacement-days" required class="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-normal">
                    <option value="" disabled selected>Choose clause</option>
                    <option value="0">No replacement period offered</option>
                    <option value="7">7 days after receipt</option>
                    <option value="14">14 days after receipt</option>
                    <option value="30">30 days after receipt</option>
                  </select>
                </label>
                <label class="text-xs font-semibold text-slate-700">After-sales support *
                  <select id="bid-after-sales-support" required class="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-normal">
                    <option value="" disabled selected>Choose support clause</option>
                    <option value="included">Included</option>
                    <option value="limited">Limited support</option>
                    <option value="none">No support included</option>
                  </select>
                </label>
              </div>
              <label class="block text-xs font-semibold text-slate-700">Warranty / repair service process (optional)
                <input id="bid-warranty-service" maxlength="500" placeholder="Service center, claim requirements, exclusions, etc." class="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal"/>
              </label>
            </fieldset>
            <fieldset class="space-y-3 border-t border-slate-200 pt-4">
              <legend class="text-sm font-bold text-slate-900">4. Commercial Terms & Additional Clauses</legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="text-xs font-semibold text-slate-700">Proposed payment terms *
                  <select id="bid-payment-condition" required class="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-normal">
                    <option value="" disabled selected>Choose payment clause</option>
                    <option value="after-acceptance">After delivery and acceptance</option>
                    <option value="net-15">15 days after accepted invoice</option>
                    <option value="net-30">30 days after accepted invoice</option>
                    <option value="advance-required">Advance payment requested</option>
                  </select>
                </label>
                <label class="text-xs font-semibold text-slate-700">Quotation validity (days) *
                  <input id="bid-validity-days" type="number" min="1" max="365" step="1" value="30" required class="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal"/>
                </label>
              </div>
              <label class="block text-xs font-semibold text-slate-700">Quotation / datasheet reference (optional)
                <input id="bid-supporting-reference" maxlength="160" placeholder="e.g. QTN-2026-014, datasheet filename, document ID" class="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal"/>
              </label>
              <label class="block text-xs font-semibold text-slate-700">Additional contractual clauses / exclusions (optional)
                <textarea id="bid-additional-clauses" rows="2" maxlength="1000" placeholder="Any exclusions, installation terms, required deposits, or special conditions" class="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal"></textarea>
              </label>
              <label class="block text-xs font-semibold text-slate-700">Other product notes (optional)
                <textarea id="bid-notes" rows="2" maxlength="1000" placeholder="Summary of product, accessories, or service inclusions" class="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm font-normal"></textarea>
              </label>
            </fieldset>
            <label class="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
              <input id="bid-terms-confirm" type="checkbox" required class="mt-1 accent-sky-600"/>
              <span>I confirm that the quotation details and terms above accurately describe my company's offer. Procurement will independently verify them. These are proposed terms, subject to final written agreement and Purchase Order.</span>
            </label>
          </div>
          <div class="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white p-4">
            <button type="button" data-command="closeModal" class="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" class="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Submit Quotation & Clauses</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
