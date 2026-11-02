import { useState, type FormEvent } from 'react';
import { DB } from '../store/state';
import { BID_CLAUSE_LABELS, detectSupplierClauseFindings, getSupplierQuotationTerms } from '../domain/bidTerms';
import { canManageBidding } from '../domain/permissions';
import { renderApp } from '../core/renderBridge';
import { logAudit } from '../services/audit';
import { showToast } from '../services/toast';
import {
  BID_EVALUATION_WEIGHTS,
  isValidBidReview,
  scoreBidsForNeed,
  complianceFromAnswer,
  type BidReviewV2,
  type SpecificationMatch,
  type DurabilityAssessment,
  type EvidenceAssessment,
  type WarrantyCoverage,
  type BidScore,
} from '../domain/bidEvaluation';

// App.tsx remounts its shell after save; retain the last opened need locally.
let lastViewedNeedId = '';

const currency = (amount: unknown) => Number(amount || 0).toLocaleString('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2,
});

const CRITERIA = [
  { label: 'Price', key: 'price' as const, weight: BID_EVALUATION_WEIGHTS.price },
  { label: 'Lead time', key: 'delivery' as const, weight: BID_EVALUATION_WEIGHTS.delivery },
  { label: 'Specifications', key: 'compliance' as const, weight: BID_EVALUATION_WEIGHTS.compliance },
  { label: 'Warranty', key: 'warranty' as const, weight: BID_EVALUATION_WEIGHTS.warranty },
  { label: 'Performance', key: 'performance' as const, weight: BID_EVALUATION_WEIGHTS.performance },
];

function ScoreChip({ result }: { result: BidScore }) {
  if (result.status === 'pending-review') {
    return <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Needs verification</span>;
  }
  if (result.status === 'ineligible') {
    return <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">Not eligible</span>;
  }
  return <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800">{result.total?.toFixed(1)} / 100</span>;
}

