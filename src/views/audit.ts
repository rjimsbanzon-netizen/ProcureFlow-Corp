// @ts-nocheck
import { DB } from '../store/state';
import { renderDashboardView } from './dashboard';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderAuditView() {
    if (DB.currentUser.role !== 'Admin') return renderDashboardView();
    return `
        <div class="space-y-4">
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 class="font-bold text-slate-800">System Audit Trail</h3>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                            <tr>
                                <th class="p-4">Timestamp</th>
                                <th class="p-4">User</th>
                                <th class="p-4">Role</th>
                                <th class="p-4">Action</th>
                                <th class="p-4">Details</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200 font-mono text-xs">
                            ${DB.auditLogs.map(log => `
                                <tr class="hover:bg-slate-50">
                                    <td class="p-4 text-slate-500">${log.timestamp}</td>
                                    <td class="p-4 font-bold text-slate-800">${log.user}</td>
                                    <td class="p-4 text-sky-600">${log.role}</td>
                                    <td class="p-4 font-semibold text-slate-700">${log.action}</td>
                                    <td class="p-4 text-slate-600">${log.details}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}
