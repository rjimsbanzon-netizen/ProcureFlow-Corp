import type { D1Database } from '@cloudflare/workers-types';

/**
 * Authenticated, per-account notification receipts.
 * Notification content is derived by the frontend from the existing D1-backed
 * enterprise-state; only read/unread receipts belong in this new D1 table.
 * Never accept a user ID from the browser: always use the validated session user.
 */
type Identity = { id: string };
type Context = { DB: D1Database };

function json(body: unknown, status: number, cors: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

const isValidId = (id: unknown): id is string =>
  typeof id === 'string' && id.trim().length > 0 && id.length <= 180 && !/[\u0000-\u001f\u007f]/.test(id);

export async function handleNotificationRoutes(
  request: Request,
  env: Context,
  sessionUser: Identity,
  cors: HeadersInit,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== '/notifications/read') return null;

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT notification_id FROM notification_reads
       WHERE user_id = ? ORDER BY read_at DESC LIMIT 5000`,
    ).bind(sessionUser.id).all<{ notification_id: string }>();
    return json({ readIds: (results || []).map(row => row.notification_id) }, 200, cors);
  }

  if (request.method === 'POST') {
    let payload: unknown;
    try { payload = await request.json(); }
    catch { return json({ error: 'A JSON body is required.' }, 400, cors); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return json({ error: 'Invalid notification receipt payload.' }, 400, cors);
    }
    const ids = (payload as { ids?: unknown }).ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || !ids.every(isValidId)) {
      return json({ error: 'Provide 1–100 valid notification IDs.' }, 400, cors);
    }
    const distinct = [...new Set(ids as string[])];
    const now = new Date().toISOString();
    // Each statement is parameterized and scoped to the authenticated session account.
    // D1 batch handles all receipts as one transaction; there is no extra KV billing.
    await env.DB.batch(distinct.map(id =>
      env.DB.prepare(
        `INSERT INTO notification_reads (user_id, notification_id, read_at)
         VALUES (?, ?, ?) ON CONFLICT(user_id, notification_id) DO NOTHING`,
      ).bind(sessionUser.id, id, now),
    ));
    return json({ ok: true, saved: distinct.length }, 200, cors);
  }

  return json({ error: 'Method not allowed' }, 405, cors);
}
