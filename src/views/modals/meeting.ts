// @ts-nocheck
import { closeModal } from '../../actions/modalActions';
import { DB, ui } from '../../store/state';
import { canCancelProposalMeeting, canRequestMeetingReschedule, canReviewMeetingReschedule, canRescheduleProposalMeeting } from '../../actions/biddingActions';
import { escapeMeetingText } from '../../domain/meetingSchedule';

// Migrated from enterprise.html. Business rules / markup preserved.
export function renderScheduleMeetingModal() {
    const bid = DB.bids.find(b => b.id === ui.selectedRecord);
    if (!bid) return '';
    const need = DB.stockNeeds.find(s => s.id === bid.needId) || { title: bid.needId };

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">Schedule Proposal Meeting</h3>
                        <p class="text-xs text-slate-500">Vendor: ${bid.supplierName} &bull; Need: ${need.title}</p>
                    </div>
                    <button data-command="closeModal" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <form id="schedule-meeting-form" class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Meeting Format</label>
                        <select id="mtg-mode" required class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                            <option value="Online">Online</option>
                            <option value="Face-to-face">Face-to-face</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Presentation Date</label>
                            <input type="date" id="mtg-date" required class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Presentation Time</label>
                            <input type="time" id="mtg-time" required class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Duration</label>
                        <select id="mtg-duration" required class="w-full text-xs p-2.5 border border-slate-300 rounded-lg">
                            <option value="30">30 minutes</option>
                            <option value="60" selected>1 hour</option>
                            <option value="90">1 hour 30 minutes</option>
                            <option value="120">2 hours</option>
                        </select>
                    </div>
                    <div id="mtg-conflict-warning" role="alert" aria-live="polite" class="hidden p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800"></div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Meeting Venue / Stream Link</label>
                        <input type="text" id="mtg-venue" required placeholder="e.g. HQ Conference Room A / Zoom Link" class="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500">
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-600 mb-1">Meeting Notes / Agenda</label>
                        <input type="text" id="mtg-notes" maxlength="1000" placeholder="Agenda and presentation items..." class="w-full text-xs p-3 border border-slate-300 rounded-lg">
                    </div>

                    <div class="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                        <button type="button" data-command="closeModal" class="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                        <button type="submit" id="mtg-submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm">Send Meeting Invite</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}


