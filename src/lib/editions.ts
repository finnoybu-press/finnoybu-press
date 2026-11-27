// Direct (on-site) PDF/ePub products and their purchase slugs.
//
// A book's `formats` describe its `edition` (the 2026 Edition for Books 1-28,
// the 2027 Edition for Book 29); its purchase slug is the book id. Books 1-28
// no longer sell their 2026 Edition here (it is in KDP Select on Kindle).
// A `newer_edition` with a pdf-epub format is a second product whose purchase
// slug is `<book id>-<year>`, e.g. `claude-definitive-2027`. That slug is what
// the cart, Stripe metadata, the purchases table and R2 keys use.
import type { CollectionEntry } from 'astro:content';

type Book = CollectionEntry<'books'>;

export interface DirectProduct {
  slug: string;            // purchase slug
  book: Book;
  edition: string;         // e.g. "2027 Edition"
  price: string;           // e.g. "$7.99"
  coverThumb: string;      // cover of that edition
  isNewer: boolean;
  number: number;          // the book's catalog number (sorting only)
}

export function editionYear(edition: string): string | null {
  const m = edition.match(/(\d{4})/);
  return m ? m[1] : null;
}

export function newerSlug(book: Book): string | null {
  const ne = book.data.newer_edition;
  if (!ne) return null;
  const y = editionYear(ne.edition);
  return y ? `${book.id}-${y}` : null;
}

export function directProducts(book: Book): DirectProduct[] {
  const out: DirectProduct[] = [];
  const base = book.data.formats.find((f) => f.type === 'pdf-epub');
  if (base) {
    out.push({
      slug: book.id,
      book,
      edition: book.data.edition,
      price: base.price,
      coverThumb: book.data.edition_cover_thumb || book.data.cover_thumb || book.data.cover_image,
      isNewer: false,
      number: book.data.number,
    });
  }
  const ne = book.data.newer_edition;
  const slug = newerSlug(book);
  const nf = ne?.formats.find((f) => f.type === 'pdf-epub');
  if (ne && slug && nf) {
    out.push({
      slug,
      book,
      edition: ne.edition,
      price: nf.price,
      coverThumb: book.data.cover_thumb || book.data.cover_image,
      isNewer: true,
      number: book.data.number,
    });
  }
  return out;
}

export function allDirectProducts(books: Book[]): DirectProduct[] {
  return books.flatMap(directProducts);
}

export function findDirectProduct(books: Book[], slug: string): DirectProduct | undefined {
  return allDirectProducts(books).find((p) => p.slug === slug);
}

// The product a bundle includes for each book: the newest edition sold direct
// (the 2027 Edition). Bundles never include an older edition.
export function bundleProducts(books: Book[]): DirectProduct[] {
  const byNumber = new Map<number, DirectProduct>();
  for (const p of allDirectProducts(books)) {
    const cur = byNumber.get(p.number);
    const year = Number(editionYear(p.edition) ?? 0);
    if (!cur || year > Number(editionYear(cur.edition) ?? 0)) byNumber.set(p.number, p);
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}
