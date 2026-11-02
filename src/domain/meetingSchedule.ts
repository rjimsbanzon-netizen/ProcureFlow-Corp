import type { ProcurementRecord } from '../types/procurement';

/** Every proposal reserves a time interval, not just its starting minute. */
export const DEFAULT_MEETING_DURATION_MINUTES = 60;
export const ACTIVE_MEETING_STATUSES = ['Pending Response', 'Agreed'] as const;

export interface MeetingSlot {
  date: string;
  time: string;
  durationMinutes?: number;
}

export function meetingDuration(minutes: unknown): number {
  const parsed = Number(minutes);
  return Number.isInteger(parsed) && parsed >= 15 && parsed <= 480
    ? parsed
    : DEFAULT_MEETING_DURATION_MINUTES;
}

/** Treat YYYY-MM-DD and HH:mm as calendar-local fields (no timezone conversion). */
function startMinute(slot: MeetingSlot): number | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(slot.date || '');
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(slot.time || '');
  if (!date || !time) return null;
  const [, year, month, day] = date;
  const stamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(time[1]), Number(time[2]));
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== slot.date) return null;
  return stamp / 60_000;
}

/** Endpoints touching are NOT conflicts: 10:00–11:00 and 11:00–12:00 may coexist. */
export function slotsOverlap(first: MeetingSlot, second: MeetingSlot): boolean {
  const a = startMinute(first);
  const b = startMinute(second);
  if (a === null || b === null) return false;
  return a < b + meetingDuration(second.durationMinutes) && b < a + meetingDuration(first.durationMinutes);
}

/** Cancelled and declined meetings do not reserve a slot. */
export function findMeetingConflicts(
  proposed: MeetingSlot,
  meetings: ReadonlyArray<ProcurementRecord>,
  excludeId?: string
): ProcurementRecord[] {
  return meetings.filter(m =>
    m.id !== excludeId &&
    ACTIVE_MEETING_STATUSES.includes(m.status as typeof ACTIVE_MEETING_STATUSES[number]) &&
    slotsOverlap(proposed, { date: String(m.date || ''), time: String(m.time || ''), durationMinutes: m.durationMinutes })
  );
}

/** Safe for interpolating meeting labels in the existing HTML-template views. */
export function escapeMeetingText(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char] || char));
}