/** Edit an existing meeting in place, without losing its original reference. */
export function renderRescheduleMeetingModal() {
    const meeting = DB.proposalMeetings.find(item => item.id === ui.selectedRecord);
    if (!meeting || !canRescheduleProposalMeeting(meeting.id)) return '';
    const safe = escapeMeetingText;
    const duration = Number(meeting.durationMinutes) || 60;
    const hasIssuedOrder = DB.orders.some(order => order.bidId === meeting.bidId && order.supplierId === meeting.supplierId);
    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="reschedule-meeting-title" class="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200">
          <div class="px-5 sm:px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800"><i class="fa-regular fa-calendar-days"></i> Proposal Schedule</div>
              <h3 id="reschedule-meeting-title" class="font-bold text-slate-900 text-lg">Reschedule Meeting</h3>
              <p class="text-xs text-slate-500 mt-1">${safe(meeting.id)} · ${safe(meeting.supplierName)}</p>
            </div>
            <button type="button" data-command="closeModal" aria-label="Close reschedule form" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <form id="reschedule-meeting-form" class="px-5 sm:px-6 py-5 space-y-4">
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Schedule</p>
              <p class="text-sm font-semibold text-slate-900">${safe(meeting.date)} · ${safe(meeting.time)} (${duration} minutes)</p>
              <p class="text-xs text-slate-600 mt-1">${safe(meeting.meetingMode || 'Meeting')} · ${safe(meeting.venue || 'Venue not provided')}</p>
            </div>
            <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
              <i class="fa-solid fa-circle-info mr-1"></i> Changing the schedule will return this invitation to <strong>Pending Response</strong> and require the supplier to confirm the new time.
              ${hasIssuedOrder ? '<p class="mt-2 font-semibold">A Purchase Order has already been issued for this supplier. Rescheduling this meeting does not amend, cancel, or reverse that Purchase Order, delivery, or payment.</p>' : '<p class="mt-2">The agreement can be finalized only after the supplier confirms the new schedule.</p>'}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label for="reschedule-date" class="block text-xs font-bold uppercase text-slate-600 mb-1">New Date *</label>
                <input id="reschedule-date" type="date" required value="${safe(meeting.date)}" class="w-full text-sm px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700"></div>
              <div><label for="reschedule-time" class="block text-xs font-bold uppercase text-slate-600 mb-1">New Start Time *</label>
                <input id="reschedule-time" type="time" required value="${safe(meeting.time)}" class="w-full text-sm px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700"></div>
              <div><label for="reschedule-duration" class="block text-xs font-bold uppercase text-slate-600 mb-1">Duration *</label>
                <select id="reschedule-duration" required class="w-full text-sm px-3 py-2.5 border border-slate-300 rounded-lg">
                  ${[30,60,90,120].map(minutes => `<option value="${minutes}" ${minutes === duration ? 'selected' : ''}>${minutes === 60 ? '1 hour' : minutes === 90 ? '1 hour 30 minutes' : minutes === 120 ? '2 hours' : '30 minutes'}</option>`).join('')}
                </select></div>
              <div><label for="reschedule-mode" class="block text-xs font-bold uppercase text-slate-600 mb-1">Meeting Format *</label>
                <select id="reschedule-mode" required class="w-full text-sm px-3 py-2.5 border border-slate-300 rounded-lg">
                  <option value="Online" ${meeting.meetingMode === 'Online' ? 'selected' : ''}>Online</option>
                  <option value="Face-to-face" ${meeting.meetingMode === 'Face-to-face' ? 'selected' : ''}>Face-to-face</option>
                </select></div>
            </div>
            <div id="reschedule-conflict-warning" role="alert" aria-live="polite" class="hidden rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-800"></div>
            <div><label for="reschedule-venue" class="block text-xs font-bold uppercase text-slate-600 mb-1">Venue / Online Link *</label>
              <input type="text" id="reschedule-venue" required maxlength="500" value="${safe(meeting.venue)}" class="w-full text-sm px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700"></div>
            <div><label for="reschedule-notes" class="block text-xs font-bold uppercase text-slate-600 mb-1">Agenda / Notes</label>
              <textarea id="reschedule-notes" maxlength="1000" rows="2" class="w-full text-sm px-3 py-2.5 border border-slate-300 rounded-lg">${safe(meeting.notes || '')}</textarea></div>
            <div><label for="reschedule-reason" class="block text-xs font-bold uppercase text-slate-600 mb-1">Reason for Rescheduling *</label>
              <textarea id="reschedule-reason" required minlength="5" maxlength="500" rows="2" placeholder="e.g. Supplier requested an alternative time" class="w-full text-sm px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700"></textarea></div>
            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" data-command="closeModal" class="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700">Keep Current Schedule</button>
              <button id="reschedule-submit" type="submit" class="px-4 py-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-sm"><i class="fa-solid fa-calendar-check mr-1"></i> Send Updated Invite</button>
            </div>
          </form>
        </div>
      </div>`;
}

/** Supplier proposes a new slot; procurement must approve it before any schedule change. */
export function renderRequestMeetingRescheduleModal() {
    const meeting = DB.proposalMeetings.find(m => m.id === ui.selectedRecord);
    if (!meeting || !canRequestMeetingReschedule(meeting.id)) return '';
    const safe = escapeMeetingText;
    const duration = Number(meeting.durationMinutes) || 60;
    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="supplier-reschedule-title" class="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div class="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div><p class="text-xs font-semibold uppercase tracking-wide text-amber-800">Supplier Proposal</p>
              <h3 id="supplier-reschedule-title" class="text-lg font-bold text-slate-900">Request Meeting Reschedule</h3>
              <p class="mt-1 text-xs text-slate-500">${safe(meeting.id)} · Current: ${safe(meeting.date)} at ${safe(meeting.time)}</p></div>
            <button type="button" data-command="closeModal" aria-label="Close form" class="text-slate-400 hover:text-slate-700"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form id="supplier-reschedule-request-form" class="space-y-4 p-5">
            <p class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">The current meeting stays booked until Procurement approves this request. The new schedule must be confirmed by the supplier after approval. Existing Purchase Orders are not changed.</p>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label for="supplier-reschedule-date" class="mb-1 block text-xs font-bold uppercase text-slate-600">Proposed date *</label>
                <input id="supplier-reschedule-date" type="date" required value="${safe(meeting.date)}" class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"></div>
              <div><label for="supplier-reschedule-time" class="mb-1 block text-xs font-bold uppercase text-slate-600">Proposed time *</label>
                <input id="supplier-reschedule-time" type="time" required value="${safe(meeting.time)}" class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"></div>
            </div>
            <div><label for="supplier-reschedule-duration" class="mb-1 block text-xs font-bold uppercase text-slate-600">Duration *</label>
              <select id="supplier-reschedule-duration" class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
                ${[30,60,90,120].map(n => `<option value="${n}" ${n === duration ? 'selected' : ''}>${n} minutes</option>`).join('')}
              </select></div>
            <div id="supplier-reschedule-conflict" class="hidden rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800" role="alert" aria-live="polite"></div>
            <div><label for="supplier-reschedule-reason" class="mb-1 block text-xs font-bold uppercase text-slate-600">Reason for request *</label>
              <textarea id="supplier-reschedule-reason" required minlength="5" maxlength="500" rows="3" placeholder="Explain why you need a different meeting time" class="w-full rounded-lg border border-slate-300 p-3 text-sm"></textarea></div>
            <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" data-command="closeModal" class="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold">Cancel</button>
              <button id="supplier-reschedule-submit" type="submit" class="rounded-lg bg-amber-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-800">Submit Request</button>
            </div>
          </form>
        </div>
      </div>`;
}

