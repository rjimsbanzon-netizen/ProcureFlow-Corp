import type { MatrixRole } from './accessMatrix';
import type { User } from '../types/procurement';

export type ApprovalAssignment = { user_id: string; step_role: string; department: string };

/** Pure role resolution. Appointment data never changes the stored account role. */
export function resolvePermissionRole(
  user: User | null,
  assignments: readonly ApprovalAssignment[],
  isFinanceDepartment: (value: unknown) => boolean
): MatrixRole | null {
  if (!user) return null;
  if (user.role === 'Admin' || user.role === 'Supplier' ||
      user.role === 'Procurement Head' || user.role === 'Procurement Officer') return user.role;
  const mine = assignments.filter(item => item.user_id === user.id);
  const financeHead = mine.some(item => item.step_role === 'Department Head' &&
    isFinanceDepartment(item.department) && isFinanceDepartment(user.department));
  const financeOfficer = mine.some(item => item.step_role === 'Finance Officer' &&
    item.department === '*' && isFinanceDepartment(user.department));
  // Incompatible dual finance appointments must never grant payment rights.
  if (financeHead && financeOfficer) return 'Employee';
  if (financeHead) return 'Finance Head';
  if (financeOfficer) return 'Finance Officer';
  if (mine.some(item => item.step_role === 'Department Head' &&
    item.department.trim().toLowerCase() === user.department.trim().toLowerCase())) return 'Department Head';
  return 'Employee';
}
