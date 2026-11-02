import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

/** Feature 9-11 API. All routes run *after* existing Worker authentication. */
type Env = { DB: D1Database; DOCUMENTS: KVNamespace };
type User = { id: string; name: string; role: string; app_role: string; company_name: string };
type Row = Record<string, any>;
type Snapshot = Record<string, any[]>;
const allowedContexts = ['BID','MEETING','PO','DELIVERY','ISSUE'];
const accreditationTypes = ['Business Registration','Tax Certificate','Business Permit','Other'];
const requiredAccreditation = accreditationTypes.slice(0,3);
const maxFileSize = 5 * 1024 * 1024;
const j = (data: unknown, status: number, cors: HeadersInit) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type':'application/json','Cache-Control':'no-store' } });
const safe = (input: unknown) => typeof input === 'string' ? input.trim() : '';
const adminOrHead = (u: User) => u.role === 'admin' || u.app_role === 'Procurement Head';
const staff = (u: User) => adminOrHead(u) || u.app_role === 'Procurement Officer';
const isSupplier = (u: User) => u.role === 'guest' && u.app_role === 'Supplier';
const lower = (s: unknown) => String(s ?? '').trim().toLowerCase();

async function snapshot(env: Env): Promise<{ data: Snapshot; raw: string }> {
  const row = await env.DB.prepare('SELECT data FROM enterprise_state WHERE id=1').first<{data:string}>();
  const raw = row?.data || '';
  const parsed = raw ? JSON.parse(raw) as Snapshot : {};
  return { raw, data: parsed };
}
function supplierKey(data: Snapshot, user: User): { id: string; name: string } {
  const match = (data.suppliers || []).find(s => lower(s.name) === lower(user.company_name));
  return { id: safe(match?.id) || `supplier-${user.id}`, name: safe(match?.name) || user.company_name || user.name };
}
function context(data: Snapshot, type: string, id: string): { supplierId:string; supplierName:string } | null {
  if (!allowedContexts.includes(type)) return null;
  const entity: Record<string,string> = {BID:'bids',MEETING:'proposalMeetings',PO:'orders',DELIVERY:'deliveries',ISSUE:'amendments'};
  const record = (data[entity[type]] || []).find(x => x.id === id);
  if (!record) return null;
  const order = (type === 'DELIVERY' || type === 'ISSUE')
    ? (data.orders || []).find(x => x.id === record.poId) : null;
  const bid = type === 'MEETING' ? (data.bids || []).find(x => x.id === record.bidId) : null;
  const ref = order || bid || record;
  return { supplierId: safe(ref.supplierId || record.supplierId), supplierName: safe(ref.supplierName || record.supplierName) };
}
function canChat(user: User, partner: {supplierId:string; supplierName:string}, own: {id:string;name:string}) {
  return staff(user) || (isSupplier(user) && Boolean(partner.supplierName) &&
    (lower(partner.supplierName) === lower(own.name) || partner.supplierId === own.id));
}
function accreditedStatus(caseRow: Row | null, files: Row[], today: string): string {
  if (requiredAccreditation.some(cat => files.some(f => f.category === cat && f.valid_until < today) && !files.some(f => f.category === cat && f.valid_until >= today))) return 'Expired';
  if (!caseRow) return 'Not Submitted';
  if (caseRow.status === 'Approved' && requiredAccreditation.some(cat => !files.some(f => f.category === cat && f.valid_until >= today))) return 'Incomplete';
  return String(caseRow.status);
}
async function accreditationFor(env: Env, userId: string) {
  const acct = await env.DB.prepare('SELECT * FROM supplier_accreditations WHERE supplier_user_id=?').bind(userId).first<Row>();
  const docs = (await env.DB.prepare('SELECT id,supplier_user_id,category,file_name,mime_type,size,valid_until,uploaded_at FROM supplier_accreditation_files WHERE supplier_user_id=? ORDER BY uploaded_at DESC').bind(userId).all<Row>()).results;
  const today = new Date().toISOString().slice(0,10);
  return { supplierUserId:userId, status: accreditedStatus(acct, docs, today), reviewNote:acct?.review_note || '', reviewedAt:acct?.reviewed_at || null, documents:docs.map(d=>({id:d.id,category:d.category,fileName:d.file_name,size:d.size,validUntil:d.valid_until,uploadedAt:d.uploaded_at})), missing:requiredAccreditation.filter(cat=>!docs.some(d=>d.category===cat && d.valid_until>=today)) };
}
const validDate = (value:string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
/** Original meeting and purchase order stay independent; only the selected/awarded supplier participates. */
function eligibleMeeting(data: Snapshot, target: Row): boolean {
  const bid = (data.bids || []).find(b => b.id === target.bidId);
  const need = (data.stockNeeds || []).find(n => n.id === target.needId);
  if (!bid || !need || bid.needId !== need.id || bid.supplierId !== target.supplierId) return false;
  return (bid.status === 'Selected' && need.selectedBidId === bid.id) ||
    (data.orders || []).some(o => o.bidId === bid.id && o.supplierId === target.supplierId);
}
function meetingMatches(expected: Row | undefined, target: Row): boolean {
  return Boolean(expected && expected.date === target.date && expected.time === target.time &&
    expected.status === target.status && Number(expected.rescheduleCount || 0) === Number(target.rescheduleCount || 0));
}
function scheduleConflict(meetings: Row[], id: string, date: string, time: string, duration: number): Row | undefined {
  const slotMinute = (d: string, t: string) => Date.parse(`${d}T${t}:00Z`) / 60000;
  const proposedAt = slotMinute(date, time);
  return meetings.find(m => m.id !== id && ['Pending Response', 'Agreed'].includes(m.status) &&
    validDate(safe(m.date)) && /^([01]\d|2[0-3]):[0-5]\d$/.test(safe(m.time)) &&
    proposedAt < slotMinute(m.date, m.time) + (Number.isInteger(Number(m.durationMinutes)) && Number(m.durationMinutes) >= 15 && Number(m.durationMinutes) <= 480 ? Number(m.durationMinutes) : 60) &&
    slotMinute(m.date, m.time) < proposedAt + duration);
}
function validFutureSlot(date: unknown, time: unknown): boolean {
  return validDate(safe(date)) && /^([01]\d|2[0-3]):[0-5]\d$/.test(safe(time)) &&
    Number.isFinite(Date.parse(`${date}T${time}:00+08:00`)) && Date.parse(`${date}T${time}:00+08:00`) > Date.now();
}
async function commitMeeting(env: Env, old: {data:Snapshot;raw:string}, meetingId: string, replacement:Row,
    user:User, action:string, description:string, cors:HeadersInit): Promise<Response> {
  const when = new Date().toISOString();
  const data: Snapshot = {...old.data, proposalMeetings:(old.data.proposalMeetings || []).map(m => m.id === meetingId ? replacement : m)};
  const logs = Array.isArray(data.auditLogs) ? data.auditLogs : [];
  data.auditLogs = [{id:`log-${crypto.randomUUID()}`,timestamp:when.replace('T',' ').slice(0,16),
    user:user.name,role:user.app_role || (user.role === 'admin' ? 'Admin' : 'Supplier'),
    action,details:description},...logs];
  const updated = JSON.stringify(data);
  if (updated.length > 1000000) return j({error:'Workspace too large.'},413,cors);
  const result = await env.DB.prepare("UPDATE enterprise_state SET data=?, updated_at=datetime('now') WHERE id=1 AND data=?")
    .bind(updated,old.raw).run();
  if (result.meta.changes !== 1) return j({error:'Another user changed the workspace. Refresh and try again.'},409,cors);
  return j({ok:true,meeting:replacement},200,cors);
}
const types = new Map([['application/pdf','.pdf'],['image/png','.png'],['image/jpeg','.jpg'],['application/vnd.openxmlformats-officedocument.wordprocessingml.document','.docx']]);
const validText = (v: unknown, min: number, max: number) => typeof v==='string' && v.trim().length>=min && v.trim().length<=max;
const choice = (v: unknown, list: string[]) => typeof v==='string' && list.includes(v);
function validateQuote(q: Row): string | null {
  if (q.version!==1 || !validText(q.offeredModel,2,160)) return 'Provide a version 1 quotation with a valid product model.';
  if (!choice(q.specificationClaim,['fully-compliant','minor-deviations','non-compliant']) ||
      !validText(q.specificationExceptions,q.specificationClaim==='fully-compliant'?0:4,1000)) return 'Describe compliance and required specification exceptions.';
  if (!choice(q.deliveryCommitment,['firm','estimated','conditional'])) return 'Choose a valid delivery commitment.';
  if (!Number.isInteger(q.warrantyMonths) || q.warrantyMonths<0 || q.warrantyMonths>120 ||
      !choice(q.warrantyCoverage,['parts-labor','limited','none']) ||
      (q.warrantyMonths===0)!==(q.warrantyCoverage==='none') ||
      !validText(q.warrantyService,0,500)) return 'Provide a consistent warranty period and coverage.';
  if (![0,7,14,30].includes(q.replacementDays) || !choice(q.paymentCondition,['after-acceptance','net-15','net-30','advance-required']) ||
      !Number.isInteger(q.validityDays) || q.validityDays<1 || q.validityDays>365 ||
      !choice(q.afterSalesSupport,['included','limited','none'])) return 'Complete valid replacement, payment, and after-sales clauses.';
  if (!validText(q.supportingReference,0,160) || !validText(q.additionalClauses,0,1000) || q.supplierDeclaration!==true) return 'Complete and affirm the supplier quotation declaration.';
  return null;
}
export async function resetSourcingHistory(env:Env) {
  // Accreditation belongs to the user account, so it survives procurement resets.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sourcing_messages'),
    env.DB.prepare('DELETE FROM sourcing_deadlines')
  ]);
}


