import type { ProcurementRecord } from '../types/procurement';

/** Versioned, structured supplier declarations. Stored on bid.quotationTerms within the existing cloud snapshot. */
export interface SupplierQuotationTerms {
  version: 1;
  offeredModel: string;
  specificationClaim: 'fully-compliant' | 'minor-deviations' | 'non-compliant';
  specificationExceptions: string;
  deliveryCommitment: 'firm' | 'estimated' | 'conditional';
  warrantyMonths: number;
  warrantyCoverage: 'parts-labor' | 'limited' | 'none';
  warrantyService: string;
  replacementDays: 0 | 7 | 14 | 30;
  paymentCondition: 'after-acceptance' | 'net-15' | 'net-30' | 'advance-required';
  validityDays: number;
  afterSalesSupport: 'included' | 'limited' | 'none';
  supportingReference: string;
  additionalClauses: string;
  supplierDeclaration: true;
}

export type ClauseSeverity = 'high' | 'review' | 'info';
export interface ClauseFinding { severity: ClauseSeverity; title: string; detail: string }

const isText = (v: unknown, min: number, max: number) =>
  typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
const isOneOf = (v: unknown, choices: readonly string[]) => typeof v === 'string' && choices.includes(v);
const intWithin = (v: unknown, min: number, max: number) => Number.isInteger(v) && Number(v) >= min && Number(v) <= max;

/** Validate at the supplier submission boundary. The declaration is not a staff compliance finding. */
export function validateSupplierQuotationTerms(input: unknown): string | null {
  if (!input || typeof input !== 'object') return 'Complete the structured quotation terms.';
  const q = input as Partial<SupplierQuotationTerms>;
  if (q.version !== 1) return 'The quotation format is out of date. Please reopen the bid form.';
  if (!isText(q.offeredModel, 2, 160)) return 'Enter the offered brand, model, and product identifier (2–160 characters).';
  if (!isOneOf(q.specificationClaim, ['fully-compliant','minor-deviations','non-compliant'])) return 'Select a specification compliance declaration.';
  if (!isText(q.specificationExceptions, q.specificationClaim === 'fully-compliant' ? 0 : 4, 1000))
    return 'Describe any specification exceptions (4–1,000 characters), or leave blank when fully compliant.';
  if (!isOneOf(q.deliveryCommitment, ['firm','estimated','conditional'])) return 'Choose a delivery commitment.';
  if (!intWithin(q.warrantyMonths, 0, 120)) return 'Enter a warranty period from 0 to 120 whole months.';
  if (!isOneOf(q.warrantyCoverage, ['parts-labor','limited','none'])) return 'Choose the written warranty coverage.';
  if ((q.warrantyMonths === 0) !== (q.warrantyCoverage === 'none'))
    return 'Warranty period and coverage disagree: zero months must mean No warranty.';
  if (!isText(q.warrantyService, 0, 500)) return 'Warranty service details must be 500 characters or fewer.';
  if (![0,7,14,30].includes(Number(q.replacementDays))) return 'Choose the replacement or return period.';
  if (!isOneOf(q.paymentCondition, ['after-acceptance','net-15','net-30','advance-required'])) return 'Choose the proposed payment condition.';
  if (!intWithin(q.validityDays, 1, 365)) return 'Quotation validity must be 1–365 whole days.';
  if (!isOneOf(q.afterSalesSupport, ['included','limited','none'])) return 'Choose the after-sales support terms.';
  if (!isText(q.supportingReference, 0, 160)) return 'The document or quote reference must be 160 characters or fewer.';
  if (!isText(q.additionalClauses, 0, 1000)) return 'Additional clauses must be 1,000 characters or fewer.';
  if (q.supplierDeclaration !== true) return 'Confirm the accuracy of the quotation declarations before submission.';
  return null;
}

/** Treat older/free-text bids as legacy rather than making up structured details. */
export function getSupplierQuotationTerms(bid: ProcurementRecord): SupplierQuotationTerms | null {
  const terms = bid.quotationTerms;
  return !validateSupplierQuotationTerms(terms) ? terms as SupplierQuotationTerms : null;
}

/** Deterministic clause detection: checks structured supplier statements, not proof of compliance. */
export function detectSupplierClauseFindings(bid: ProcurementRecord, need?: ProcurementRecord | null): ClauseFinding[] {
  const q = getSupplierQuotationTerms(bid);
  if (!q) return [{ severity: 'info', title: 'Legacy quotation', detail: 'No structured clauses submitted. Review the original notes/quotation manually.' }];
  const findings: ClauseFinding[] = [];
  const add = (severity: ClauseSeverity, title: string, detail: string) => findings.push({ severity, title, detail });
  const budget = Number(need?.budgetCap);
  if (Number.isFinite(budget) && budget > 0 && Number(bid.totalCost) > budget)
    add('high', 'Above budget cap', 'The quoted total is higher than the published budget.');
  if (q.specificationClaim === 'non-compliant')
    add('high', 'Supplier declares a specification failure', 'Review the disclosed exceptions and mandatory requirements before selection.');
  else if (q.specificationClaim === 'minor-deviations')
    add('review', 'Specification exceptions declared', 'Check the exact deviations against the purchase specification.');
  if (q.deliveryCommitment !== 'firm')
    add('review', 'Delivery timing is not firm', q.deliveryCommitment === 'conditional' ? 'Delivery depends on conditions/stock availability.' : 'The lead time is only an estimate.');
  if (q.warrantyMonths === 0)
    add('high', 'No written warranty', 'The supplier offers no warranty period.');
  else if (q.warrantyMonths < 12)
    add('review', 'Short warranty', `Only ${q.warrantyMonths} month(s) declared.`);
  if (q.warrantyCoverage === 'limited') add('review', 'Limited warranty coverage', 'Check covered parts/services and exclusions.');
  if (q.paymentCondition === 'advance-required') add('high', 'Advance payment requested', 'Finance must review the proposed prepayment before any agreement.');
  if (q.replacementDays === 0) add('review', 'No replacement window', 'The supplier states no defined replacement or return period.');
  if (q.afterSalesSupport === 'none') add('review', 'No after-sales support', 'Post-delivery support is excluded.');
  if (q.validityDays < 7) add('review', 'Quotation expires soon', `The offer is valid for only ${q.validityDays} day(s) from submission.`);
  if (!q.supportingReference.trim()) add('info', 'No supporting document reference', 'Verify supporting documents before completing the technical review.');
  return findings;
}

export const BID_CLAUSE_LABELS = {
  specificationClaim: { 'fully-compliant': 'All requirements claimed met', 'minor-deviations': 'Minor deviations declared', 'non-compliant': 'Mandatory requirement not met' },
  deliveryCommitment: { firm: 'Firm lead time', estimated: 'Estimated lead time', conditional: 'Subject to availability or conditions' },
  warrantyCoverage: { 'parts-labor': 'Parts and labor', limited: 'Limited coverage', none: 'No warranty' },
  paymentCondition: { 'after-acceptance': 'After accepted delivery', 'net-15': '15 days after accepted invoice', 'net-30': '30 days after accepted invoice', 'advance-required': 'Advance payment requested' },
  afterSalesSupport: { included: 'Included', limited: 'Limited', none: 'Not included' },
} as const;
