// @ts-nocheck
import { emptyTableRow } from '../shared/feedback';
import { canCancelProposalMeeting, canRequestMeetingReschedule, canReviewMeetingReschedule, canRescheduleProposalMeeting } from '../../actions/biddingActions';
import { DB } from '../../store/state';
import { escapeMeetingText, findMeetingConflicts, meetingDuration } from '../../domain/meetingSchedule';

/** The same meeting reschedule, overlap, and supplier reply workflows in their own module. */
export function renderProposalMeetingsView() {
    const isSupplier = DB.currentUser.role === 'Supplier';
    const visibleMeetings = DB.proposalMeetings.filter(m => !isSupplier || m.supplierId === DB.currentUser.supplierId);
    return `
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-slate-800">Proposal Presentation Meetings</h4>
                        <p class="text-xs text-slate-500">Meeting invites, venue schedule, and supplier confirmations. Active meetings reserve their full duration.</p>
                    </div>
                </div>

                ${!isSupplier && DB.proposalMeetings.some(m => findMeetingConflicts(m, DB.proposalMeetings, m.id).length > 0) ? `
                    <div class="px-4 py-3 bg-amber-50 border-y border-amber-200 text-amber-900 text-xs font-semibold" role="alert">
                        <i class="fa-solid fa-triangle-exclamation mr-2"></i>
                        Schedule conflict detected: some active proposal meetings overlap. Review the highlighted meetings and cancel or reschedule one of them.
                    </div>
                ` : ''}
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                            <tr>
                                <th class="p-4">Meeting Ref</th>
                                <th class="p-4">Supplier</th>
                                <th class="p-4">Date & Time</th>
                                <th class="p-4">Venue</th>
                                <th class="p-4">Status</th>
                                <th class="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            ${visibleMeetings.length === 0 ? `
                                ${emptyTableRow(6, 'No proposal meetings scheduled', 'After a bid is reviewed, meeting invitations and supplier responses will appear here.', 'fa-calendar-days')}
                            ` : visibleMeetings.map(m => {
                                const conflicts = !isSupplier ? findMeetingConflicts(m, DB.proposalMeetings, m.id) : [];
                                const hasConflict = conflicts.length > 0;
                                const pendingRequest = m.rescheduleRequest?.status === 'Pending';
                                return `
                                <tr class="hover:bg-slate-50 ${hasConflict ? 'bg-amber-50/60' : ''}">
                                    <td class="p-4 font-bold text-sky-600">${m.id}</td>
                                    <td class="p-4 font-medium text-slate-900">${m.supplierName}</td>
                                    <td class="p-4 text-xs font-semibold text-slate-800">
                                        <div>${escapeMeetingText(m.date)} at ${escapeMeetingText(m.time)}</div>
                                        <div class="text-slate-500 font-normal mt-1">${meetingDuration(m.durationMinutes)} minutes</div>
                                        ${hasConflict ? `<div class="mt-1 text-amber-800 font-semibold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Overlaps ${conflicts.map(c => escapeMeetingText(c.id)).join(', ')}</div>` : ''}
                                    </td>
                                    <td class="p-4 text-xs text-slate-600">
                                        <div class="font-semibold">${m.meetingMode || 'Venue'}</div>
                                        <div>${m.venue}</div>
                                    </td>
                                    <td class="p-4">
                                        <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            m.status === 'Agreed' ? 'bg-emerald-100 text-emerald-800' :
                                            m.status === 'Declined' ? 'bg-rose-100 text-rose-800' :
                                            m.status === 'Cancelled' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'
                                        }">${escapeMeetingText(m.status)}</span>
                                        ${m.status === 'Cancelled' ? `<p class="text-xs text-slate-500 mt-2" title="${escapeMeetingText(m.cancellationReason || '')}">Reason: ${escapeMeetingText(m.cancellationReason || 'Not specified')}</p>` : ''}
                                        ${pendingRequest ? `<p class="mt-2 text-xs font-semibold text-amber-800"><i class="fa-solid fa-clock mr-1"></i> Supplier reschedule request awaiting review</p>` : ''}
                                        ${m.rescheduleRequest?.status === 'Rejected' ? `<p class="mt-2 text-xs text-rose-700">Previous schedule request declined: ${escapeMeetingText(m.rescheduleRequest.reviewNote || 'No reason provided')}</p>` : ''}
                                        ${m.rescheduleCount ? `<p class="text-xs font-semibold text-emerald-700 mt-2"><i class="fa-solid fa-calendar-check mr-1"></i> Rescheduled ${Number(m.rescheduleCount)} time(s)</p><p class="text-[11px] text-slate-500 mt-0.5">Reason: ${escapeMeetingText(m.rescheduleReason || 'Schedule updated')}</p>` : ''}
                                    </td>
                                    <td class="p-4 text-center">
                                      <div class="flex flex-wrap gap-2 justify-center items-center">
                                        ${isSupplier && m.status === 'Pending Response' && !pendingRequest ? `
                                            <button data-command="respondProposalMeeting" data-arg1="${m.id}" data-arg2="Agreed" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors">
                                                <i class="fa-solid fa-check mr-1"></i> Agree to Schedule
                                            </button>
                                            <button data-command="respondProposalMeeting" data-arg1="${m.id}" data-arg2="Declined" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold transition-colors">
                                                <i class="fa-solid fa-xmark mr-1"></i> Disagree / Request Change
                                            </button>
                                        ` : ''}
                                        ${canRequestMeetingReschedule(m.id) ? `
                                            <button data-command="openRequestMeetingRescheduleModal" data-arg1="${escapeMeetingText(m.id)}" class="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 rounded text-xs font-semibold">
                                                <i class="fa-solid fa-calendar-plus mr-1"></i> Request Reschedule
                                            </button>
                                        ` : ''}
                                        ${canReviewMeetingReschedule(m.id) ? `
                                            <button data-command="openReviewMeetingRescheduleModal" data-arg1="${escapeMeetingText(m.id)}" class="px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-900 hover:bg-amber-200 rounded text-xs font-semibold">
                                                <i class="fa-solid fa-clipboard-check mr-1"></i> Review Request
                                            </button>
                                        ` : ''}
                                        ${canRescheduleProposalMeeting(m.id) ? `
                                            <button data-command="openRescheduleMeetingModal" data-arg1="${escapeMeetingText(m.id)}" class="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 rounded text-xs font-semibold">
                                                <i class="fa-solid fa-calendar-days mr-1"></i> Reschedule
                                            </button>
                                        ` : ''}
                                        ${canCancelProposalMeeting(m.id) ? `
                                            <button data-command="openCancelProposalMeetingModal" data-arg1="${escapeMeetingText(m.id)}" class="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded text-xs font-semibold">
                                                <i class="fa-solid fa-ban mr-1"></i> Cancel Meeting
                                            </button>
                                        ` : ''}
                                        ${(!isSupplier && !canCancelProposalMeeting(m.id)) || (isSupplier && m.status !== 'Pending Response' && !canCancelProposalMeeting(m.id)) ? `<span class="text-xs text-slate-400">${escapeMeetingText(m.status)}</span>` : ''}
                                      </div>
                                    </td>
                                </tr>
                            `; }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
    `;
}
