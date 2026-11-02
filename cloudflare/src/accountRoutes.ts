/** Authenticated profile, email verification and private direct messaging.
 * Never trust account roles or sender IDs from JSON. The authenticated session
 * supplies the identity and D1 checks both sides of every conversation.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { gmailSenderConfigured, sendGmailVerificationCode, type GmailSenderEnv } from './gmailDelivery';

type Env = GmailSenderEnv & {
  DB: D1Database;
};
type Identity = { id: string; username: string; email: string; name: string; role: string };
type Row = Record<string, unknown>;

function reply(data: unknown, status = 200, cors: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors } });
}
function str(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function validEmail(email: string): boolean { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validUsername(value: string): boolean { return /^[a-z0-9._-]{3,32}$/i.test(value); }
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function cleanPerson(row: Row) {
  return {
    id: row.id, username: row.username, name: row.name,
    department: row.department, companyName: row.company_name,
    role: row.app_role, bio: row.profile_bio || '', avatar: row.profile_avatar || '',
    discoverable: Boolean(row.profile_discoverable),
  };
}
/** Only publicly-safe details. Formal positions come from Staff Assignments,
 * never from a registration request, self-edited profile or unreviewed delegation.
 */
type Appointment = {user_id: string; step_role: string; department: string};
const normDept = (value: unknown) => str(value).toLowerCase().replace(/\s+/g,' ');
const isFinance = (value: unknown) => ['finance','finance & accounting','finance and accounting'].includes(normDept(value));
function publicPositions(person: Row, appointments: Appointment[]): string[] {
  if (person.role === 'admin') return ['Admin'];
  if (person.role === 'guest' || person.app_role === 'Supplier') return ['Supplier'];
  const dept = normDept(person.department);
  const positions = new Set<string>();
  if (person.app_role === 'Procurement Head' && dept === 'procurement') positions.add('Procurement Head');
  if (person.app_role === 'Procurement Officer' && dept === 'procurement') positions.add('Procurement Officer');
  for (const item of appointments) {
    if (item.user_id !== person.id) continue;
    if (item.step_role === 'Finance Officer' && item.department === '*' && isFinance(dept)) {
      positions.add('Finance Officer');
    } else if (item.step_role === 'Department Head' && normDept(item.department) === dept) {
      if (isFinance(dept)) positions.add('Finance Head');
      else if (dept === 'procurement' && person.app_role === 'Procurement Head') positions.add('Procurement Head');
      else if (dept && dept !== 'procurement' && dept !== 'executive') positions.add('Department Head');
    }
  }
  if (!positions.size) positions.add('Employee');
  return [...positions];
}
async function appointmentMap(env: Env, people: Row[]): Promise<Map<string,Appointment[]>> {
  const ids = people.filter(person => person.role === 'employee').map(person => str(person.id));
  const byUser = new Map<string,Appointment[]>();
  if (!ids.length) return byUser;
  const holders = ids.map(() => '?').join(',');
  const {results} = await env.DB.prepare(`SELECT user_id, step_role, department FROM finance_approvers WHERE user_id IN (${holders})`)
    .bind(...ids).all<Appointment>();
  for (const item of results ?? []) {
    const current = byUser.get(item.user_id) ?? [];
    current.push(item);
    byUser.set(item.user_id, current);
  }
  return byUser;
}
function publicPerson(person: Row, byUser: Map<string,Appointment[]>) {
  const positions = publicPositions(person, byUser.get(str(person.id)) ?? []);
  return { ...cleanPerson(person), positions, displayPosition: positions.join(' / '),
    memberType: person.role === 'guest' ? 'Supplier' : person.role === 'admin' ? 'Admin' : 'Employee' };
}

async function eligiblePeer(env: Env, id: string): Promise<Row | null> {
  return await env.DB.prepare(`SELECT id,username,name,department,company_name,app_role,
    profile_bio,profile_discoverable,profile_avatar FROM users
    WHERE id=? AND status='approved' AND access_revoked=0`)
    .bind(id).first<Row>();
}

