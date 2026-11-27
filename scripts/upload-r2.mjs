#!/usr/bin/env node
/**
 * Bulk-upload digital book files (PDF + EPUB) to the finnoybu-press-pdfs R2 bucket.
 *
 * Each book lives in a sibling repo under D:\dev\FINNOYBU Press\NN-<name>\,
 * with its built output in output/<date>-<name>-digital.{pdf,epub}.
 *
 * For each book in src/content/books/*.md:
 *   1. Read `number:` from the frontmatter (1-21).
 *   2. Find sibling repo matching NN-* (zero-padded prefix).
 *   3. Find <repo>/output/*-digital.pdf and *-digital.epub (picks the most recent
 *      if multiple, by mtime).
 *   4. Upload to R2 as <slug>/<slug>.{pdf,epub} where <slug> is the .md filename.
 *
 * Auth: relies on CLOUDFLARE_API_TOKEN env var (or `wrangler login` session).
 *
 * Usage:
 *   npm run r2:sync           # all books
 *   npm run r2:sync chatgpt-definitive   # one book (all its products)
 *   npm run r2:sync claude-definitive-2027   # one product
 *   npm run r2:sync -- --dry-run         # list what would upload
 *   npm run r2:sync -- --current-only    # only the 2027 builds (2026 files are already in R2)
 *
 * Products: the book slug holds the book's own edition (the dated 2026 build
 * when the book has a newer_edition); <slug>-<year> holds the newer edition
 * while it is sold direct (the undated NN-<name>-digital build).
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const PRESS_PARENT = join(process.cwd(), '..');
const BOOKS_DIR = 'src/content/books';
const BUCKET = 'finnoybu-press-pdfs';
const FORMATS = ['pdf', 'epub'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
// --current-only: skip products served from the dated 2026 builds (already in
// R2); upload only the current (2027) builds.
const currentOnly = args.includes('--current-only');
const slugFilter = args.find((a) => !a.startsWith('--'));

function extractNumber(mdContent) {
  // Normalize CRLF → LF and strip BOM so the regex doesn't choke on Windows endings.
  const normalized = mdContent.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const fm = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const m = fm[1].match(/^number:\s*(\d+)/m);
  return m ? parseInt(m[1], 10) : null;
}

function findSiblingRepo(number) {
  const prefix = String(number).padStart(2, '0') + '-';
  const dirs = readdirSync(PRESS_PARENT).filter((name) => {
    const full = join(PRESS_PARENT, name);
    return statSync(full).isDirectory() && name.startsWith(prefix);
  });
  return dirs[0] ? join(PRESS_PARENT, dirs[0]) : null;
}

// Digital files in <repo>/output. The 2026 Edition builds are dated
// (2026-04-10-<name>-digital.<ext>); the 2027 Edition builds are not
// (NN-<name>-digital.<ext>). `dated` picks which kind; newest by mtime wins.
function findDigitalFile(repoPath, ext, dated) {
  const outputDir = join(repoPath, 'output');
  if (!existsSync(outputDir)) return null;
  const candidates = readdirSync(outputDir)
    .filter((name) => name.endsWith(`-digital.${ext}`))
    .filter((name) => /^\d{4}-\d{2}-\d{2}-/.test(name) === dated)
    .map((name) => ({ name, path: join(outputDir, name), mtime: statSync(join(outputDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.path ?? null;
}

function hasNewerEdition(mdContent) {
  return /^newer_edition:/m.test(mdContent.replace(/\r\n/g, '\n'));
}

// True when the newer edition lists a pdf-epub format (sold direct).
function newerSoldDirect(mdContent) {
  const t = mdContent.replace(/\r\n/g, '\n');
  const i = t.indexOf('\nnewer_edition:');
  if (i < 0) return false;
  const block = t.slice(i + 1).split(/\n(?=\S)/)[0];
  return /type:\s*pdf-epub/.test(block);
}

function newerYear(mdContent) {
  const t = mdContent.replace(/\r\n/g, '\n');
  const m = t.match(/^newer_edition:\n\s+edition:\s*(\d{4})/m);
  return m ? m[1] : null;
}

if (!existsSync(BOOKS_DIR)) {
  console.error(`Books directory not found: ${BOOKS_DIR}`);
  process.exit(1);
}

const books = readdirSync(BOOKS_DIR)
  .filter((name) => name.endsWith('.md'))
  .map((name) => {
    const slug = basename(name, '.md');
    const content = readFileSync(join(BOOKS_DIR, name), 'utf8');
    const number = extractNumber(content);
    // Products to upload for this book: its own edition under the book slug
    // (dated 2026 build when a newer edition exists, else the current build),
    // plus `<slug>-<year>` for a newer edition sold direct (undated build).
    const products = [{ key: slug, dated: hasNewerEdition(content) }];
    const year = newerYear(content);
    if (year && newerSoldDirect(content)) products.push({ key: `${slug}-${year}`, dated: false });
    return { slug, number, products, mdPath: join(BOOKS_DIR, name) };
  })
  .filter((b) => (slugFilter ? b.slug === slugFilter || b.products.some((p) => p.key === slugFilter) : true));

if (slugFilter && books.length === 0) {
  console.error(`No book found matching slug: ${slugFilter}`);
  process.exit(1);
}

let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const book of books) {
  if (!book.number) {
    console.log(`SKIP  ${book.slug} (no number in frontmatter)`);
    skipped++;
    continue;
  }
  const repo = findSiblingRepo(book.number);
  if (!repo) {
    console.log(`SKIP  ${book.slug} (sibling repo NN=${book.number} not found)`);
    skipped++;
    continue;
  }
  for (const product of book.products) {
    if (slugFilter && slugFilter !== book.slug && slugFilter !== product.key) continue;
    if (currentOnly && product.dated) continue;
    for (const ext of FORMATS) {
      const filePath = findDigitalFile(repo, ext, product.dated);
      if (!filePath) {
        console.log(`SKIP  ${product.key}.${ext} (no ${product.dated ? 'dated ' : ''}*-digital.${ext} in ${basename(repo)}/output)`);
        skipped++;
        continue;
      }
      const key = `${product.key}/${product.key}.${ext}`;
      if (dryRun) {
        console.log(`PLAN  ${key}  <-  ${basename(repo)}/output/${basename(filePath)}`);
        continue;
      }
      try {
        console.log(`PUT   ${key}  <-  ${basename(repo)}/output/${basename(filePath)}`);
        execSync(
          `npx wrangler r2 object put "${BUCKET}/${key}" --file="${filePath}" --remote`,
          { stdio: 'inherit' },
        );
        uploaded++;
      } catch (err) {
        console.error(`FAIL  ${key}: ${err.message}`);
        failed++;
      }
    }
  }
}

console.log(`\nDone: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