/** Reject new bids via the legacy unrestricted snapshot PUT endpoint. */
export function validateSourcingSnapshotWrite(input: Record<string, unknown>, previous: Record<string, unknown>, user: User): string | null {
  const incoming = Array.isArray(input.bids) ? input.bids as Row[] : [];
  const old = Array.isArray(previous.bids) ? previous.bids as Row[] : [];
  const oldById = new Map(old.map(b => [String(b.id), b]));
  const receivedIds = new Set(incoming.map(b => String(b.id)));
  if (incoming.some(b => !b || !oldById.has(String(b.id)))) {
    return 'New bids must use the secured /sourcing/bids endpoint to enforce deadlines and accreditation.';
  }
  const isFullReset = user.role === 'admin' && ['bids','stockNeeds','requisitions','orders','deliveries'].every(key => Array.isArray(input[key]) && (input[key] as unknown[]).length === 0);
  if (!isFullReset && old.some(b => !receivedIds.has(String(b.id)))) {
    return 'A bid was removed from the local snapshot. Refresh before saving; existing bids cannot be silently discarded.';
  }
  for (const proposed of incoming) {
    const existing = oldById.get(String(proposed.id));
    if (!existing) continue;
    for (const field of ['needId','supplierId','supplierName','unitPrice','totalCost','leadTimeDays','notes','quotationTerms','submittedAt']) {
      if (JSON.stringify(proposed[field] ?? null) !== JSON.stringify(existing[field] ?? null)) {
        return 'Submitted bid details are immutable. Refresh the page and use the existing procurement review workflow.';
      }
    }
    if (String(existing.status) !== String(proposed.status) && !adminOrHead(user)) {
      return 'Only Admin or Procurement Head may change bid selection status.';
    }
  }
  const incomingMeetings = Array.isArray(input.proposalMeetings) ? input.proposalMeetings as Row[] : [];
  const previousMeetings = Array.isArray(previous.proposalMeetings) ? previous.proposalMeetings as Row[] : [];
  const meetingById = new Map(previousMeetings.map(m => [String(m.id),m]));
  const incomingMeetingIds = new Set(incomingMeetings.map(m => String(m.id)));
  if (!isFullReset && previousMeetings.some(m => !incomingMeetingIds.has(String(m.id))))
    return 'Existing proposal meetings cannot be silently removed. Refresh the workspace before saving.';
  for (const proposed of incomingMeetings) {
    const existing = meetingById.get(String(proposed.id));
    if (!existing) {
      if (!adminOrHead(user)) return 'Only Procurement Head or Admin may create proposal meetings.';
      continue; // Preserve the existing authorized new-invitation flow.
    }
    for (const field of ['date','time','durationMinutes','meetingMode','venue','notes','rescheduleRequest',
        'rescheduleCount','rescheduleHistory','rescheduleReason','rescheduledBy','rescheduledAt']) {
      // Existing meeting schedules are now owned by the secured meeting endpoints.
      if (JSON.stringify(proposed[field] ?? null) !== JSON.stringify(existing[field] ?? null))
        return 'Use the secured meeting reschedule workflow instead of saving meeting changes directly.';
    }
    if (existing.rescheduleRequest?.status === 'Pending' && proposed.status !== existing.status)
      return 'Review the pending supplier schedule request before changing the meeting response.';
  }
  return null;
}

