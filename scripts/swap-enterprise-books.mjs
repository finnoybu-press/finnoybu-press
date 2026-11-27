#!/usr/bin/env node
/**
 * Swap the two book PDFs inside the Enterprise Toolkit ZIP for their 2027
 * Edition builds.
 *
 * The 2026 Editions are in KDP Select (Kindle-exclusive), so the ZIP must
 * carry the 2027 Edition PDFs of Book 20 (AI Governance for Practitioners) and
 * Book 21 (Securing Agentic AI) instead.
 *
 * Steps:
 *   1. Download finnoybu-press-pdfs/enterprise/enterprise.zip from R2.
 *   2. Extract it to a temp folder (Windows tar handles ZIP).
 *   3. Replace every PDF whose name starts with "20-" / "21-" or a dated
 *      "YYYY-MM-DD-" prefix of those books with the undated 2027 build from
 *      the sibling repos (..\NN-<name>\output\NN-<name>-digital.pdf).
 *   4. Re-zip and upload back to the same key.
 *
 * Usage (from the press repo):
 *   node scripts/swap-enterprise-books.mjs --dry-run   # show the plan, upload nothing
 *   node scripts/swap-enterprise-books.mjs             # do it
 *
 * Auth: wrangler login session or CLOUDFLARE_API_TOKEN, as for r2:sync.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

const BUCKET = 'finnoybu-press-pdfs';
const KEY = 'enterprise/enterprise.zip';
const PRESS_PARENT = join(process.cwd(), '..');
const dryRun = process.argv.includes('--dry-run');

const BOOKS = [
  { number: 20, match: /governance/i },
  { number: 21, match: /securing/i },
];

function sh(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function siblingRepo(number) {
  const prefix = String(number).padStart(2, '0') + '-';
  const d = readdirSync(PRESS_PARENT).find((n) => n.startsWith(prefix) && statSync(join(PRESS_PARENT, n)).isDirectory());
  return d ? join(PRESS_PARENT, d) : null;
}

function newBuild(number) {
  const repo = siblingRepo(number);
  if (!repo) return null;
  const out = join(repo, 'output');
  if (!existsSync(out)) return null;
  const c = readdirSync(out)
    .filter((n) => n.endsWith('-digital.pdf') && !/^\d{4}-\d{2}-\d{2}-/.test(n))
    .map((n) => ({ p: join(out, n), m: statSync(join(out, n)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return c[0]?.p ?? null;
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const work = join(tmpdir(), `enterprise-zip-${Date.now()}`);
const extracted = join(work, 'x');
mkdirSync(extracted, { recursive: true });
const zipIn = join(work, 'enterprise.zip');
const zipOut = join(work, 'enterprise-new.zip');

sh(`npx wrangler r2 object get "${BUCKET}/${KEY}" --remote --file "${zipIn}"`);
sh(`tar -xf "${zipIn}" -C "${extracted}"`);

const files = walk(extracted);
console.log('\nZIP contents:');
for (const f of files) console.log('  ' + f.slice(extracted.length + 1));

let failed = false;
for (const b of BOOKS) {
  const build = newBuild(b.number);
  const olds = files.filter((f) => f.toLowerCase().endsWith('.pdf') && b.match.test(basename(f)));
  if (!build) { console.error(`\nBook ${b.number}: no 2027 build found in its output folder.`); failed = true; continue; }
  if (olds.length !== 1) { console.error(`\nBook ${b.number}: expected 1 matching PDF in the ZIP, found ${olds.length}.`); failed = true; continue; }
  const old = olds[0];
  const dest = join(old, '..', basename(build));
  console.log(`\nBook ${b.number}: ${basename(old)}  ->  ${basename(build)}`);
  if (!dryRun) {
    rmSync(old);
    copyFileSync(build, dest);
  }
}
if (failed) { console.error('\nStopped: nothing uploaded.'); process.exit(1); }

if (dryRun) {
  console.log('\nDry run: nothing changed in R2.');
  process.exit(0);
}

// tar -a picks the format from the .zip extension (bsdtar, built into Windows).
const top = readdirSync(extracted).map((n) => `"${n}"`).join(' ');
sh(`tar -a -c -f "${zipOut}" ${top}`, { cwd: extracted });
sh(`npx wrangler r2 object put "${BUCKET}/${KEY}" --remote --file "${zipOut}" --content-type application/zip`);
console.log('\nDone: Enterprise Toolkit ZIP now carries the 2027 Edition PDFs of Books 20 and 21.');
