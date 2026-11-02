import type { ProcurementRecord, ProcurementState } from '../types/procurement';

/** Keep the existing 100-point evaluation policy. */
export const BID_EVALUATION_WEIGHTS = {
  price: 35,
  delivery: 20,
  compliance: 25,
  warranty: 10,
  performance: 10,
} as const;

export type ComplianceAssessment = 'Compliant' | 'Partially Compliant' | 'Non-Compliant';
export type SpecificationMatch = 'all-met' | 'minor-deviations' | 'critical-missing';
export type DurabilityAssessment = 'strong' | 'adequate' | 'concerns' | 'not-verified';
export type EvidenceAssessment = 'complete' | 'partial' | 'missing';
export type WarrantyCoverage = 'full' | 'limited' | 'none' | 'not-verified';

/** Stored in the existing bid.evaluation field; no database migration required. */
export interface BidReviewV2 {
  version: 2;
  specificationMatch: SpecificationMatch;
  durability: DurabilityAssessment;
  evidence: EvidenceAssessment;
  warrantyMonths: number | null;  // null means not verified, 0 explicitly means no warranty
  warrantyCoverage: WarrantyCoverage;
  comments: string;               // optional additional comments
  compliance: ComplianceAssessment; // included for legacy integrations
  reviewedBy: string;
  reviewedAt: string;
}

/** Older reviews remain readable and scored under their original method. */
export interface LegacyBidReview {
  compliance: ComplianceAssessment;
  warrantyMonths: number;
  remarks: string;
  reviewedBy: string;
  reviewedAt: string;
}
export type BidReview = BidReviewV2 | LegacyBidReview;

export interface BidScore {
  bid: ProcurementRecord;
  rank: number | null;
  status: 'ranked' | 'pending-review' | 'ineligible';
  reason?: string;
  total: number | null;
  breakdown: {
    price: number;
    delivery: number;
    compliance: number;
    warranty: number;
    performance: number;
  };
  performanceAverage: number | null;
  performanceCount: number;
  notes: string[];
}

const matchOptions: SpecificationMatch[] = ['all-met', 'minor-deviations', 'critical-missing'];
const durabilityOptions: DurabilityAssessment[] = ['strong', 'adequate', 'concerns', 'not-verified'];
const evidenceOptions: EvidenceAssessment[] = ['complete', 'partial', 'missing'];
const warrantyOptions: WarrantyCoverage[] = ['full', 'limited', 'none', 'not-verified'];
const validCompliance: ComplianceAssessment[] = ['Compliant', 'Partially Compliant', 'Non-Compliant'];
const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function complianceFromAnswer(answer: SpecificationMatch): ComplianceAssessment {
  return answer === 'all-met' ? 'Compliant' : answer === 'minor-deviations' ? 'Partially Compliant' : 'Non-Compliant';
}

/** Required multiple-choice answers. Written comments are optional. */
export function isValidBidReview(review: {
  specificationMatch: string;
  durability: string;
  evidence: string;
  warrantyMonths: number | null;
  warrantyCoverage: string;
  comments?: string;
}): string | null {
  if (!matchOptions.includes(review.specificationMatch as SpecificationMatch)) return 'Answer Question 1: mandatory specification compliance.';
  if (!durabilityOptions.includes(review.durability as DurabilityAssessment)) return 'Answer Question 2: durability or build quality.';
  if (!evidenceOptions.includes(review.evidence as EvidenceAssessment)) return 'Answer Question 3: quotation and supporting evidence.';
  if (review.warrantyMonths !== null &&
      (!Number.isInteger(review.warrantyMonths) || review.warrantyMonths < 0 || review.warrantyMonths > 120)) {
    return 'Choose a valid warranty period (0–120 months), or Not verified.';
  }
  if (!warrantyOptions.includes(review.warrantyCoverage as WarrantyCoverage)) return 'Answer Question 5: warranty coverage.';
  if (review.warrantyMonths === 0 && review.warrantyCoverage !== 'none' && review.warrantyCoverage !== 'not-verified') {
    return 'For a confirmed 0-month warranty, choose No warranty coverage.';
  }
  if (review.warrantyMonths !== null && review.warrantyMonths > 0 && review.warrantyCoverage === 'none') {
    return 'The stated warranty period and No warranty coverage contradict each other.';
  }
  if ((review.comments || '').length > 1000) return 'Optional comments must be 1,000 characters or fewer.';
  return null;
}

