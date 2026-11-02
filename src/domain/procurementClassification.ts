/** PF Corp's operational priority is distinct from financial ABC stock analysis.
 * Government Approved Budget for the Contract (also 'ABC') is a third, unrelated term.
 */
export const PRIORITIES = [
  { value: 'A', label: 'A · Company priority', detail: 'Defined by Operations for this company.' },
  { value: 'B', label: 'B · Company priority', detail: 'Defined by Operations for this company.' },
  { value: 'C', label: 'C · Company priority', detail: 'Defined by Operations for this company.' },
] as const;
export type ProcurementPriority = typeof PRIORITIES[number]['value'];
let configuredPriorityNames: Partial<Record<ProcurementPriority, string>> = {};
export function setConfiguredPriorityNames(priorities: readonly { code: ProcurementPriority; name: string }[]): void {
  configuredPriorityNames = Object.fromEntries(priorities.map(priority => [priority.code, priority.name]));
}
export const PURCHASE_CATEGORIES = [
  'Goods & Materials', 'Equipment & Capital Assets', 'General Services',
  'Professional & Consulting Services', 'Construction & Works',
  'Software & Digital Services', 'Rental & Leasing', 'Utilities & Subscriptions',
] as const;
export type PurchaseCategory = typeof PURCHASE_CATEGORIES[number];
export const RECURRENCES = ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'As-needed under contract'] as const;
export type ProcurementRecurrence = typeof RECURRENCES[number];
export function priorityLabel(v:unknown, configuredName?:string):string {
  return v === 'A' || v === 'B' || v === 'C'
    ? `${v} · ${configuredName || configuredPriorityNames[v] || `Type ${v}`}`
    : 'Not classified';
}
export function priorityClass(v:unknown):string {
  return v==='A'?'border-rose-200 bg-rose-50 text-rose-800':v==='B'?'border-amber-200 bg-amber-50 text-amber-800':v==='C'?'border-slate-200 bg-slate-100 text-slate-700':'border-slate-200 bg-white text-slate-500';
}

/** Only tangible items should be credited to the physical received-stock ledger. */
export function isPhysicalPurchase(category:unknown):boolean {
  return !category || category === 'Goods & Materials' || category === 'Equipment & Capital Assets';
}
