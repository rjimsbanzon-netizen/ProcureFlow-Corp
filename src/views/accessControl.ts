// @ts-nocheck
import { DB } from '../store/state';
import { MATRIX_GROUPS, MATRIX_ROLES, normalizeMatrix, fixedValue } from '../domain/accessMatrix';
import { renderDashboardView } from './dashboard';

/**
 * Show only administrator-editable capabilities. Account/assignment/workflow
 * protections stay enforced in normalizeMatrix, permissions.ts, and the API.
 * Ineligible role/action pairs have no interactive control.
 */
export function renderAccessControlView() {
  if (DB.currentUser?.role !== 'Admin') return renderDashboardView();
  const current = normalizeMatrix(DB.permissions);
  const visibleGroups = MATRIX_GROUPS.map(group => ({
    title: group.title,
    rows: group.rows.filter(row =>
      !row.system && MATRIX_ROLES.some(role => fixedValue(role, row.key) === null)
    )
  })).filter(group => group.rows.length > 0);
  const editableRows = visibleGroups.reduce((total, group) => total + group.rows.length, 0);

  return `
    <section class="space-y-4">
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900">Role-based Access Control Matrix</h2>
            <p class="mt-1 max-w-3xl text-sm text-slate-500">
              ${editableRows} configurable permissions across eight account roles and assigned positions.
              Only the settings you can actually change are shown. Protected approvals,
              account security, and payment rules are applied automatically.
            </p>
          </div>
          <button data-command="saveAccessControlMatrix" type="button"
            class="rounded-lg bg-[#a64f32] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#873e27]">
            <i class="fa-solid fa-floppy-disk mr-2"></i> Save permissions
          </button>
        </div>
        <p class="mt-3 text-xs text-slate-500">
          <i class="fa-solid fa-square-check mr-1 text-emerald-700" aria-hidden="true"></i>
          Tick a box to allow that role to use the feature. An em dash means that permission is
          not configurable for that position. No locked checkboxes are displayed.
        </p>
      </div>
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="w-full min-w-[1420px] border-collapse text-left text-xs text-slate-700">
          <thead class="bg-slate-100 text-[11px] uppercase text-slate-700">
            <tr>
              <th class="sticky left-0 z-20 w-[310px] min-w-[310px] border-r border-slate-200 bg-slate-100 px-4 py-4 text-left">Editable permission</th>
              ${MATRIX_ROLES.map(role=>`<th class="min-w-[125px] border-r border-slate-200 p-3 text-center whitespace-normal">${role}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${visibleGroups.map(group=>`
              <tr><th colspan="${MATRIX_ROLES.length+1}" class="bg-[#f0ece4] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#89452f]">${group.title}</th></tr>
              ${group.rows.map(row=>`
                <tr class="border-t border-slate-200 hover:bg-slate-50">
                  <th scope="row" class="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3 text-left font-semibold">
                    ${row.label}
                    ${row.info?`<span class="mt-1 block text-[11px] font-normal leading-relaxed text-slate-500">${row.info}</span>`:''}
                  </th>
                  ${MATRIX_ROLES.map(role=>{
                    if (fixedValue(role, row.key) !== null) {
                      return '<td class="border-r border-slate-200 bg-slate-50/40 px-3 py-3 text-center text-slate-300" aria-label="Not configurable">—</td>';
                    }
                    const checked = current[role]?.includes(row.key);
                    return `<td class="border-r border-slate-200 px-3 py-3 text-center">
                      <input aria-label="Allow ${role} to ${row.label}" type="checkbox"
                        data-role="${role}" data-action="${row.key}"
                        ${checked?'checked':''}
                        class="h-4 w-4 cursor-pointer accent-[#a64f32]" />
                    </td>`;
                  }).join('')}
                </tr>
              `).join('')}
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Protected workflow rules:</strong> The Department Head submits requests; assigned
        Procurement and Finance reviewers approve their designated steps. Only the appointed
        Finance Officer (below the Finance Head threshold) or Finance Head (at or above it)
        processes verified payments. Active, Admin-approved substitutes may perform their specifically delegated steps during their valid date range. The Worker rechecks every action. These rules cannot be changed from this matrix.
        Change financial thresholds under <strong>Department Budgets</strong>.
      </div>
    </section>`;
}
