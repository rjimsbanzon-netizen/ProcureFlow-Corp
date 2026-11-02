// @ts-nocheck
import { getEffectivePosition } from '../domain/staffPositions';
import type { StaffAssignment } from '../domain/staffPositions';
import { DB } from '../store/state';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderUsersView(assignments: StaffAssignment[] = [], positionsLoading = false, search = '') {
    const normalized=search.trim().toLowerCase();
    const filtered=normalized?DB.users.filter(u=>[u.name,u.username,u.email,u.department,u.role,u.companyName,u.status,getEffectivePosition(u,assignments).label].some(value=>String(value||'').toLowerCase().includes(normalized))):DB.users;
    return `
        <div class="space-y-4">
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                            <tr>
                                <th class="p-4">User</th>
                                <th class="p-4">Email & Dept</th>
                                <th class="p-4">Position: Department</th>
                                <th class="p-4">Status</th>
                                <th class="p-4 text-center">Account Controls</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            ${filtered.length===0?'<tr><td colspan="5" class="p-6 text-center text-sm text-slate-500">No accounts match the current search.</td></tr>':''}
                            ${filtered.map(u => `
                                <tr class="hover:bg-slate-50">
                                    <td class="p-4 font-bold text-slate-900">${u.role === 'Admin' ? 'Admin' : u.name} <span class="text-xs text-slate-400">(@${u.username})</span></td>
                                    <td class="p-4 text-xs">
                                        <div>${u.email}</div>
                                        <div class="text-slate-400">${u.companyName || u.department}</div>
                                        ${u.role !== 'Supplier' && u.role !== 'Admin' ? `<div class="mt-2 text-[11px] font-semibold text-[#a64f32]">Requested position: ${['Head','Officer','Employee'].includes(u.requestedPosition) ? u.requestedPosition : 'Employee'}</div>` : ''}
                                    </td>
                                    <td class="p-4">
                                        ${positionsLoading ? `<span class="text-xs text-slate-500">Position unavailable while cloud assignments load</span>` : (() => {
                                            const position = getEffectivePosition(u, assignments);
                                            return `<span class="inline-flex rounded-md border px-2.5 py-1.5 text-xs font-bold ${(position.source === 'conflict' || position.accountDepartmentMismatch) ? 'border-rose-200 bg-rose-50 text-rose-700' : position.source === 'assignment' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 bg-slate-50 text-slate-700'}">${u.role === 'Admin' ? 'Admin' : position.label}</span>
                                                <p class="mt-2 text-xs text-slate-600">${u.role === 'Admin' ? 'Protected Admin account' : position.detail}</p>
                                                <p class="mt-1 text-[11px] text-slate-400">Access role (permissions): ${u.role}</p>`;
                                        })()}

                                    </td>
                                    <td class="p-4">
                                        <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            u.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : u.status === 'Rejected' || u.status === 'Access Revoked' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                        }">${u.status}</span>
                                    </td>
                                    <td class="p-4 text-center">
                                        ${u.role === 'Admin' ? `
                                            <span class="text-xs text-slate-400">Protected</span>
                                        ` : `
                                            <div class="flex justify-center gap-2">
                                                ${u.status === 'Pending Verification' || u.status === 'Rejected' || u.status === 'Access Revoked' ? `
                                                    <button data-command="approveUser" data-arg1="${u.id}" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition-colors">${u.status === 'Pending Verification' ? 'Approve' : 'Restore Access'}</button>
                                                ` : `
                                                    <button data-command="revokeUser" data-arg1="${u.id}" class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-sm transition-colors">Revoke Access</button>
                                                `}
                                                ${u.status === 'Pending Verification' ? `
                                                    <button data-command="rejectUser" data-arg1="${u.id}" class="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-sm transition-colors">Reject</button>
                                                ` : ''}
                                                <button data-command="deleteUserAccount" data-arg1="${u.id}" class="px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-sm transition-colors">Remove Account</button>
                                            </div>
                                        `}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}


export function getRoleAuthorizationSummary(role) {
    switch (role) {
        case 'Admin': return 'System administration, user verification, audit logs, and permission management.';
        case 'Procurement Head': return 'Procurement approvals, bidding, delivery issue resolution, amendments, and payments.';
        case 'Procurement Officer': return 'Purchase requisitions and orders, delivery logging and inspection, and supplier directory.';
        case 'Supplier': return 'Supplier portal, bid submission, assigned orders, delivery updates, and payment status.';
        case 'Employee':
        default: return 'Create and track purchase requisitions for your department.';
    }
}
