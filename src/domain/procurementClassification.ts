/** PF Corp's operational priority is distinct from financial ABC stock analysis.
 * Government Approved Budget for the Contract (also 'ABC') is a third, unrelated term.
 */
export const PRIORITIES = [
  { value: 'A', label: 'A · Critical / core', detail: 'Production-critical or mandatory: escalated sourcing, continuity and backup checks.' },
  { value: 'B', label: 'B · Regular / important', detail: 'Recurring operational inputs and planned replacements.' },
  { value: 'C', label: 'C · Occasional / support', detail: 'Noncritical, one-off or low-urgency requirements.' },
] as const;
export type ProcurementPriority = typeof PRIORITIES[number]['value'];
export const PURCHASE_CATEGORIES = [
  'Goods & Materials', 'Equipment & Capital Assets', 'General Services',
  'Professional & Consulting Services', 'Construction & Works',
  'Software & Digital Services', 'Rental & Leasing', 'Utilities & Subscriptions',
] as const;
export type PurchaseCategory = typeof PURCHASE_CATEGORIES[number];
export const RECURRENCES = ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'As-needed under contract'] as const;
export type ProcurementRecurrence = typeof RECURRENCES[number];
export function priorityLabel(v:unknown):string {
  return v === 'A' ? 'A · Critical' : v === 'B' ? 'B · Regular' : v === 'C' ? 'C · Occasional' : 'Not classified';
}
export function priorityClass(v:unknown):string {
  return v==='A'?'border-rose-200 bg-rose-50 text-rose-800':v==='B'?'border-amber-200 bg-amber-50 text-amber-800':v==='C'?'border-slate-200 bg-slate-100 text-slate-700':'border-slate-200 bg-white text-slate-500';
}

/** Only tangible items should be credited to the physical received-stock ledger. */
export function isPhysicalPurchase(category:unknown):boolean {
  return !category || category === 'Goods & Materials' || category === 'Equipment & Capital Assets';
}