/** Only Admin and Procurement Head can approve the supplier's proposed slot. */
export function renderReviewMeetingRescheduleModal() {
    const meeting = DB.proposalMeetings.find(m => m.id === ui.selectedRecord);
    if (!meeting || !canReviewMeetingReschedule(meeting.id)) return '';
    const proposed = meeting.rescheduleRequest;
    const safe = escapeMeetingText;
    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="review-supplier-reschedule-title" class="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div class="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div><p class="text-xs font-bold uppercase tracking-wide text-amber-800">Awaiting Procurement Decision</p>
              <h3 id="review-supplier-reschedule-title" class="text-lg font-bold text-slate-900">Review Schedule Request</h3>
              <p class="mt-1 text-xs text-slate-500">${safe(meeting.id)} · ${safe(meeting.supplierName)}</p></div>
            <button data-command="closeModal" type="button" aria-label="Close" class="text-slate-400 hover:text-slate-700"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form id="review-meeting-reschedule-form" class="space-y-4 p-5">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">Current slot</p><p class="mt-1 text-sm font-semibold text-slate-900">${safe(meeting.date)} at ${safe(meeting.time)}</p><p class="text-xs text-slate-500">${Number(meeting.durationMinutes) || 60} min</p></div>
              <div class="rounded-xl border border-amber-200 bg-amber-50 p-3"><p class="text-xs text-amber-800">Requested slot</p><p class="mt-1 text-sm font-semibold text-slate-900">${safe(proposed.date)} at ${safe(proposed.time)}</p><p class="text-xs text-slate-600">${Number(proposed.durationMinutes)} min</p></div>
            </div>
            <p class="text-sm text-slate-700"><strong>Supplier's reason:</strong> ${safe(proposed.reason)}</p>
            <p class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">Approving will check for new overlaps, update the meeting in place, and require supplier confirmation. Declining keeps the original schedule. Neither action changes an issued Purchase Order.</p>
            <div><label for="review-reschedule-note" class="mb-1 block text-xs font-bold uppercase text-slate-600">Decision note (optional)</label>
              <textarea id="review-reschedule-note" maxlength="500" rows="2" class="w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Provide a reason or any instructions"></textarea></div>
            <div class="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" data-command="closeModal" class="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold">Cancel</button>
              <button type="submit" name="decision" value="Reject" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">Decline Request</button>
              <button id="review-reschedule-approve" type="submit" name="decision" value="Approve" class="rounded-lg bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white">Approve New Schedule</button>
            </div>
          </form>
        </div>
      </div>`;
}

export function renderCancelProposalMeetingModal() {
    const meeting = DB.proposalMeetings.find(item => item.id === ui.selectedRecord);
    if (!meeting || !canCancelProposalMeeting(meeting.id)) return '';
    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200" role="dialog" aria-modal="true" aria-labelledby="cancel-meeting-title">
                <div class="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h3 id="cancel-meeting-title" class="font-bold text-slate-800 text-lg">Cancel Proposal Meeting</h3>
                        <p class="mt-1 text-xs text-slate-500">${escapeMeetingText(meeting.id)} · ${escapeMeetingText(meeting.date)} at ${escapeMeetingText(meeting.time)} · ${escapeMeetingText(meeting.supplierName)}</p>
                    </div>
                    <button type="button" data-command="closeModal" aria-label="Close" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 mb-4">
                    This will mark the meeting as Cancelled and release its reserved time. It will remain in the meeting history.
                    ${DB.orders.some(order => order.bidId === meeting.bidId) ? '<strong>A purchase order has already been issued; cancelling this meeting will NOT cancel or modify that purchase order.</strong>' : ''}
                </div>
                <form id="cancel-meeting-form" class="space-y-4">
                    <div>
                        <label for="mtg-cancel-reason" class="block text-xs font-semibold uppercase text-slate-600 mb-1">Reason for cancellation *</label>
                        <textarea id="mtg-cancel-reason" required minlength="3" maxlength="500" rows="3" placeholder="Explain why this meeting is being cancelled..." class="w-full p-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500"></textarea>
                    </div>
                    <div class="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button type="button" data-command="closeModal" class="px-4 py-2 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg">Keep Meeting</button>
                        <button type="submit" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg">Confirm Cancellation</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}