export function asReview(input: unknown): BidReview | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.reviewedBy !== 'string' || !value.reviewedBy || typeof value.reviewedAt !== 'string') return null;
  if (value.version === 2) {
    const review = input as BidReviewV2;
    return !isValidBidReview(review) ? review : null;
  }
  // Accept reviews recorded by the earlier text-field interface.
  const old = input as Partial<LegacyBidReview>;
  if (!validCompliance.includes(old.compliance as ComplianceAssessment) ||
    typeof old.warrantyMonths !== 'number' || !Number.isInteger(old.warrantyMonths) ||
    old.warrantyMonths < 0 || old.warrantyMonths > 120) return null;
  return input as LegacyBidReview;
}

function reviewState(review: BidReview | null): { status: 'ready' | 'pending' | 'ineligible'; reason?: string } {
  if (!review) return { status: 'pending', reason: 'Quotation survey has not been completed.' };
  if ('version' in review && review.version === 2) {
    if (review.specificationMatch === 'critical-missing') return { status: 'ineligible', reason: 'Mandatory technical requirements are not met.' };
    if (review.durability === 'not-verified' || review.evidence === 'missing' ||
        review.warrantyMonths === null || review.warrantyCoverage === 'not-verified') {
      return { status: 'pending', reason: 'Survey recorded; supporting specifications, durability, or warranty evidence still needs verification.' };
    }
  } else if (review.compliance === 'Non-Compliant') {
    return { status: 'ineligible', reason: 'Does not meet technical specifications.' };
  }
  return { status: 'ready' };
}

