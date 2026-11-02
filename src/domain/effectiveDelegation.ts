/** Short-lived, server-validated effective approval responsibilities.
 * UI hints only. Every protected mutation is still authorized by the Worker.
 * Do not persist this in localStorage or treat it as a generic role promotion.
 */
import { DB } from '../store/state';

export type ActingResponsibility = 'Procurement Head' | 'Operations Head' | 'Finance Officer' | 'Finance Head' | 'Department Head';
type ActiveEntry = {
  role: ActingResponsibility;
  department: string;
  endsOn: string;
};
type CachedAccess = { userId: string; fetchedAt: number; validUntil: number; roles: ActiveEntry[] };
let cached: CachedAccess | null = null;
const todayInPhilippines = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

/** Clear temporary capabilities but retain the account's permanent job role.
 * Returns true when the visible effective capabilities need to be rerendered. */
export function clearActingResponsibilities(): boolean {
  const hadAccess = Boolean(cached?.roles.length);
  cached = null;
  return hadAccess;
}

/** Active roles reported by GET /delegations have already passed D1 checks. */
export function setActingResponsibilities(userId: string, response: {
  activeRoles?: ActingResponsibility[];
  activeDepartments?: string[];
  delegations?: {delegate_user_id:string;step_role:string;department:string;ends_on:string;starts_on:string;review_status:string;revoked_at:string|null}[];
}): boolean {
  const t = todayInPhilippines();
  const roles:ActiveEntry[] = [];
  const allowed = new Set(response.activeRoles ?? []);
  const departments = new Set((response.activeDepartments ?? []).map(v => v.trim().toLowerCase()));
  for (const row of response.delegations ?? []) {
    if (row.delegate_user_id !== userId || row.review_status !== 'Approved' || row.revoked_at || row.starts_on > t || row.ends_on < t) continue;
    if (row.step_role === 'Department Head') {
      if (!departments.has(row.department.trim().toLowerCase())) continue;
    } else if (!allowed.has(row.step_role as ActingResponsibility)) continue;
    const role = row.step_role as ActingResponsibility;
    if (!roles.some(x => x.role === role && x.department === row.department)) {
      roles.push({role, department:row.department, endsOn:row.ends_on});
    }
  }
  // Never compare a different account's previous responsibilities to this user.
  // Date boundaries are evaluated even if the last cache write was yesterday.
  const previous = JSON.stringify(cached?.userId === userId ? activeActingResponsibilities() : []);
  cached = {userId, fetchedAt:Date.now(), validUntil:Date.now()+75_000, roles};
  return previous !== JSON.stringify(roles);
}

export function actingResponsibility(role: ActingResponsibility, department = ''): boolean {
  const user = DB.currentUser;
  if (!user || user.role === 'Admin' || user.role === 'Supplier' || user.status !== 'Active' ||
      cached?.userId !== user.id || cached.validUntil <= Date.now()) return false;
  const t=todayInPhilippines();
  return cached.roles.some(x=>x.role===role && x.endsOn>=t &&
    (role !== 'Department Head' || x.department.trim().toLowerCase()===department.trim().toLowerCase()));
}

export function activeActingResponsibilities():ActiveEntry[] {
  if (!DB.currentUser || cached?.userId !== DB.currentUser.id || cached.validUntil <= Date.now()) return [];
  return cached.roles.filter(item=>item.endsOn>=todayInPhilippines());
}