export async function handleSourcingRoutes(request:Request, env:Env, user:User, cors:HeadersInit):Promise<Response|null> {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  if (!path.startsWith('/sourcing/')) return null;
  const fail = (message:string, code=400) => j({error:message},code,cors);

  // Authenticated rescheduling: server owns the source of truth, enforces
  // overlap checks, and atomically preserves the existing meeting reference.
  const rescheduleMatch = path.match(/^\/sourcing\/meetings\/([^/]+)\/reschedule$/);
  if (rescheduleMatch && method === 'POST') {
    if (!adminOrHead(user)) return fail('Only Admin or Procurement Head may reschedule meetings.', 403);
    let meetingId = '';
    try { meetingId = decodeURIComponent(rescheduleMatch[1]); } catch { return fail('Invalid meeting reference.'); }
    const body = (await request.json().catch(() => null)) as Row | null;
    if (!body || !validDate(safe(body.date)) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(safe(body.time)) ||
        ![30, 60, 90, 120].includes(body.durationMinutes) || !choice(body.meetingMode, ['Online', 'Face-to-face']) ||
        !validText(body.venue, 1, 500) || !validText(body.notes, 0, 1000) || !validText(body.reason, 5, 500)) {
      return fail('Provide a valid future date/time, duration, format, venue, agenda, and rescheduling reason.');
    }
    // ProcureFlow's calendar uses Philippine local time (UTC+08:00).
    const start = Date.parse(`${body.date}T${body.time}:00+08:00`);
    if (!Number.isFinite(start) || start <= Date.now()) return fail('Choose a future meeting date and time.');
    const old = await snapshot(env);
    if (!old.raw) return fail('Meeting workspace not found.', 404);
    const records = old.data.proposalMeetings || [];
    const target = records.find(m => m.id === meetingId);
    if (!target) return fail('Meeting reference not found. Refresh the page.', 404);
    if (!['Pending Response', 'Agreed', 'Declined'].includes(target.status)) return fail('This meeting can no longer be rescheduled.', 409);
    if (target.rescheduleRequest?.status === 'Pending') return fail('Review the supplier request before changing this meeting.', 409);
    const bid = (old.data.bids || []).find(b => b.id === target.bidId);
    const need = (old.data.stockNeeds || []).find(n => n.id === target.needId);
    const linked = bid && need && bid.needId === need.id && bid.supplierId === target.supplierId;
    const awarded = linked && (old.data.orders || []).some(o => o.bidId === bid.id && o.supplierId === target.supplierId);
    const selected = linked && bid.status === 'Selected' && need.selectedBidId === bid.id;
    if (!selected && !awarded) {
      return fail('This meeting is not linked to the selected or awarded supplier.', 409);
    }
    // Do not alter an existing purchase order. Rescheduling changes only the
    // invitation and supplier response, not order acceptance, delivery or payment.
    const expected = body.expected as Row | undefined;
    if (!expected || expected.date !== target.date || expected.time !== target.time ||
        expected.status !== target.status || Number(expected.rescheduleCount || 0) !== Number(target.rescheduleCount || 0)) {
      return fail('Another user has updated this meeting. Refresh before rescheduling.', 409);
    }
    const slotMinute = (date: string, time: string) => Date.parse(`${date}T${time}:00Z`) / 60000;
    const proposedAt = slotMinute(body.date, body.time);
    const conflicting = records.find(m => m.id !== meetingId && ['Pending Response', 'Agreed'].includes(m.status) &&
      validDate(safe(m.date)) && /^([01]\d|2[0-3]):[0-5]\d$/.test(safe(m.time)) &&
      proposedAt < slotMinute(m.date, m.time) + (Number.isInteger(Number(m.durationMinutes)) && Number(m.durationMinutes) >= 15 && Number(m.durationMinutes) <= 480 ? Number(m.durationMinutes) : 60) &&
      slotMinute(m.date, m.time) < proposedAt + body.durationMinutes);
    if (conflicting) return fail(`Overlapping schedule: ${safe(conflicting.id)} with ${safe(conflicting.supplierName)} on ${safe(conflicting.date)} at ${safe(conflicting.time)}. Select another slot.`, 409);
    if (target.date === body.date && target.time === body.time && Number(target.durationMinutes || 60) === body.durationMinutes &&
        target.meetingMode === body.meetingMode && target.venue === body.venue.trim() && (target.notes || '') === body.notes.trim()) {
      return fail('Change at least one meeting detail before rescheduling.');
    }
    const when = new Date().toISOString();
    const previous = { date:target.date, time:target.time, durationMinutes:target.durationMinutes || 60,
      meetingMode:target.meetingMode, venue:target.venue, notes:target.notes, status:target.status,
      reason:body.reason.trim(), changedAt:when, changedBy:user.name };
    const replacement = {
      ...target, date:body.date, time:body.time, durationMinutes:body.durationMinutes,
      meetingMode:body.meetingMode, venue:body.venue.trim(), notes:body.notes.trim(),
      status:'Pending Response', rescheduleReason:body.reason.trim(),
      rescheduledAt:when, rescheduledBy:user.name,
      rescheduleCount:Number(target.rescheduleCount || 0) + 1,
      rescheduleHistory:[...(Array.isArray(target.rescheduleHistory) ? target.rescheduleHistory : []), previous]
    };
    const data: Snapshot = { ...old.data, proposalMeetings:records.map(m => m.id === meetingId ? replacement : m) };
    const newLogs = Array.isArray(data.auditLogs) ? data.auditLogs : [];
    data.auditLogs = [{ id:`log-${crypto.randomUUID()}`, timestamp:when.replace('T',' ').slice(0,16),
      user:user.name, role:user.app_role || (user.role === 'admin' ? 'Admin' : 'Procurement Head'),
      action:'Proposal Meeting Rescheduled',
      details:`Meeting ${meetingId} with ${safe(target.supplierName)} rescheduled to ${body.date} at ${body.time} (${body.durationMinutes} min). Reason: ${body.reason.trim()}` }, ...newLogs];
    const updated = JSON.stringify(data);
    if (updated.length > 1000000) return fail('Workspace too large.', 413);
    const result = await env.DB.prepare("UPDATE enterprise_state SET data=?, updated_at=datetime('now') WHERE id=1 AND data=?")
      .bind(updated, old.raw).run();
    if (result.meta.changes !== 1) return fail('Another user changed the workspace. Refresh and try again.', 409);
    return j({ ok:true, meeting:replacement }, 200, cors);
  }

  // Suppliers request a new time; this does not alter the booked meeting.
  const requestMatch = path.match(/^\/sourcing\/meetings\/([^/]+)\/reschedule-request$/);
  if (requestMatch && method === 'POST') {
    if (!isSupplier(user)) return fail('Only the invited supplier may request a meeting change.', 403);
    let id = '';
    try { id = decodeURIComponent(requestMatch[1]); } catch { return fail('Invalid meeting reference.'); }
    const body = (await request.json().catch(() => null)) as Row | null;
    if (!body || !validFutureSlot(body.date,body.time) || ![30,60,90,120].includes(body.durationMinutes) ||
        !validText(body.reason,5,500)) return fail('Enter a future date, time, duration, and a reason (5–500 characters).');
    const old = await snapshot(env);
    if (!old.raw) return fail('Meeting workspace not found.', 404);
    const meetings = old.data.proposalMeetings || [];
    const target = meetings.find(m => m.id === id);
    if (!target) return fail('Meeting not found.', 404);
    const own = supplierKey(old.data,user);
    if (target.supplierId !== own.id && lower(target.supplierName) !== lower(own.name))
      return fail("You cannot modify another supplier\'s meeting.",403);
    if (!['Pending Response','Agreed','Declined'].includes(target.status) || !eligibleMeeting(old.data,target))
      return fail('This meeting is no longer eligible for rescheduling.',409);
    if (target.rescheduleRequest?.status === 'Pending') return fail('Your existing schedule request is awaiting procurement review.',409);
    if (!meetingMatches(body.expected,target)) return fail('The meeting changed. Refresh the page before requesting again.',409);
    if (target.date === body.date && target.time === body.time &&
        Number(target.durationMinutes || 60) === body.durationMinutes) return fail('Propose a different meeting time or duration.');
    if (scheduleConflict(meetings,id,body.date,body.time,body.durationMinutes))
      return fail('The proposed time is unavailable. Please select a different time.',409);
    const when = new Date().toISOString();
    const requestData = {date:body.date,time:body.time,durationMinutes:body.durationMinutes,
      reason:body.reason.trim(),requestedBy:user.name,requestedAt:when,status:'Pending'};
    const replacement = {...target,rescheduleRequest:requestData};
    return commitMeeting(env,old,id,replacement,user,'Meeting Reschedule Requested',
      `Supplier ${safe(target.supplierName)} requested ${id} be moved to ${body.date} ${body.time}.`,cors);
  }

  // Procurement managers decide on a supplier's request. Approval changes the existing meeting,
  // but the supplier must accept the resulting revised invitation.
  const decisionMatch = path.match(/^\/sourcing\/meetings\/([^/]+)\/reschedule-request\/decision$/);
  if (decisionMatch && method === 'POST') {
    if (!adminOrHead(user)) return fail('Only Admin or Procurement Head may review schedule requests.',403);
    let id = '';
    try { id = decodeURIComponent(decisionMatch[1]); } catch { return fail('Invalid meeting reference.'); }
    const body = (await request.json().catch(() => null)) as Row | null;
    if (!body || !choice(body.decision,['Approve','Reject']) || !validText(body.note,0,500))
      return fail('Select Approve or Reject and provide a valid review note.');
    const old = await snapshot(env);
    if (!old.raw) return fail('Meeting workspace not found.',404);
    const meetings = old.data.proposalMeetings || [];
    const target = meetings.find(m => m.id === id);
    if (!target) return fail('Meeting not found.',404);
    const requested = target.rescheduleRequest;
    if (!requested || requested.status !== 'Pending' ||
        !['Pending Response','Agreed','Declined'].includes(target.status) ||
        !eligibleMeeting(old.data,target)) return fail('No eligible reschedule request remains for this meeting.',409);
    if (!meetingMatches(body.expected,target) || body.expected.requestedAt !== requested.requestedAt)
      return fail('This request has changed. Refresh before reviewing.',409);
    const when = new Date().toISOString();
    const reviewed = {...requested,status:body.decision === 'Approve' ? 'Approved' : 'Rejected',
      reviewedAt:when,reviewedBy:user.name,reviewNote:body.note.trim()};
    if (body.decision === 'Reject') {
      return commitMeeting(env,old,id,{...target,rescheduleRequest:reviewed},user,'Meeting Reschedule Rejected',
        `Request to move ${id} from ${safe(target.supplierName)} declined.`,cors);
    }
    if (!validFutureSlot(requested.date,requested.time) || ![30,60,90,120].includes(requested.durationMinutes))
      return fail("The supplier\'s proposed date/time is no longer valid. Decline this request and ask for another.",409);
    const conflict = scheduleConflict(meetings,id,requested.date,requested.time,requested.durationMinutes);
    if (conflict) return fail(`The requested time now overlaps ${safe(conflict.id)} (${safe(conflict.date)} at ${safe(conflict.time)}). Decline or choose another time.`,409);
    const previous = {date:target.date,time:target.time,durationMinutes:target.durationMinutes || 60,
      meetingMode:target.meetingMode,venue:target.venue,notes:target.notes,status:target.status,
      reason:requested.reason,changedAt:when,changedBy:user.name};
    const replacement = {...target,date:requested.date,time:requested.time,durationMinutes:requested.durationMinutes,
      status:'Pending Response',rescheduleRequest:reviewed,rescheduleReason:requested.reason,
      rescheduledBy:user.name,rescheduledAt:when,rescheduleCount:Number(target.rescheduleCount || 0) + 1,
      rescheduleHistory:[...(Array.isArray(target.rescheduleHistory) ? target.rescheduleHistory : []),previous]};
    return commitMeeting(env,old,id,replacement,user,'Meeting Reschedule Approved',
      `Supplier request approved for ${id}; new meeting time ${requested.date} at ${requested.time}. Supplier confirmation required.`,cors);
  }

  if (path === '/sourcing/deadlines' && method === 'GET') {
    const rows = (await env.DB.prepare('SELECT need_id,closes_at,manually_closed FROM sourcing_deadlines').all<Row>()).results;
    return j({deadlines:rows.map(r=>({needId:r.need_id,closesAt:r.closes_at,manuallyClosed:Boolean(r.manually_closed),open:!r.manually_closed && Date.parse(r.closes_at)>Date.now()})),serverNow:new Date().toISOString()},200,cors);
  }
  const deadlineMatch = path.match(/^\/sourcing\/deadlines\/([^/]+)$/);
  if (deadlineMatch && method === 'PUT') {
    if (!adminOrHead(user)) return fail('Only Admin or Procurement Head may configure bidding deadlines.',403);
    const needId = decodeURIComponent(deadlineMatch[1]);
    const body = await request.json() as Row;
    const closesAt = safe(body.closesAt);
    const manualClosed = body.manuallyClosed === true;
    if (!closesAt || !Number.isFinite(Date.parse(closesAt)) || !/Z$/.test(closesAt) || (!manualClosed && Date.parse(closesAt) <= Date.now())) return fail('Enter a future UTC deadline (with Z) before opening bidding.');
    const {data}=await snapshot(env);
    if (!(data.stockNeeds || []).some(x=>x.id===needId && x.status==='Published')) return fail('This stock need is not published or no longer accepts bids.',409);
    await env.DB.prepare('INSERT INTO sourcing_deadlines(need_id,closes_at,manually_closed,updated_by) VALUES(?,?,?,?) ON CONFLICT(need_id) DO UPDATE SET closes_at=excluded.closes_at,manually_closed=excluded.manually_closed,updated_by=excluded.updated_by,updated_at=datetime(\'now\')')
      .bind(needId,new Date(closesAt).toISOString(),manualClosed?1:0,user.id).run();
    return j({ok:true,needId,closesAt:new Date(closesAt).toISOString(),manuallyClosed:manualClosed},200,cors);
  }

  if (path === '/sourcing/bids' && method === 'GET') {
    if (!adminOrHead(user) && !isSupplier(user)) return fail('Only Procurement Head, Admin, or the submitting supplier may view quotations.',403);
    const {data}=await snapshot(env);
    const own=isSupplier(user)?supplierKey(data,user):null;
    const bids=isSupplier(user)?(data.bids || []).filter(b=>b.supplierId===own?.id||(own?.name&&lower(b.supplierName)===lower(own.name))):(data.bids||[]);
    return j({bids},200,cors);
  }

  // Server-side acceptance: a tampered browser cannot submit after the deadline.
  if (path === '/sourcing/bids' && method === 'POST') {
    if (!isSupplier(user)) return fail('Only approved supplier accounts may submit a quotation.',403);
    const body = await request.json() as Row;
    const needId = safe(body.needId);
    const unit = Number(body.unitPrice), days = Number(body.leadTimeDays);
    if (!needId || !Number.isFinite(unit) || unit<=0 || unit>1e10 || !Number.isInteger(days) || days<1 || days>365) return fail('Enter a valid procurement need, price, and delivery lead time.');
    const terms = body.quotationTerms;
    if (JSON.stringify(body).length > 15000) return fail('Quotation details are too large.');
    if (!terms || typeof terms !== 'object') return fail('Complete the quotation terms.');
    const termsError=validateQuote(terms);
    if (termsError) return fail(termsError);
    const accredited = await accreditationFor(env,user.id);
    if (accredited.status !== 'Approved') return fail(`Accreditation required before submitting a bid (status: ${accredited.status}).`,403);
    const deadline = await env.DB.prepare('SELECT closes_at,manually_closed FROM sourcing_deadlines WHERE need_id=?').bind(needId).first<Row>();
    if (!deadline || deadline.manually_closed || Date.parse(deadline.closes_at)<=Date.now()) return fail('Bidding is closed or the submission deadline has not been configured.',409);
    for (let attempt=0; attempt<4; attempt++) {
      const {data,raw} = await snapshot(env);
      if (!raw) return fail('The procurement workspace has not been created yet.',409);
      const need=(data.stockNeeds || []).find(n=>n.id===needId);
      if (!need || need.status!=='Published') return fail('This procurement requirement is no longer open for bidding.',409);
      const own=supplierKey(data,user);
      if ((data.bids || []).some(b=>b.needId===needId && (b.supplierId===own.id || lower(b.supplierName)===lower(own.name)))) return fail('Your supplier account has already submitted a bid for this need.',409);
      // Recheck deadline as near as possible to commit, including when retries occur.
      if (deadline.manually_closed || Date.parse(deadline.closes_at)<=Date.now()) return fail('The bidding deadline has passed.',409);
      const bid={id:`BID-${crypto.randomUUID()}`,needId,supplierId:own.id,supplierName:own.name,unitPrice:unit,totalCost:Math.round(unit*Number(need.targetQty)*100)/100,leadTimeDays:days,notes:safe(body.notes).slice(0,1000)||safe(terms.offeredModel),quotationTerms:terms,submittedAt:new Date().toISOString(),status:'Submitted'};
      if (!Number.isFinite(bid.totalCost) || bid.totalCost<=0) return fail('Invalid total quotation amount.');
      const dataCopy={...data,bids:[bid,...(data.bids||[])],auditLogs:[{id:`log-${crypto.randomUUID()}`,action:'Bid Submitted',details:`${own.name} submitted a quotation for ${needId}`,user:own.name,role:'Supplier',timestamp:new Date().toISOString()},...(data.auditLogs||[])]};
      const updated=await env.DB.prepare('UPDATE enterprise_state SET data=?,updated_at=datetime(\'now\') WHERE id=1 AND data=?').bind(JSON.stringify(dataCopy),raw).run();
      if (updated.meta.changes===1) return j({ok:true,bid},201,cors);
    }
    return fail('Another user updated the workspace. Refresh and retry the bid submission.',409);
  }

  // Cross-device notification feed for the authenticated account. Never expose
  // another supplier's discussion, and never notify the sender about their own message.
  // Read/unread receipts use the existing /notifications/read D1 endpoint.
  if (path === '/sourcing/message-alerts' && method === 'GET') {
    if (!staff(user) && !isSupplier(user)) return fail('Messaging is not available to this account.', 403);
    const { data } = await snapshot(env);
    const own = supplierKey(data, user);
    const supplierAccount = isSupplier(user);
    // Keep the query bounded and use D1's supplier_id index when available.
    // Do not include message bodies in the notification response.
    const sql = `SELECT id,entity_type,entity_id,supplier_id,sender_user_id,sender_name,created_at
      FROM sourcing_messages ${supplierAccount ? 'WHERE supplier_id = ?' : ''}
      ORDER BY created_at DESC,id DESC LIMIT 300`;
    const query = env.DB.prepare(sql);
    const messages = (await (supplierAccount ? query.bind(own.id) : query).all<Row>()).results;
    const partnerCache = new Map<string, {supplierId:string; supplierName:string} | null>();
    const alerts = [] as Array<{id:string;entityType:string;entityId:string;senderName:string;createdAt:string}>;
    for (const row of messages) {
      if (row.sender_user_id === user.id) continue;
      const key = `${row.entity_type}|${row.entity_id}`;
      if (!partnerCache.has(key)) partnerCache.set(key, context(data, String(row.entity_type), String(row.entity_id)));
      const partner = partnerCache.get(key);
      if (!partner || !partner.supplierName || !canChat(user, partner, own)) continue;
      alerts.push({id:String(row.id),entityType:String(row.entity_type),entityId:String(row.entity_id),
        senderName:String(row.sender_name),createdAt:String(row.created_at)});
      if (alerts.length >= 200) break;
    }
    return j({alerts}, 200, cors);
  }

  if (path==='/sourcing/messages' && (method==='GET'||method==='POST')) {
    const body=method==='POST' ? await request.json() as Row : null;
    const type=safe(body?.entityType || url.searchParams.get('entityType'));
    const id=safe(body?.entityId || url.searchParams.get('entityId'));
    const {data}=await snapshot(env);
    const partner=context(data,type,id);
    if (!partner || !partner.supplierName) {
      // This is a missing cloud record, not an unregistered API route.
      // Do not recreate a quotation from an untrusted client snapshot.
      return fail(`Cannot open ${type || 'transaction'} ${id || ''}: the original transaction is missing from shared Cloudflare records. Ask Admin to restore the original record from a verified backup. Do not create a duplicate.`,409);
    }
    if (!canChat(user,partner,supplierKey(data,user))) return fail('This discussion is not available to your account.',403);
    if (method==='GET') {
      const messages=(await env.DB.prepare('SELECT id,entity_type,entity_id,sender_user_id,sender_name,sender_role,body,created_at FROM sourcing_messages WHERE entity_type=? AND entity_id=? ORDER BY created_at ASC,id ASC LIMIT 400').bind(type,id).all<Row>()).results;
      return j({messages:messages.map(m=>({id:m.id,entityType:m.entity_type,entityId:m.entity_id,senderUserId:m.sender_user_id,senderName:m.sender_name,senderRole:m.sender_role,body:m.body,createdAt:m.created_at}))},200,cors);
    }
    const message=safe(body?.message);
    if (!message || message.length>2000) return fail('Message must contain 1–2000 characters.');
    const uid=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO sourcing_messages(id,entity_type,entity_id,supplier_id,sender_user_id,sender_name,sender_role,body,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(uid,type,id,partner.supplierId,user.id,user.name,user.app_role,message,new Date().toISOString()).run();
    return j({ok:true,id:uid},201,cors);
  }

  if (path==='/sourcing/accreditation' && method==='GET') {
    if (!isSupplier(user) && !adminOrHead(user)) return fail('Supplier or procurement management access required.',403);
    if (isSupplier(user)) return j({cases:[{...(await accreditationFor(env,user.id)),name:user.company_name||user.name}]},200,cors);
    const accounts=(await env.DB.prepare("SELECT id,name,company_name FROM users WHERE role='guest' AND status='approved' AND access_revoked=0 ORDER BY company_name").all<Row>()).results;
    return j({cases:await Promise.all(accounts.map(async u=>({...await accreditationFor(env,u.id),name:u.company_name||u.name})))},200,cors);
  }
  if (path==='/sourcing/accreditation/files' && method==='POST') {
    if (!isSupplier(user)) return fail('Only suppliers may submit accreditation documents.',403);
    const form=await request.formData();
    const category=safe(form.get('category')), validUntil=safe(form.get('validUntil'));
    const file=form.get('file');
    if (!accreditationTypes.includes(category)||!validDate(validUntil)||validUntil<=new Date().toISOString().slice(0,10)) return fail('Select a valid document category and a future expiry date.');
    if (!(file instanceof File)||file.size<1||file.size>maxFileSize||!types.has(file.type) || !(file.type==='image/jpeg' ? /\.jpe?g$/i.test(file.name) : String(file.name).toLowerCase().endsWith(types.get(file.type)!))) return fail('Allowed files: PDF, PNG, JPG, DOCX (maximum 5 MB).');
    const name=String(file.name).replace(/[^\w.\- ()]/g,'_').slice(0,180);
    const fileId=crypto.randomUUID(), key=`sourcing/accreditation/${user.id}/${fileId}`;
    await env.DOCUMENTS.put(key,await file.arrayBuffer());
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO supplier_accreditation_files(id,supplier_user_id,category,file_name,mime_type,size,kv_key,valid_until) VALUES(?,?,?,?,?,?,?,?)')
          .bind(fileId,user.id,category,name,file.type,file.size,key,validUntil),
        env.DB.prepare("INSERT INTO supplier_accreditations(supplier_user_id,status,review_note,reviewed_by,reviewed_at) VALUES(?,'Pending','',NULL,NULL) ON CONFLICT(supplier_user_id) DO UPDATE SET status='Pending',review_note='',reviewed_by=NULL,reviewed_at=NULL,updated_at=datetime('now')").bind(user.id)
      ]);
    } catch(e) { await env.DOCUMENTS.delete(key); throw e; }
    return j({ok:true,fileId},201,cors);
  }
  const fileMatch=path.match(/^\/sourcing\/accreditation\/files\/([^/]+)$/);
  if (fileMatch && (method==='GET'||method==='DELETE')) {
    const file=await env.DB.prepare('SELECT * FROM supplier_accreditation_files WHERE id=?').bind(decodeURIComponent(fileMatch[1])).first<Row>();
    if (!file) return fail('Accreditation document not found.',404);
    if (file.supplier_user_id!==user.id && !adminOrHead(user)) return fail('Access denied.',403);
    if (method==='GET') {
      const bytes=await env.DOCUMENTS.get(file.kv_key,'arrayBuffer');
      if (!bytes) return fail('Document storage object is missing.',404);
      const cleanName=String(file.file_name).replace(/["\r\n\\]/g,'_');
      return new Response(bytes,{status:200,headers:{...cors,'Content-Type':file.mime_type,'Content-Disposition':`attachment; filename="${cleanName}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    if (file.supplier_user_id!==user.id) return fail('Only the supplier may replace or delete their uploaded document.',403);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM supplier_accreditation_files WHERE id=?').bind(file.id),
      env.DB.prepare("UPDATE supplier_accreditations SET status='Pending',review_note='',reviewed_by=NULL,reviewed_at=NULL,updated_at=datetime('now') WHERE supplier_user_id=?").bind(user.id)
    ]);
    await env.DOCUMENTS.delete(file.kv_key);
    return j({ok:true},200,cors);
  }
  const review=path.match(/^\/sourcing\/accreditation\/review\/([^/]+)$/);
  if (review && method==='POST') {
    if (!adminOrHead(user)) return fail('Only Admin or Procurement Head may review accreditation.',403);
    const id=decodeURIComponent(review[1]);
    const account=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='guest' AND status='approved' AND access_revoked=0").bind(id).first();
    if (!account) return fail('Active supplier account not found.',404);
    const body=await request.json() as Row;
    const status=safe(body.status),note=safe(body.note);
    if (!['Approved','Rejected'].includes(status)||note.length>1000||(status==='Rejected'&&!note)) return fail('Choose Approved or Rejected, and provide a rejection reason.');
    const data=await accreditationFor(env,id);
    if (status==='Approved' && data.missing.length) return fail(`Required documents missing or expired: ${data.missing.join(', ')}`,409);
    await env.DB.prepare("INSERT INTO supplier_accreditations(supplier_user_id,status,review_note,reviewed_by,reviewed_at) VALUES(?,?,?,?,?) ON CONFLICT(supplier_user_id) DO UPDATE SET status=excluded.status,review_note=excluded.review_note,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,updated_at=datetime('now')")
      .bind(id,status,note,user.id,new Date().toISOString()).run();
    return j({ok:true,status},200,cors);
  }
  return fail('Unknown sourcing endpoint.',404);
}