/** These are supplier-provided proposed clauses, not independently verified contract terms. */
function SupplierClauseSummary({ bid, need, insideReview = false }: {
  bid: { id: string; [key: string]: any };
  need?: { id: string; [key: string]: any };
  insideReview?: boolean;
}) {
  const terms = getSupplierQuotationTerms(bid);
  const findings = detectSupplierClauseFindings(bid, need);
  const attention = findings.filter(item => item.severity !== 'info');
  const high = findings.some(item => item.severity === 'high');
  const labels = BID_CLAUSE_LABELS;
  const clauseList = terms ? [
    ['Offered model', terms.offeredModel],
    ['Specifications claimed', labels.specificationClaim[terms.specificationClaim]],
    ['Differences / alternatives', terms.specificationExceptions || 'None declared'],
    ['Delivery commitment', `${labels.deliveryCommitment[terms.deliveryCommitment]} · ${bid.leadTimeDays} day(s)`],
    ['Warranty', `${terms.warrantyMonths} months · ${labels.warrantyCoverage[terms.warrantyCoverage]}`],
    ['Warranty service', terms.warrantyService || 'Not specified'],
    ['Returns / replacements', terms.replacementDays ? `${terms.replacementDays} days after receipt` : 'No replacement period'],
    ['Payment', labels.paymentCondition[terms.paymentCondition]],
    ['Quote validity', `${terms.validityDays} days from submission`],
    ['After-sales support', labels.afterSalesSupport[terms.afterSalesSupport]],
    ['Quote / evidence reference', terms.supportingReference || 'None stated'],
    ['Other proposed clauses', terms.additionalClauses || 'None stated'],
  ] : [];
  const content = <>
    {terms ? <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
      {clauseList.map(([label, value]) => <div key={label} className="rounded-lg bg-white p-2.5">
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-800">{value}</p>
      </div>)}
    </div> : <p className="mt-2 text-xs text-slate-500">This bid predates the standardized supplier form. Review its original product notes or attached quotation.</p>}
    {findings.length > 0 && <div className="mt-3 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Automatically detected conditions</p>
      {findings.map((finding, index) => <div key={`${finding.title}-${index}`} className={
        'rounded-lg border p-2.5 text-xs ' +
        (finding.severity === 'high' ? 'border-rose-200 bg-rose-50 text-rose-800' :
          finding.severity === 'review' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600')
      }><strong>{finding.title}:</strong> {finding.detail}</div>)}
    </div>}
    <p className="mt-3 text-[11px] leading-4 text-slate-500">
      Detection uses the supplier's structured statements, the bid amount, and the published need. It does not inspect documents
      or verify legal compliance. Staff must confirm actual evidence in the assessment questionnaire; the final PO and signed agreement govern accepted terms.
    </p>
  </>;
  if (insideReview) return <section className="rounded-xl border border-sky-200 bg-sky-50 p-3">
    <h4 className="text-sm font-bold text-slate-800">Supplier's submitted terms & automatically detected conditions</h4>
    {content}
  </section>;
  return <div className={'mt-3 rounded-xl border p-3 ' + (high ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-slate-50')}>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-700">Supplier quotation clauses</span>
      {terms ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">Structured</span> :
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700">Legacy quotation</span>}
      {attention.length > 0 ? <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
        (high ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')}>
        {attention.length} term{attention.length === 1 ? '' : 's'} flagged for review
      </span> : <span className="text-[11px] text-slate-500">{terms ? 'No automatically flagged commercial terms' : 'Manual clause review required'}</span>}
    </div>
    {attention.length > 0 && <p className="mt-1 text-[11px] text-slate-600">{attention.map(item => item.title).join(' · ')}</p>}
    <details className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5">
      <summary className="cursor-pointer text-xs font-semibold text-sky-700">View all quotation terms, clauses & automatic checks</summary>
      {content}
    </details>
  </div>;
}

type Choice = { value: string; label: string; hint?: string };

function SurveyQuestion({ number, question, help, value, options, onChange }: {
  number: number;
  question: string;
  help?: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
}) {
  return <fieldset className="space-y-2">
    <legend className="text-sm font-semibold text-slate-800">
      <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">{number}</span>
      {question} <span className="text-rose-600">*</span>
    </legend>
    {help && <p className="text-xs leading-5 text-slate-500">{help}</p>}
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map(option => <label key={option.value} className={
        'flex cursor-pointer gap-2.5 rounded-xl border px-3 py-3 transition-colors ' +
        (value === option.value
          ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50')
      }>
        <input type="radio" className="mt-0.5 accent-sky-600" name={`bid-survey-${number}`} value={option.value}
          checked={value === option.value} onChange={() => onChange(option.value)} />
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-slate-800">{option.label}</span>
          {option.hint && <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{option.hint}</span>}
        </span>
      </label>)}
    </div>
  </fieldset>;
}

const SPEC_OPTIONS: Choice[] = [
  { value: 'all-met', label: 'All required specifications met', hint: 'Every mandatory item is verified.' },
  { value: 'minor-deviations', label: 'Minor deviations', hint: 'Core requirements met; some differences documented.' },
  { value: 'critical-missing', label: 'Major requirement missing', hint: 'Fails a mandatory specification; not eligible.' },
];
const DURABILITY_OPTIONS: Choice[] = [
  { value: 'strong', label: 'High / verified durability', hint: 'Strong materials, testing, or credible technical evidence.' },
  { value: 'adequate', label: 'Acceptable durability', hint: 'Meets the stated expected operating conditions.' },
  { value: 'concerns', label: 'Durability concerns', hint: 'Evidence indicates limitations or low expected service life.' },
  { value: 'not-verified', label: 'Not yet verified', hint: 'Insufficient information; evaluation stays pending.' },
];
const EVIDENCE_OPTIONS: Choice[] = [
  { value: 'complete', label: 'Complete supporting documents', hint: 'Quotation and relevant technical evidence checked.' },
  { value: 'partial', label: 'Some documents missing', hint: 'Enough to verify key requirements, but incomplete.' },
  { value: 'missing', label: 'No verifiable documents', hint: 'Requires more evidence; evaluation stays pending.' },
];
const WARRANTY_PERIOD_OPTIONS: Choice[] = [
  { value: 'unknown', label: 'Not verified / not stated' },
  { value: '0', label: 'No warranty (0 months)' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
  { value: '18', label: '18 months' },
  { value: '24', label: '24 months' },
  { value: '36', label: '36 months' },
  { value: '48', label: '48 months' },
  { value: '60', label: '60 months' },
];
const WARRANTY_COVERAGE_OPTIONS: Choice[] = [
  { value: 'full', label: 'Parts and labor covered', hint: 'Written warranty includes both.' },
  { value: 'limited', label: 'Limited coverage', hint: 'Only certain items, parts, or services covered.' },
  { value: 'none', label: 'No warranty provided', hint: 'The quotation explicitly states no warranty.' },
  { value: 'not-verified', label: 'Coverage not verified', hint: 'Awaiting written warranty terms; evaluation stays pending.' },
];

export function BidEvaluationPanel() {
  const needs = DB.stockNeeds.filter(need => DB.bids.some(bid => bid.needId === need.id));
  const [needId, setNeedId] = useState(() =>
    needs.find(need => need.id === lastViewedNeedId)?.id || needs[0]?.id || ''
  );
  const [editingBidId, setEditingBidId] = useState<string | null>(null);
  const [specificationMatch, setSpecificationMatch] = useState<SpecificationMatch | ''>('');
  const [durability, setDurability] = useState<DurabilityAssessment | ''>('');
  const [evidence, setEvidence] = useState<EvidenceAssessment | ''>('');
  const [warrantyPeriod, setWarrantyPeriod] = useState('');
  const [warrantyCoverage, setWarrantyCoverage] = useState<WarrantyCoverage | ''>('');
  const [comments, setComments] = useState('');
  const [formError, setFormError] = useState('');

  if (!canManageBidding()) return null;
  const activeNeedId = needs.some(need => need.id === needId) ? needId : needs[0]?.id || '';
  const activeNeed = needs.find(need => need.id === activeNeedId);
  const results = activeNeedId ? scoreBidsForNeed(activeNeedId, DB) : [];
  const best = results.find(result => result.rank === 1);
  const pending = results.filter(result => result.status === 'pending-review').length;
  const editingBid = DB.bids.find(bid => bid.id === editingBidId && bid.needId === activeNeedId);

  function startReview(bidId: string) {
    const bid = DB.bids.find(item => item.id === bidId && item.needId === activeNeedId);
    if (!bid) return;
    const current = bid.evaluation as Partial<BidReviewV2> & {
      remarks?: string;
      compliance?: string;
    } | undefined;
    const isNew = current?.version === 2;
    setSpecificationMatch(isNew ? (current.specificationMatch || '') :
      current?.compliance === 'Compliant' ? 'all-met' :
      current?.compliance === 'Partially Compliant' ? 'minor-deviations' :
      current?.compliance === 'Non-Compliant' ? 'critical-missing' : '');
    setDurability(isNew ? (current.durability || '') : '');
    setEvidence(isNew ? (current.evidence || '') : '');
    const months = current?.warrantyMonths;
    setWarrantyPeriod(months === null ? 'unknown' :
      Number.isInteger(months) ? String(months) : '');
    setWarrantyCoverage(isNew ? (current.warrantyCoverage || '') : '');
    setComments(isNew ? (current.comments || '') : (current?.remarks || ''));
    setFormError('');
    setEditingBidId(bidId);
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bid = DB.bids.find(item => item.id === editingBidId && item.needId === activeNeedId);
    if (!canManageBidding() || !DB.currentUser || !bid) {
      setFormError('You do not have permission to review this bid.');
      return;
    }
    if (!warrantyPeriod) {
      setFormError('Answer Question 4: verified warranty period.');
      return;
    }
    const months = warrantyPeriod === 'unknown' ? null : Number(warrantyPeriod);
    const draft = { specificationMatch, durability, evidence, warrantyMonths: months, warrantyCoverage, comments };
    const error = isValidBidReview(draft);
    if (error) {
      setFormError(error);
      return;
    }
    const verifiedReview: BidReviewV2 = {
      version: 2,
      specificationMatch: specificationMatch as SpecificationMatch,
      durability: durability as DurabilityAssessment,
      evidence: evidence as EvidenceAssessment,
      warrantyMonths: months,
      warrantyCoverage: warrantyCoverage as WarrantyCoverage,
      comments: comments.trim(),
      compliance: complianceFromAnswer(specificationMatch as SpecificationMatch),
      reviewedBy: DB.currentUser.name,
      reviewedAt: new Date().toISOString(),
    };
    bid.evaluation = verifiedReview;
    // Keep the existing audit + cloud snapshot persistence flow; never modify the Worker.
    logAudit('Supplier Bid Evaluated',
      `Bid ${bid.id} (${bid.supplierName}), need ${bid.needId}; ` +
      `requirements=${verifiedReview.specificationMatch}, durability=${durability}, evidence=${evidence}, ` +
      `warranty=${months === null ? 'unverified' : months + ' months'} (${warrantyCoverage}).`
    );
    setEditingBidId(null);
    showToast(`Survey for ${bid.id} saved. Supplier score updated.`, 'success');
    renderApp();
  }

  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden" aria-labelledby="bid-evaluation-title">
    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">Decision support</p>
          <h2 id="bid-evaluation-title" className="mt-1 text-lg font-bold text-slate-900">Automated Supplier Bid Evaluation</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Compare bids for the same stock need. Price, delivery, ratings, and supplier-stated contract clauses are summarized automatically. The system flags exceptions and risky payment/warranty terms; staff verify evidence using five questionnaire questions before ranking.</p>
        </div>
        {needs.length > 0 && <label className="flex min-w-[230px] flex-col gap-1 text-xs font-semibold text-slate-600">
          Procurement need
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800" value={activeNeedId}
            onChange={event => { lastViewedNeedId = event.target.value; setNeedId(event.target.value); setEditingBidId(null); }}>
            {needs.map(need => <option key={need.id} value={need.id}>{need.id} — {need.title}</option>)}
          </select>
        </label>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {CRITERIA.map(item => <div key={item.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] text-slate-500">{item.label}</p>
          <p className="mt-0.5 text-base font-bold text-slate-800">{item.weight}%</p>
        </div>)}
      </div>
    </div>

    {activeNeed ? <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{activeNeed.title}</p>
          <p className="text-xs text-slate-500">{results.length} quotation(s) · {pending} awaiting technical review · Budget cap {currency(activeNeed.budgetCap)}</p>
        </div>
        <div className="text-right">
          {best ? <><p className="text-[11px] text-slate-500">Highest-scoring reviewed bid</p><p className="text-sm font-bold text-sky-700">{best.bid.supplierName} · {best.total?.toFixed(1)}/100</p></>
            : <p className="text-xs font-medium text-amber-700">No eligible verified bids yet</p>}
        </div>
      </div>

      {pending > 0 && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <i className="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden="true" />
        <span>{pending} bid(s) have not been reviewed. Rankings are provisional until all offers have been checked. Do not treat a provisional leader as an award decision.</span>
      </div>}

      <div className="space-y-3">
        {results.map(result => <article key={result.bid.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {result.rank != null && <span className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-bold text-sky-700">Rank #{result.rank}</span>}
                <h3 className="text-sm font-bold text-slate-900">{result.bid.supplierName}</h3>
                <span className="text-[11px] text-slate-400">{result.bid.id}</span>
                {result.bid.status === 'Selected' && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Already selected</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">Bid {currency(result.bid.totalCost)} · Delivery {result.bid.leadTimeDays} day(s)</p>
            </div>
            <div className="flex items-center gap-2">
              <ScoreChip result={result} />
              <button type="button" onClick={() => startReview(result.bid.id)}
                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700">
                <i className="fa-solid fa-clipboard-check mr-1" aria-hidden="true" />{result.bid.evaluation ? 'Edit review' : 'Review bid'}
              </button>
            </div>
          </div>

          {result.status === 'ranked' ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {CRITERIA.map(item => <div key={item.key} className="rounded-lg bg-slate-50 p-2.5">
              <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500"><span>{item.label}</span><span>{result.breakdown[item.key]}/{item.weight}</span></div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full rounded-full bg-sky-500" style={{ width: `${(result.breakdown[item.key] / item.weight) * 100}%` }} /></div>
            </div>)}
          </div> : <p className="mt-3 text-xs font-medium text-slate-500">{result.reason}</p>}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span>Performance: {result.performanceAverage == null ? 'No history (3/5 baseline)' : `${result.performanceAverage.toFixed(1)}/5 (${result.performanceCount} rating${result.performanceCount === 1 ? '' : 's'})`}</span>
            {result.bid.evaluation && <span>Warranty: {result.bid.evaluation.warrantyMonths == null ? 'Not verified' : `${result.bid.evaluation.warrantyMonths} months`}</span>}
            {result.bid.evaluation && <span>Checked by: {result.bid.evaluation.reviewedBy}</span>}
          </div>
          <SupplierClauseSummary bid={result.bid} need={activeNeed} />
          {result.notes.length > 0 && <div className="mt-2 flex flex-wrap gap-1">
            {result.notes.map(note => <span key={note} className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">{note}</span>)}
          </div>}
        </article>)}
      </div>
      <p className="border-t border-slate-100 pt-3 text-[11px] leading-5 text-slate-500">
        Scoring: lowest eligible price / quoted price × 35; shortest eligible lead / quoted lead × 20;
        specifications (25 points) = required specs (65%), durability (20%) and documentation (15%);
        warranty (10 points) = verified months (capped at 24) × coverage quality; supplier history (10 points) = average rating / 5.
        No historical ratings use a disclosed neutral 3/5 baseline. Major technical failures are ineligible;
        unverified supporting evidence is marked pending and excluded from rankings. Existing pre-questionnaire reviews remain available
        under their previous scoring until edited. The result supports, but does not replace, the final procurement decision.
      </p>
    </div> : <div className="p-8 text-center text-sm text-slate-500">There are no submitted supplier bids to evaluate yet.</div>}

    {editingBid && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-3 sm:p-4" role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) setEditingBidId(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="bid-review-heading"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-sky-600">Supplier assessment questionnaire</p>
            <h3 id="bid-review-heading" className="mt-1 font-bold text-slate-900">Verify Supplier Quotation</h3>
            <p className="mt-1 text-xs text-slate-500">{editingBid.supplierName} · {editingBid.id}</p>
          </div>
          <button aria-label="Close review" className="rounded-md px-2 py-1 text-slate-500 hover:text-slate-900" type="button"
            onClick={() => setEditingBidId(null)}><i className="fa-solid fa-xmark" /></button>
        </div>
        <form className="flex min-h-0 flex-col" onSubmit={submitReview}>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
              Choose the answer best supported by the supplier's written quotation and attached evidence.
              The system calculates the weighted grade automatically. Questions marked * are required.
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <p className="font-bold text-slate-800">Required for: {activeNeed?.title}</p>
              <p className="mt-1"><span className="font-semibold">Specifications:</span> {activeNeed?.techSpecs || 'See approved procurement need'}</p>
              <p className="mt-1"><span className="font-semibold">Supplier's description:</span> {editingBid.notes || 'No description supplied'}</p>
            </div>
            <SupplierClauseSummary bid={editingBid} need={activeNeed} insideReview />
            <SurveyQuestion number={1} question="Does the item meet the required technical specifications?"
              help="Compare the offered model and specifications with the published stock need."
              value={specificationMatch} options={SPEC_OPTIONS}
              onChange={v => { setSpecificationMatch(v as SpecificationMatch); setFormError(''); }} />
            <SurveyQuestion number={2} question="How is the item's durability or build quality verified?"
              help="Use product specifications, test records, or credible technical evidence rather than assumptions."
              value={durability} options={DURABILITY_OPTIONS}
              onChange={v => { setDurability(v as DurabilityAssessment); setFormError(''); }} />
            <SurveyQuestion number={3} question="Are the quotation and supporting documents complete?"
              help="Check the signed quotation, technical datasheet, certifications, or other applicable documents."
              value={evidence} options={EVIDENCE_OPTIONS}
              onChange={v => { setEvidence(v as EvidenceAssessment); setFormError(''); }} />
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-slate-800">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">4</span>
                What warranty period is stated in writing? <span className="text-rose-600">*</span>
              </legend>
              <p className="text-xs leading-5 text-slate-500">Select Not verified if the duration isn't documented; that leaves the ranking pending.</p>
              <select value={warrantyPeriod} required
                onChange={event => { setWarrantyPeriod(event.target.value); setFormError(''); }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800">
                <option value="" disabled>Choose the written warranty period</option>
                {WARRANTY_PERIOD_OPTIONS.concat(
                  warrantyPeriod && !WARRANTY_PERIOD_OPTIONS.some(option => option.value === warrantyPeriod)
                    ? [{ value: warrantyPeriod, label: `${warrantyPeriod} months (previous review)` }]
                    : []
                ).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </fieldset>
            <SurveyQuestion number={5} question="What is covered by the written warranty?"
              help="Do not assume full warranty coverage unless the supplier expressly provides it."
              value={warrantyCoverage} options={WARRANTY_COVERAGE_OPTIONS}
              onChange={v => { setWarrantyCoverage(v as WarrantyCoverage); setFormError(''); }} />
            <div className="border-t border-slate-200 pt-4">
              <label htmlFor="bid-survey-comments" className="block text-sm font-semibold text-slate-800">
                Additional comments <span className="text-xs font-normal text-slate-500">(optional)</span>
              </label>
              <p className="mt-1 text-xs leading-5 text-slate-500">Mention any exceptions, missing evidence or follow-up requests. No written essay is required.</p>
              <textarea id="bid-survey-comments" rows={2} maxLength={1000} value={comments}
                onChange={event => setComments(event.target.value)}
                placeholder="Optional notes or quotation reference..."
                className="mt-2 block w-full resize-y rounded-xl border border-slate-300 p-3 text-sm" />
            </div>
            {formError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{formError}</p>}
          </div>
          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <p className="text-[11px] text-slate-500">
              {[specificationMatch, durability, evidence, warrantyPeriod, warrantyCoverage].filter(Boolean).length} of 5 answered
            </p>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                onClick={() => setEditingBidId(null)}>Cancel</button>
              <button type="submit" className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700">
                Save evaluation
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>}
  </section>;
}
