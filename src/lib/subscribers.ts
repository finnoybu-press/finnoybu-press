// Email sign-up list: double opt-in subscribe, confirm, unsubscribe.
// Server-only. Uses the raw D1 binding (simple single-row statements).
//
// Lifecycle:
//   subscribe(email)  -> row 'pending' + confirmation email (token link)
//   confirm(token)    -> 'confirmed'
//   unsubscribe(token)-> 'unsubscribed' (the confirmed row keeps its token,
//                        so every future mailing can carry an unsubscribe link)
// Subscribing again after unsubscribing starts a fresh pending row/token.

import { sendEmail, escapeHtml } from '~/lib/email';

export type SubscribeResult = 'sent' | 'already-confirmed' | 'recently-sent';
export type ConfirmResult = 'confirmed' | 'already-confirmed' | 'invalid';
export type UnsubscribeResult = 'unsubscribed' | 'already-unsubscribed' | 'invalid';

// Don't resend a confirmation to the same address more often than this.
const RESEND_COOLDOWN_SECONDS = 10 * 60;
// Pending confirmation links expire after this.
const CONFIRM_TTL_SECONDS = 7 * 24 * 60 * 60;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function isValidEmail(email: string): boolean {
  return email.length > 3 && email.length <= 254 && EMAIL_RE.test(email);
}

export function cleanSource(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().slice(0, 120);
  return /^[\w\-/.#:]+$/.test(s) ? s : null;
}

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const now = () => Math.floor(Date.now() / 1000);

interface Row {
  id: string;
  email: string;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  token: string;
  confirm_sent_at: number | null;
}

export async function subscribe(
  db: D1Database,
  email: string,
  source: string | null,
  siteUrl: string,
): Promise<SubscribeResult> {
  const existing = await db
    .prepare('SELECT id, email, status, token, confirm_sent_at FROM subscribers WHERE email = ?')
    .bind(email)
    .first<Row>();

  if (existing?.status === 'confirmed') return 'already-confirmed';
  if (
    existing?.status === 'pending' &&
    existing.confirm_sent_at &&
    now() - existing.confirm_sent_at < RESEND_COOLDOWN_SECONDS
  ) {
    return 'recently-sent';
  }

  const token = newToken();
  const t = now();
  if (existing) {
    await db
      .prepare(
        `UPDATE subscribers
           SET status = 'pending', token = ?, source = COALESCE(?, source),
               confirm_sent_at = ?, confirmed_at = NULL, unsubscribed_at = NULL
         WHERE id = ?`,
      )
      .bind(token, source, t, existing.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO subscribers (id, email, status, token, source, created_at, confirm_sent_at)
         VALUES (?, ?, 'pending', ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), email, token, source, t, t)
      .run();
  }

  const confirmUrl = `${siteUrl.replace(/\/$/, '')}/subscribe/confirm?t=${token}`;
  await sendEmail({
    to: email,
    subject: 'Confirm your Finnoybu Press subscription',
    text: confirmText(confirmUrl),
    html: confirmHtml(confirmUrl),
    replyTo: 'support@finnoybu.org',
  });
  return 'sent';
}

export async function confirm(db: D1Database, token: string): Promise<ConfirmResult> {
  if (!/^[0-9a-f]{48}$/.test(token)) return 'invalid';
  const row = await db
    .prepare('SELECT id, status, confirm_sent_at FROM subscribers WHERE token = ?')
    .bind(token)
    .first<Pick<Row, 'id' | 'status' | 'confirm_sent_at'>>();
  if (!row || row.status === 'unsubscribed') return 'invalid';
  if (row.status === 'confirmed') return 'already-confirmed';
  if (row.confirm_sent_at && now() - row.confirm_sent_at > CONFIRM_TTL_SECONDS) return 'invalid';

  await db
    .prepare(`UPDATE subscribers SET status = 'confirmed', confirmed_at = ? WHERE id = ?`)
    .bind(now(), row.id)
    .run();
  return 'confirmed';
}

export async function unsubscribe(db: D1Database, token: string): Promise<UnsubscribeResult> {
  if (!/^[0-9a-f]{48}$/.test(token)) return 'invalid';
  const row = await db
    .prepare('SELECT id, status FROM subscribers WHERE token = ?')
    .bind(token)
    .first<Pick<Row, 'id' | 'status'>>();
  if (!row) return 'invalid';
  if (row.status === 'unsubscribed') return 'already-unsubscribed';

  await db
    .prepare(`UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ? WHERE id = ?`)
    .bind(now(), row.id)
    .run();
  return 'unsubscribed';
}

// =============================================================================
// Confirmation email (customer-facing: no em dashes)
// =============================================================================

function confirmText(url: string): string {
  return [
    'Thanks for signing up for news from Finnoybu Press.',
    '',
    'Please confirm your email address by opening this link:',
    '',
    url,
    '',
    "We'll email you when new books and new editions come out, and when a book is free for a few days. No spam, and you can unsubscribe at any time.",
    '',
    "If you didn't sign up, just ignore this email and you won't hear from us.",
    '',
    'Finnoybu Press',
    'https://press.finnoybu.org',
  ].join('\n');
}

function confirmHtml(url: string): string {
  const u = escapeHtml(url);
  return `<!doctype html>
<html><body style="font-family:Georgia,'Times New Roman',serif;color:#1c1814;background:#f5efe2;padding:2rem;line-height:1.6;max-width:840px;margin:0 auto;">
  <p style="font-size:0.75rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#6e665a;margin:0 0 1.5rem;">Finnoybu Press</p>
  <p style="font-size:1.125rem;margin:0 0 1.5rem;">Thanks for signing up.</p>
  <p style="margin:0 0 1.5rem;">Please confirm your email address so we can let you know when new books and new editions come out, and when a book is free for a few days.</p>
  <p style="margin:0 0 1.5rem;">
    <a href="${u}" style="display:inline-block;background:#1c1814;color:#f5efe2;padding:0.75rem 1.25rem;text-decoration:none;font-weight:600;font-family:Inter,system-ui,sans-serif;font-size:0.95rem;">Confirm my subscription</a>
  </p>
  <p style="margin:0 0 1.5rem;font-size:0.875rem;color:#6e665a;">Or paste this URL into your browser:<br><span style="word-break:break-all;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.8125rem;">${u}</span></p>
  <hr style="border:0;border-top:1px solid #d4cab2;margin:2rem 0;">
  <p style="font-size:0.875rem;color:#6e665a;margin:0;">No spam, and you can unsubscribe at any time. If you didn't sign up, just ignore this email and you won't hear from us.</p>
</body></html>`;
}
