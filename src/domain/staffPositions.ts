/** Display-only job positions derived from the D1 finance_approvers assignments.
 * Access control MUST continue to use the account role and server-side assignment checks.
 */
import type { FinanceSettings } from '../services/finance';
import { CLOUD_API_BASE } from '../services/cloud';
import { financeAPI } from '../services/finance';

export type StaffAssignment = FinanceSettings['assignments'][number];
export type StaffAccount = {
  id: string;
  role: string;
  department?: string;
  companyName?: string;
  status?: string;
};
export type EffectivePosition = {
  name: string;
  department: string;
  label: string;
  detail: string;
  source: 'account' | 'assignment' | 'conflict';
  /** The stored home department differs from the fixed Procurement role. */
  accountDepartmentMismatch?: boolean;
};

const same = (a: unknown, b: unknown) =>
  String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/** Approved Finance home-department labels; a job role alone does not qualify. */
export function isFinanceDepartment(department: unknown): boolean {
  const normalized = String(department ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized === 'finance & accounting' || normalized === 'finance and accounting' || normalized === 'finance';
}

function position(name: string, department: string, detail: string, source: EffectivePosition['source']): EffectivePosition {
  const cleanDepartment = department.trim() || 'Unassigned department';
  return { name, department: cleanDepartment, label: `${name}: ${cleanDepartment}`, detail, source };
}

/** The displayed job title is not an account permission.
 * Heads and Finance review responsibilities are read from D1 assignments.
 * Procurement Head is a fixed special access role in the Procurement department,
 * never a generic Head assigned to IT Systems or another requesting department.
 */
export function getEffectivePosition(user: StaffAccount, assignments: readonly StaffAssignment[]): EffectivePosition {
  if (user.role === 'Admin')
    return position('Admin', 'Executive', 'Protected Admin account', 'account');
  if (user.role === 'Supplier')
    return position('Supplier', user.companyName || user.department || 'External Vendor', 'Supplier portal account', 'account');

  // This account role already means Head of Procurement; a stale profile
  // department must not make it look like the Head of another department.
  if (user.role === 'Procurement Head') {
    const result = position('Head', 'Procurement', 'Procurement Head · Procurement department', 'account');
    if (user.department && !same(user.department, 'Procurement')) {
      result.accountDepartmentMismatch = true;
      result.detail = `Procurement Head belongs to Procurement. The account profile currently says ${user.department}; Admin should correct the saved account department.`;
    }
    return result;
  }

  const mine = assignments.filter(item => item.user_id === user.id);
  const heads = mine.filter(item => item.step_role === 'Department Head' && same(item.department, user.department));
  const finance = mine.filter(item => item.step_role === 'Finance Officer' && item.department === '*');

  // Finance Head (appointed Head of Finance) and Finance Officer must be
  // different employees. A stale double assignment does not grant either title.
  if (heads.length && finance.length)
    return position('Assignment conflict', user.department || '', 'Finance Head and Finance Officer require separate active accounts.', 'conflict');
  if (heads.length && isFinanceDepartment(user.department))
    return position('Finance Head', heads[0].department, 'Head of Finance & Accounting · high-value financial authorization', 'assignment');
  if (heads.length && same(user.department, 'Human Resources'))
    return position('Human Resources Head', 'Human Resources', 'Appointed Head of Human Resources · department requisition submission', 'assignment');
  if (heads.length && same(user.department, 'Operations'))
    return position('Operations Head', 'Operations', 'Appointed Head of Operations · department PR submission', 'assignment');
  if (heads.length)
    return position('Head', heads[0].department, 'Department Head requester · cannot approve own requisition', 'assignment');
  if (finance.length && isFinanceDepartment(user.department))
    return position('Finance Officer', user.department || '', 'Assigned Finance reviewer · routine financial approval and payment processing', 'assignment');

  if (user.role === 'Operations Officer')
    return position('Operations Officer', 'Operations', 'Operations department officer; can cover Head when delegated', 'account');
  if (user.role === 'Procurement Officer')
    return position('Procurement Officer', 'Procurement', 'Procurement officer · sourcing and delivery responsibilities', 'account');

  return position('Employee', user.department || '', 'Regular department employee', 'account');
}

let cached: { userId:string; expiresAt:number; assignments:StaffAssignment[] } | null = null;
let active: {userId:string; promise:Promise<StaffAssignment[]>} | null = null;
let assignmentRevision = 0;
/** Cache per authenticated account only, and refresh after assignment changes. */
export async function loadStaffAssignments(accountId:string, force=false):Promise<StaffAssignment[]> {
  if (!CLOUD_API_BASE) return [];
  if (!force && cached?.userId === accountId && cached.expiresAt > Date.now()) return cached.assignments;
  if (!force && active?.userId === accountId) return active.promise;
  const revision = assignmentRevision;
  const promise = financeAPI.settings().then(settings=>{
    if(revision===assignmentRevision)
      cached = {userId:accountId,expiresAt:Date.now()+30_000,assignments:settings.assignments};
    return settings.assignments;
  });
  active = {userId:accountId,promise};
  try { return await promise; } finally { if (active?.promise === promise) active=null; }
}
/** UI-only event: server-side authorization still comes from D1. */
export const STAFF_ASSIGNMENTS_UPDATED = 'procureflow:staff-assignments-updated';
export function invalidateStaffAssignments():void {
  assignmentRevision++;
  cached=null;
  if(typeof window!=='undefined')window.dispatchEvent(new Event(STAFF_ASSIGNMENTS_UPDATED));
}


/** Permission evaluation needs a synchronous view of the latest user-specific D1 assignments. */
export function getCachedStaffAssignments(userId:string):StaffAssignment[] {
  return cached?.userId===userId ? cached.assignments : [];
}