/** Price and lead comparisons only use verified eligible bids for the same need. */
export function scoreBidsForNeed(needId: string, state: ProcurementState): BidScore[] {
  const bids = state.bids.filter(bid => bid.needId === needId);
  const eligible = bids.filter(bid =>
    reviewState(asReview(bid.evaluation)).status === 'ready' &&
    Number.isFinite(Number(bid.totalCost)) && Number(bid.totalCost) > 0 &&
    Number.isFinite(Number(bid.leadTimeDays)) && Number(bid.leadTimeDays) > 0
  );
  const lowestPrice = eligible.length ? Math.min(...eligible.map(bid => Number(bid.totalCost))) : 0;
  const shortestLead = eligible.length ? Math.min(...eligible.map(bid => Number(bid.leadTimeDays))) : 0;
  const need = state.stockNeeds.find(item => item.id === needId);
  const maxBudget = Number(need?.budgetCap);

  const scores: BidScore[] = bids.map(bid => {
    const review = asReview(bid.evaluation);
    const verification = reviewState(review);
    const supplierRatings = state.ratings.filter(rating =>
      rating.supplierId === bid.supplierId && Number.isFinite(Number(rating.rating)) &&
      Number(rating.rating) >= 1 && Number(rating.rating) <= 5
    );
    const performanceCount = supplierRatings.length;
    const performanceAverage = performanceCount
      ? supplierRatings.reduce((sum, rating) => sum + Number(rating.rating), 0) / performanceCount
      : null;
    const notes: string[] = [];
    if (maxBudget > 0 && Number(bid.totalCost) > maxBudget) notes.push('Over approved budget cap');
    if (!performanceCount) notes.push('No rating history — neutral 3/5 used');

    const emptyBreakdown = { price: 0, delivery: 0, compliance: 0, warranty: 0, performance: 0 };
    if (verification.status !== 'ready') {
      return {
        bid, rank: null, status: verification.status === 'pending' ? 'pending-review' : 'ineligible',
        reason: verification.reason, total: null, breakdown: emptyBreakdown,
        performanceAverage, performanceCount, notes,
      };
    }
    const price = Number(bid.totalCost);
    const lead = Number(bid.leadTimeDays);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(lead) || lead <= 0) {
      return {
        bid, rank: null, status: 'ineligible', reason: 'A positive total price and lead time are required.',
        total: null, breakdown: emptyBreakdown, performanceAverage, performanceCount, notes,
      };
    }

    // review is guaranteed to be present when reviewState returns ready.
    const checked = review!;
    let complianceScore: number;
    let warrantyScore: number;
    if ('version' in checked && checked.version === 2) {
      const specificationFactors: Record<SpecificationMatch, number> = {
        'all-met': 1, 'minor-deviations': 0.55, 'critical-missing': 0,
      };
      const durabilityFactors: Record<DurabilityAssessment, number> = {
        strong: 1, adequate: 0.7, concerns: 0.25, 'not-verified': 0,
      };
      const evidenceFactors: Record<EvidenceAssessment, number> = {
        complete: 1, partial: 0.5, missing: 0,
      };
      const coverageFactors: Record<WarrantyCoverage, number> = {
        full: 1, limited: 0.6, none: 0, 'not-verified': 0,
      };
      // Inside the 25 compliance points: requirements 65%, build quality 20%, evidence 15%.
      complianceScore = round(BID_EVALUATION_WEIGHTS.compliance * (
        specificationFactors[checked.specificationMatch] * 0.65 +
        durabilityFactors[checked.durability] * 0.20 +
        evidenceFactors[checked.evidence] * 0.15
      ));
      warrantyScore = round(BID_EVALUATION_WEIGHTS.warranty *
        clamp((checked.warrantyMonths ?? 0) / 24, 0, 1) * coverageFactors[checked.warrantyCoverage]);
      if (checked.specificationMatch === 'minor-deviations') notes.push('Minor specification deviations — check conditions');
      if (checked.durability === 'concerns') notes.push('Durability concerns identified');
      if (checked.evidence === 'partial') notes.push('Some supporting evidence is incomplete');
      if (checked.warrantyCoverage === 'limited') notes.push('Limited warranty coverage');
    } else {
      const legacy = checked as LegacyBidReview;
      complianceScore = legacy.compliance === 'Compliant' ? BID_EVALUATION_WEIGHTS.compliance : BID_EVALUATION_WEIGHTS.compliance / 2;
      warrantyScore = round(BID_EVALUATION_WEIGHTS.warranty * clamp(legacy.warrantyMonths / 24, 0, 1));
      notes.push('Legacy manual review — use Edit review to complete the new questionnaire');
    }

    const breakdown = {
      price: round(BID_EVALUATION_WEIGHTS.price * clamp(lowestPrice / price, 0, 1)),
      delivery: round(BID_EVALUATION_WEIGHTS.delivery * clamp(shortestLead / lead, 0, 1)),
      compliance: complianceScore,
      warranty: warrantyScore,
      performance: round(BID_EVALUATION_WEIGHTS.performance * (performanceAverage ?? 3) / 5),
    };
    return {
      bid, rank: null, status: 'ranked',
      total: round(Object.values(breakdown).reduce((sum, value) => sum + value, 0)),
      breakdown, performanceAverage, performanceCount, notes,
    };
  });

  const ranked = scores.filter(score => score.status === 'ranked').sort((a, b) =>
    (b.total ?? 0) - (a.total ?? 0) ||
    Number(a.bid.totalCost) - Number(b.bid.totalCost) ||
    Number(a.bid.leadTimeDays) - Number(b.bid.leadTimeDays) ||
    String(a.bid.id).localeCompare(String(b.bid.id))
  );
  ranked.forEach((score, index) => { score.rank = index + 1; });
  const priority = { ranked: 0, 'pending-review': 1, ineligible: 2 };
  return scores.sort((a, b) =>
    priority[a.status] - priority[b.status] ||
    (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
    String(a.bid.id).localeCompare(String(b.bid.id))
  );
}
