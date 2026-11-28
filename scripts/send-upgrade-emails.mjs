#!/usr/bin/env node
/**
 * One-off: email the direct buyers who were given a free 2027 Edition.
 *
 * On Nov 28, 2026 each customer who bought a 2026 Edition PDF/ePub on the site
 * was granted the 2027 Edition of the same book (purchases rows with
 * stripe_session_id 'upgrade-2027-free-<user id>'). This script tells them.
 *
 * - Recipients and their books come from the production D1 database via
 *   `wrangler d1 execute --remote`, so addresses never leave your machine.
 * - Mail goes out through Amazon SES (same account the site uses for sign-in
 *   links), From and Reply-To support@finnoybu.org.
 * - Sent addresses are logged to scripts/.upgrade-emails-sent.json (gitignored
 *   pattern below) so a re-run never emails anyone twice.
 *
 * Usage (from the press repo, PowerShell or bash):
 *   node scripts/send-upgrade-emails.mjs            # dry run: prints every email, sends nothing
 *   node scripts/send-upgrade-emails.mjs --send     # sends
 *
 * AWS credentials: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (and optional
 * AWS_REGION, default us-east-1) from the environment, or from .env or
 * .dev.vars in the repo root.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AwsClient } from 'aws4fetch';

const SEND = process.argv.includes('--send');
const FROM = 'Finnoybu Press <support@finnoybu.org>';
const REPLY_TO = 'support@finnoybu.org';
const SUBJECT = 'Your free 2027 Edition is ready';
const ACCOUNT_URL = 'https://press.finnoybu.org/account';
const LOG = join('scripts', '.upgrade-emails-sent.json');

// ---------- config ----------
function loadDotenv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotenv('.env');
loadDotenv('.dev.vars');
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// ---------- book titles ----------
const titles = {};
const numbers = {};
for (const f of readdirSync('src/content/books').filter((n) => n.endsWith('.md'))) {
  const t = readFileSync(join('src/content/books', f), 'utf8').replace(/\r\n/g, '\n');
  const fm = t.split('---\n')[1] || '';
  const get = (k) => (fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1]?.replace(/^["']|["']$/g, '').trim();
  titles[f.replace(/\.md$/, '')] = `${get('title')}: ${get('subtitle')}`;
  numbers[f.replace(/\.md$/, '')] = Number(get('number')) || 99;
}

// ---------- recipients ----------
const sql =
  "SELECT u.email AS email, group_concat(p.book_slug) AS slugs FROM purchases p JOIN user u ON u.id = p.user_id " +
  "WHERE p.stripe_session_id LIKE 'upgrade-2027-free-%' GROUP BY u.email ORDER BY u.email";
const out = execSync(`npx wrangler d1 execute finnoybu-press --remote --json --command "${sql}"`, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
const rows = JSON.parse(out.slice(out.indexOf('[')))[0].results;
const sent = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : [];

// ---------- message ----------
function list(items) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
function message(slugs) {
  const base = slugs.map((s) => s.replace(/-2027$/, '')).sort((a, b) => numbers[a] - numbers[b]);
  const books = base.map((s) => titles[s] || s);
  const n = books.length;
  const lead = n === 1 ? 'This book now has' : n === 2 ? 'Both books now have' : 'All of these books now have';
  const copies = n === 1 ? 'Your 2026 copy is still there too.' : 'Your 2026 copies are still there too.';
  const them = n === 1 ? 'it' : 'them';
  const text = [
    'Hello,',
    '',
    `Thank you for buying ${list(books)} directly from Finnoybu Press.`,
    '',
    `${lead} a 2027 Edition, rewritten for the tools as they work today. As a thank-you to readers who bought from us directly, we've added the 2027 Edition PDF and ePub to your library at no charge. ${copies}`,
    '',
    `Sign in at ${ACCOUNT_URL} to download ${them}.`,
    '',
    'If you have any questions, just reply to this email.',
    '',
    'Ken Tannenbaum',
    'Finnoybu Press',
  ].join('\n');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = `<!doctype html><html><body style="font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#1a1614;max-width:560px">
<p>Hello,</p>
<p>Thank you for buying ${list(books.map((b) => `<em>${esc(b)}</em>`))} directly from Finnoybu Press.</p>
<p>${lead} a 2027 Edition, rewritten for the tools as they work today. As a thank-you to readers who bought from us directly, we've added the 2027 Edition PDF and ePub to your library at no charge. ${copies}</p>
<p><a href="${ACCOUNT_URL}">Sign in to your library</a> to download ${them}.</p>
<p>If you have any questions, just reply to this email.</p>
<p>Ken Tannenbaum<br>Finnoybu Press</p>
</body></html>`;
  return { text, html };
}

// ---------- run ----------
console.log(`${rows.length} recipients${SEND ? '' : ' (dry run: nothing will be sent)'}\n`);
let aws = null;
if (SEND) {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    console.error('Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (env, .env or .dev.vars). Nothing sent.');
    process.exit(1);
  }
  aws = new AwsClient({ accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY, service: 'ses', region: AWS_REGION });
}
let ok = 0;
for (const r of rows) {
  const slugs = r.slugs.split(',');
  const { text, html } = message(slugs);
  if (sent.includes(r.email)) {
    console.log(`SKIP  ${r.email} (already sent)`);
    continue;
  }
  if (!SEND) {
    console.log(`----- To: ${r.email}\nSubject: ${SUBJECT}\n\n${text}\n`);
    continue;
  }
  const res = await aws.fetch(`https://email.${AWS_REGION}.amazonaws.com/v2/email/outbound-emails`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      FromEmailAddress: FROM,
      ReplyToAddresses: [REPLY_TO],
      Destination: { ToAddresses: [r.email] },
      Content: {
        Simple: {
          Subject: { Data: SUBJECT, Charset: 'UTF-8' },
          Body: { Text: { Data: text, Charset: 'UTF-8' }, Html: { Data: html, Charset: 'UTF-8' } },
        },
      },
    }),
  });
  if (!res.ok) {
    console.error(`FAIL  ${r.email}: ${res.status} ${await res.text()}`);
    console.error('Stopped. Fix the error and re-run; already-sent addresses are skipped.');
    process.exit(1);
  }
  sent.push(r.email);
  writeFileSync(LOG, JSON.stringify(sent, null, 2));
  console.log(`SENT  ${r.email}`);
  ok++;
}
if (SEND) console.log(`\nDone: ${ok} sent.`);
