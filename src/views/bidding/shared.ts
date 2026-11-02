// @ts-nocheck
import { BID_CLAUSE_LABELS, getSupplierQuotationTerms } from '../../domain/bidTerms';

// Escape supplier-authored text before rendering it in this legacy HTML view.
export const safeBidText = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function renderSupplierQuotationReceipt(bid) {
    const terms = getSupplierQuotationTerms(bid);
    if (!terms) return '';
    return `<details class="rounded-lg border border-sky-100 bg-sky-50 p-3 text-xs text-slate-700">
      <summary class="cursor-pointer font-semibold text-sky-800">View my submitted terms & clauses</summary>
      <div class="mt-3 grid gap-2 leading-5">
        <p><strong>Offered model:</strong> ${safeBidText(terms.offeredModel)}</p>
        <p><strong>Specifications:</strong> ${safeBidText(BID_CLAUSE_LABELS.specificationClaim[terms.specificationClaim])}</p>
        ${terms.specificationExceptions ? `<p><strong>Exceptions:</strong> ${safeBidText(terms.specificationExceptions)}</p>` : ''}
        <p><strong>Delivery:</strong> ${safeBidText(BID_CLAUSE_LABELS.deliveryCommitment[terms.deliveryCommitment])}</p>
        <p><strong>Warranty:</strong> ${terms.warrantyMonths} months · ${safeBidText(BID_CLAUSE_LABELS.warrantyCoverage[terms.warrantyCoverage])}</p>
        <p><strong>Replacements:</strong> ${terms.replacementDays ? terms.replacementDays + ' days' : 'Not offered'}</p>
        <p><strong>Payment:</strong> ${safeBidText(BID_CLAUSE_LABELS.paymentCondition[terms.paymentCondition])}</p>
        <p><strong>Quotation validity:</strong> ${terms.validityDays} days</p>
        <p><strong>After-sales support:</strong> ${safeBidText(BID_CLAUSE_LABELS.afterSalesSupport[terms.afterSalesSupport])}</p>
        ${terms.warrantyService ? `<p><strong>Warranty service:</strong> ${safeBidText(terms.warrantyService)}</p>` : ''}
        ${terms.additionalClauses ? `<p><strong>Other clauses:</strong> ${safeBidText(terms.additionalClauses)}</p>` : ''}
        <p class="text-[11px] text-slate-500">These are your submitted proposed terms; final accepted terms are determined by the signed agreement and PO.</p>
      </div>
    </details>`;
}