export async function handleAccountRoutes(request: Request, env: Env, me: Identity, cors: HeadersInit): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/account/')) return null;

  if (path === '/account/profile' && request.method === 'GET') {
    const row = await env.DB.prepare(`SELECT id,username,name,email,app_role,department,company_name,
      requested_position,profile_bio,profile_discoverable,profile_avatar,email_verified_at,username_aliases,name_aliases
      FROM users WHERE id=?`).bind(me.id).first<Row>();
    if (!row) return reply({ error: 'Profile not found.' }, 404, cors);
    return reply({ profile: { ...cleanPerson(row), email: row.email,
      requestedPosition: row.app_role === 'Supplier' ? 'Supplier' : row.requested_position,
      emailVerified: Boolean(row.email_verified_at),
      // Capability flag only. Never expose the sender credentials to the browser.
      emailDeliveryConfigured: gmailSenderConfigured(env) } }, 200, cors);
  }

  if (path === '/account/profile' && request.method === 'PUT') {
    const body = (await request.json()) as Row;
    const name = str(body.name);
    const username = str(body.username).toLowerCase();
    const bio = str(body.bio);
    if (!name || name.length > 120 || !validUsername(username) || bio.length > 500 ||
        typeof body.discoverable !== 'boolean') {
      return reply({ error: 'Check name (1–120), username (3–32), bio (up to 500) and directory visibility.' }, 400, cors);
    }
    const old = await env.DB.prepare('SELECT username,name,username_aliases,name_aliases FROM users WHERE id=?').bind(me.id).first<{username:string;name:string;username_aliases:string;name_aliases:string}>();
    if (!old) return reply({error:'Profile not found.'},404,cors);
    const changedUsername = username !== old.username.toLowerCase();
    if (changedUsername) {
      const occupied = await env.DB.prepare('SELECT id FROM users WHERE username=? COLLATE NOCASE').bind(username).first<{id:string}>();
      const reserved = await env.DB.prepare('SELECT user_id FROM account_username_history WHERE username=?').bind(username).first<{user_id:string}>();
      if ((occupied && occupied.id !== me.id) || (reserved && reserved.user_id !== me.id)) {
        return reply({error:'Username is unavailable or reserved by a former owner.'},409,cors);
      }
    }
    let aliases: string[] = [];
    try { const parsed = JSON.parse(old.username_aliases); if (Array.isArray(parsed)) aliases = parsed.filter(x => typeof x === 'string'); } catch { /* Old data */ }
    if (changedUsername && !aliases.includes(old.username)) aliases.push(old.username);
    let formerNames:string[]=[];
    try { const parsed=JSON.parse(old.name_aliases);if(Array.isArray(parsed))formerNames=parsed.filter(x=>typeof x==='string'); } catch { /* Old data */ }
    if(name!==old.name && !formerNames.includes(old.name))formerNames.push(old.name);
    try {
      const statements = [env.DB.prepare(`UPDATE users SET name=?,username=?,profile_bio=?,profile_discoverable=?,
        username_aliases=?,name_aliases=?,updated_at=? WHERE id=?`)
        .bind(name,username,bio,body.discoverable ? 1 : 0,JSON.stringify(aliases.slice(-50)),JSON.stringify(formerNames.slice(-50)),new Date().toISOString(),me.id)];
      if (changedUsername) statements.unshift(env.DB.prepare(`INSERT OR IGNORE INTO account_username_history(username,user_id,changed_at) VALUES(?,?,?)`)
        .bind(old.username,me.id,new Date().toISOString()));
      await env.DB.batch(statements);
    } catch (error) {
      if (String(error).includes('UNIQUE')) return reply({error:'Username already taken.'},409,cors);
      throw error;
    }
    return reply({ok:true,username,name},200,cors);
  }

  if (path === '/account/email/request' && request.method === 'POST') {
    const body = (await request.json()) as Row;
    const email = str(body.email).toLowerCase();
    if (!validEmail(email)) return reply({error:'Enter a valid email address.'},400,cors);
    if (!gmailSenderConfigured(env)) {
      return reply({error:'Email verification is not configured. Admin must set the Gmail OAuth secrets on the Worker.'},503,cors);
    }
    const already = await env.DB.prepare(`SELECT id FROM users WHERE lower(email)=? AND id!=?`)
      .bind(email,me.id).first();
    if (already) return reply({error:'This email is already used by another account.'},409,cors);
    const now = Math.floor(Date.now()/1000);
    const recent = await env.DB.prepare('SELECT created_at FROM account_email_verifications WHERE user_id=?')
      .bind(me.id).first<{created_at:number}>();
    if (recent && now - recent.created_at < 60) return reply({error:'Please wait one minute before requesting another code.'},429,cors);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6,'0');
    const hash = await sha256(`${me.id}:${email}:${code}:${env.EMAIL_CODE_HASH_SECRET}`);
    await env.DB.prepare(`INSERT INTO account_email_verifications(user_id,pending_email,code_hash,created_at,expires_at,attempts)
      VALUES(?,?,?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET pending_email=excluded.pending_email,
      code_hash=excluded.code_hash,created_at=excluded.created_at,expires_at=excluded.expires_at,attempts=0`)
      .bind(me.id,email,hash,now,now+600).run();
    const sent = await sendGmailVerificationCode(env, email, code);
    if (!sent) {
      await env.DB.prepare('DELETE FROM account_email_verifications WHERE user_id=? AND code_hash=?').bind(me.id,hash).run();
      return reply({error:'Verification email could not be sent through Gmail. Check OAuth authorization and Worker secrets.'},502,cors);
    }
    return reply({ok:true,message:'Code sent. Check your email.'},200,cors);
  }

  if (path === '/account/email/verify' && request.method === 'POST') {
    const body = (await request.json()) as Row;
    const code = str(body.code);
    if (!/^\d{6}$/.test(code)) return reply({error:'Enter the six-digit code.'},400,cors);
    const pending = await env.DB.prepare('SELECT pending_email,code_hash,expires_at,attempts FROM account_email_verifications WHERE user_id=?')
      .bind(me.id).first<{pending_email:string;code_hash:string;expires_at:number;attempts:number}>();
    const now = Math.floor(Date.now()/1000);
    if (!pending || pending.expires_at <= now || pending.attempts >= 5) return reply({error:'Code expired or attempts exhausted. Request a new code.'},400,cors);
    const hash = await sha256(`${me.id}:${pending.pending_email}:${code}:${env.EMAIL_CODE_HASH_SECRET || ''}`);
    if (hash !== pending.code_hash) {
      await env.DB.prepare('UPDATE account_email_verifications SET attempts=attempts+1 WHERE user_id=?')
        .bind(me.id).run();
      return reply({error:'Incorrect verification code.'},400,cors);
    }
    const occupied = await env.DB.prepare('SELECT id FROM users WHERE lower(email)=? AND id!=?')
      .bind(pending.pending_email,me.id).first();
    if (occupied) return reply({error:'Email is already used by another account.'},409,cors);
    const nowIso = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET email=?,email_verified_at=?,updated_at=? WHERE id=?')
        .bind(pending.pending_email,nowIso,nowIso,me.id),
      env.DB.prepare('DELETE FROM account_email_verifications WHERE user_id=?').bind(me.id),
    ]);
    return reply({ok:true,email:pending.pending_email},200,cors);
  }

  if (path === '/account/avatar' && (request.method === 'PUT' || request.method === 'DELETE')) {
    if (request.method === 'DELETE') {
      await env.DB.prepare('UPDATE users SET profile_avatar=?,updated_at=? WHERE id=?')
        .bind('', new Date().toISOString(), me.id).run();
      return reply({ok:true},200,cors);
    }
    const body=(await request.json()) as Row;
    const avatar=str(body.avatar);
    // Require raster images only: no SVG or content-type spoofing. 60 KiB
    // max decoded size, to bound D1 row size and directory responses.
    const match=avatar.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match || avatar.length > 83000) return reply({error:'Choose a PNG, JPEG or WebP photo smaller than 60 KB after resizing.'},400,cors);
    let bytes:string;
    try {bytes=atob(match[2]);} catch {return reply({error:'Invalid image encoding.'},400,cors);}
    if (!bytes.length || bytes.length>60*1024) return reply({error:'Profile photo is too large.'},400,cors);
    const mime=match[1];
    const png=bytes.startsWith('\x89PNG\r\n\x1a\n');
    const jpg=bytes.charCodeAt(0)===255&&bytes.charCodeAt(1)===216&&bytes.charCodeAt(2)===255;
    const webp=bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';
    if (!(mime==='png'&&png || mime==='jpeg'&&jpg || mime==='webp'&&webp)) return reply({error:'Image format does not match the uploaded file.'},400,cors);
    await env.DB.prepare('UPDATE users SET profile_avatar=?,updated_at=? WHERE id=?')
      .bind(avatar,new Date().toISOString(),me.id).run();
    return reply({ok:true},200,cors);
  }

  if (path === '/account/directory' && request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim().slice(0,80);
    // The Employee Profiles page is employee-only. Apply this before LIMIT so
    // supplier records cannot crowd employees out of search results.
    const employeeOnly = url.searchParams.get('type') === 'employees';
    const pattern = `%${q.replace(/[\\%_]/g,'\\$&')}%`;
    // Only approved, discoverable accounts may appear. This directory never
    // returns contact addresses, account secrets, payroll, or leave records.
    const {results} = await env.DB.prepare(`SELECT u.id,u.username,u.name,u.role,u.app_role,u.department,
      u.company_name,u.profile_bio,u.profile_discoverable,u.profile_avatar
      FROM users u WHERE u.id!=? AND u.status='approved' AND u.access_revoked=0 AND u.profile_discoverable=1
      AND (? = 0 OR u.role IN ('employee','admin'))
      AND (u.name LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\' OR
           u.department LIKE ? ESCAPE '\\' OR u.app_role LIKE ? ESCAPE '\\' OR
           u.company_name LIKE ? ESCAPE '\\' OR EXISTS (
             SELECT 1 FROM finance_approvers a WHERE a.user_id=u.id AND (
               (CASE
                 WHEN a.step_role='Department Head' AND LOWER(TRIM(a.department)) IN ('finance & accounting','finance and accounting','finance') THEN 'Finance Head'
                 WHEN a.step_role='Department Head' AND LOWER(TRIM(a.department))='procurement' THEN 'Procurement Head'
                 ELSE a.step_role
               END) LIKE ? ESCAPE '\\' OR a.department LIKE ? ESCAPE '\\'
             )
           ))
      ORDER BY u.name COLLATE NOCASE LIMIT 60`)
      .bind(me.id, employeeOnly ? 1 : 0, pattern, pattern, pattern, pattern, pattern, pattern, pattern).all<Row>();
    const people = results ?? [];
    const appointments = await appointmentMap(env,people);
    return reply({people:people.map(person=>publicPerson(person,appointments))},200,cors);
  }

  const personMatch = path.match(/^\/account\/people\/([^/]+)$/);
  if (personMatch && request.method === 'GET') {
    const personId = decodeURIComponent(personMatch[1]);
    if (!personId || personId.length > 120) return reply({error:'Invalid account reference.'},400,cors);
    const person = await env.DB.prepare(`SELECT id,username,name,role,app_role,department,company_name,
      profile_bio,profile_discoverable,profile_avatar FROM users
      WHERE id=? AND status='approved' AND access_revoked=0 AND profile_discoverable=1`)
      .bind(personId).first<Row>();
    if (!person) return reply({error:'This profile is unavailable or not shared in the directory.'},404,cors);
    const appointments = await appointmentMap(env,[person]);
    return reply({person:publicPerson(person,appointments)},200,cors);
  }

  // Private-message alerts are sourced from the recipient's D1 inbox, never
  // from the shared procurement snapshot. A caller cannot request another
  // account's alerts or see message content from this endpoint.
  if (path === '/account/message-alerts' && request.method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT m.id, m.sender_id AS senderId,
        COALESCE(u.name, 'Account') AS senderName, m.created_at AS createdAt
      FROM account_direct_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.recipient_id = ? AND m.read_at IS NULL
      ORDER BY m.created_at DESC, m.id DESC LIMIT 100`)
      .bind(me.id).all<{ id: string; senderId: string; senderName: string; createdAt: string }>();
    return reply({ alerts: results ?? [] }, 200, cors);
  }

  if (path === '/account/conversations' && request.method === 'GET') {
    const {results} = await env.DB.prepare(`SELECT p.id,p.username,p.name,p.app_role,p.department,p.company_name,
      p.profile_bio,p.profile_discoverable,p.profile_avatar,
      (SELECT m.body FROM account_direct_messages m WHERE
        (m.sender_id=? AND m.recipient_id=p.id) OR (m.sender_id=p.id AND m.recipient_id=?)
        ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_body,
      (SELECT m.created_at FROM account_direct_messages m WHERE
        (m.sender_id=? AND m.recipient_id=p.id) OR (m.sender_id=p.id AND m.recipient_id=?)
        ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_at,
      (SELECT COUNT(*) FROM account_direct_messages m WHERE m.sender_id=p.id AND m.recipient_id=? AND m.read_at IS NULL) AS unread
      FROM users p WHERE p.id IN (
        SELECT sender_id FROM account_direct_messages WHERE recipient_id=?
        UNION SELECT recipient_id FROM account_direct_messages WHERE sender_id=?
      ) AND p.status='approved' AND p.access_revoked=0
      ORDER BY last_at DESC LIMIT 100`).bind(me.id,me.id,me.id,me.id,me.id,me.id,me.id).all<Row>();
    return reply({conversations:(results??[]).map(row=>({...cleanPerson(row),lastBody:row.last_body,lastAt:row.last_at,unread:Number(row.unread||0)}))},200,cors);
  }

  const readMatch = path.match(/^\/account\/messages\/([^/]+)(\/read)?$/);
  if (readMatch) {
    const peerId = decodeURIComponent(readMatch[1]);
    if (peerId === me.id || peerId.length > 120) return reply({error:'Choose another approved account.'},400,cors);
    const peer = await eligiblePeer(env,peerId);
    if (!peer) return reply({error:'This account is unavailable.'},404,cors);
    if (readMatch[2] === '/read') {
      if (request.method !== 'POST') return reply({error:'Method not allowed.'},405,cors);
      await env.DB.prepare(`UPDATE account_direct_messages SET read_at=? WHERE sender_id=? AND recipient_id=? AND read_at IS NULL`)
        .bind(new Date().toISOString(),peerId,me.id).run();
      return reply({ok:true},200,cors);
    }
    if (request.method === 'GET') {
      const {results} = await env.DB.prepare(`SELECT id,sender_id,recipient_id,body,created_at,read_at
        FROM account_direct_messages WHERE
        (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)
        ORDER BY created_at DESC,id DESC LIMIT 100`).bind(me.id,peerId,peerId,me.id).all<Row>();
      return reply({peer:cleanPerson(peer),messages:(results??[]).reverse()},200,cors);
    }
    if (request.method === 'POST') {
      const body = (await request.json()) as Row;
      const message = str(body.body);
      if (!message || message.length>2000) return reply({error:'Message must contain 1–2000 characters.'},400,cors);
      const minuteAgo = new Date(Date.now()-60_000).toISOString();
      const rate = await env.DB.prepare(`SELECT count(*) AS n FROM account_direct_messages WHERE sender_id=? AND created_at>=?`)
        .bind(me.id,minuteAgo).first<{n:number}>();
      if (Number(rate?.n||0)>=25) return reply({error:'Too many messages. Try again shortly.'},429,cors);
      const id = crypto.randomUUID(); const now = new Date().toISOString();
      await env.DB.prepare('INSERT INTO account_direct_messages(id,sender_id,recipient_id,body,created_at) VALUES(?,?,?,?,?)')
        .bind(id,me.id,peerId,message,now).run();
      return reply({ok:true,message:{id,sender_id:me.id,recipient_id:peerId,body:message,created_at:now,read_at:null}},201,cors);
    }
  }
  return reply({error:'Unknown account endpoint.'},404,cors);
}
