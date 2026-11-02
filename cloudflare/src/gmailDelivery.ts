/**
 * ProcureFlow transactional email through the Gmail API.
 * Requires a one-time OAuth grant to procureflowcorp@gmail.com.
 * All tokens remain in Cloudflare Worker secrets; the public frontend receives
 * only a configured/unconfigured boolean from accountRoutes.
 */
export type GmailSenderEnv = {
  GMAIL_OAUTH_CLIENT_ID?: string;
  GMAIL_OAUTH_CLIENT_SECRET?: string;
  GMAIL_OAUTH_REFRESH_TOKEN?: string;
  EMAIL_CODE_HASH_SECRET?: string;
};

const GMAIL_FROM = 'procureflowcorp@gmail.com';

export function gmailSenderConfigured(env: GmailSenderEnv): boolean {
  return Boolean(env.GMAIL_OAUTH_CLIENT_ID?.trim()
    && env.GMAIL_OAUTH_CLIENT_SECRET?.trim()
    && env.GMAIL_OAUTH_REFRESH_TOKEN?.trim()
    && env.EMAIL_CODE_HASH_SECRET?.trim());
}

function encodeBase64Url(plain: string): string {
  const bytes = new TextEncoder().encode(plain);
  let binary = '';
  // Smaller chunks avoid a large spread call hitting function argument limits.
  for (let i = 0; i < bytes.length; i += 0x4000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x4000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendGmailVerificationCode(
  env: GmailSenderEnv,
  recipient: string,
  code: string,
): Promise<boolean> {
  if (!gmailSenderConfigured(env)) return false;
  // Defense in depth: never allow header injection from an email address.
  if (!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(recipient)) return false;
  if (!/^\d{6}$/.test(code)) return false;

  try {
    const auth = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GMAIL_OAUTH_CLIENT_ID!,
        client_secret: env.GMAIL_OAUTH_CLIENT_SECRET!,
        refresh_token: env.GMAIL_OAUTH_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
      }),
    });
    if (!auth.ok) {
      console.warn('ProcureFlow Gmail token refresh failed', auth.status);
      return false;
    }
    const token = await auth.json() as { access_token?: string };
    if (!token.access_token) return false;

    const message = [
      `From: ProcureFlow <${GMAIL_FROM}>`,
      `To: <${recipient}>`,
      'Subject: ProcureFlow email verification code',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      `Your ProcureFlow verification code is ${code}.`,
      'It expires in 10 minutes.',
      'If you did not request this code, you can ignore this email.',
    ].join('\r\n');

    const sent = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodeBase64Url(message) }),
    });
    if (!sent.ok) console.warn('ProcureFlow Gmail send failed', sent.status);
    return sent.ok;
  } catch {
    // Do not expose Google tokens or provider error bodies in user responses.
    console.warn('ProcureFlow Gmail send unavailable');
    return false;
  }
}
