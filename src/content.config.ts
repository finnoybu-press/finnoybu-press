import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One buy option on a book page. `was_price` shows struck through before
// `price` (a sale price).
const bookFormat = z.object({
  type: z.enum(['pdf-epub', 'kindle', 'paperback']),
  label: z.string(),                               // e.g. "PDF / EPUB"
  price: z.string(),                               // e.g. "$5.99"
  was_price: z.string().optional(),                // e.g. "$7.99"
  url: z.string().url().optional(),                // missing url = "coming soon" (except pdf-epub, sold via the cart)
});

const books = defineCollection({
  // Astro 6 Content Layer API. `id` is the filename without extension
  // (e.g. chatgpt-definitive.md → "chatgpt-definitive"), matching the slugs
  // used throughout the site and in URLs.
  loader: glob({ pattern: '**/*.md', base: './src/content/books' }),
  schema: z.object({
    // Identity
    number: z.number().int().min(1).max(99),       // 1-21 (catalog position)
    title: z.string(),                             // hero title e.g. "ChatGPT"
    subtitle: z.string(),                          // hero subtitle e.g. "The Definitive Guide"
    series_position: z.string(),                   // "Book One", "Book Eleven", etc.

    // Classification
    collection: z.enum([
      'product-deep-dives',     // 1
      'product-guides',         // 2
      'cross-platform-skills',  // 3
      'aegis-toolkits',         // 4 (toolkits, not books)
      'enterprise-toolkit',     // 5 (toolkit, not books)
      'product-guides-ii',      // 6 Extended Series — Product Guides, Vol. II (22-25)
      'capability-set',         // 7 Extended Series — The Capability Set (26-29)
    ]),
    cover_variant: z.enum(['platform', 'guide', 'skills', 'extended']),

    // Visual
    accent_color: z.string(),                      // hex e.g. "#10a37f"
    cover_image: z.string(),                       // path under /public, e.g. "/images/cover-01-chatgpt-definitive.jpg"
    cover_thumb: z.string().optional(),            // small thumb variant for lists

    // Authoring
    author: z.string().default('Ken Tannenbaum'),
    edition: z.string().default('2026 Edition'),    // edition that `formats` and `chapter_count` describe
    edition_cover_thumb: z.string().optional(),      // that edition's cover thumb, when the page cover shows a newer edition
    publisher: z.string().default('Finnoybu Press'),

    // Content meta
    description: z.string(),                       // 1-2 sentence description
    chapter_count: z.number().int().nullable(),    // null if not yet drafted
    page_estimate: z.string().nullable(),          // "~240" or null

    // Buy links
    formats: z.array(bookFormat),

    // A newer edition, shown above `formats` (which describe `edition`).
    // Its PDF/EPUB is sold direct only while it is not on Amazon: once its
    // Kindle edition goes into KDP Select, drop the pdf-epub entry. Direct
    // purchases of it use the slug `<book id>-<edition year>` (lib/editions.ts).
    // Formats without a url (and not pdf-epub) show "Coming soon".
    newer_edition: z.object({
      edition: z.string(),                         // e.g. "2027 Edition"
      chapter_count: z.number().int().nullable().optional(),
      formats: z.array(bookFormat),
    }).optional(),

    // Editorial extras
    sample_chapter_url: z.string().optional(),     // link to free chapter PDF
    related_books: z.array(z.string()).optional(), // slugs of sibling books

    // Status
    status: z.enum(['draft', 'in-development', 'published']).default('published'),
  }),
});

// Toolkits — AEGIS SMB governance kits. Schema kept compatible with books
// where it makes sense (formats[], accent_color, etc.) so MobileBuyBar etc.
// can be reused, but distinct fields for tier and included docs.
const toolkits = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/toolkits' }),
  schema: z.object({
    number: z.number().int().min(1).max(99),       // 1-3 (SMB Starter/Standard/Pro), 4 (Enterprise)
    tier: z.enum(['starter', 'standard', 'pro', 'enterprise']),
    title: z.string(),                              // e.g. "AEGIS™ SMB Governance Toolkit"
    subtitle: z.string(),                           // e.g. "Starter Edition"

    collection: z.enum(['aegis-toolkits', 'enterprise-toolkit']),

    accent_color: z.string(),
    cover_image: z.string(),                        // landscape cover for hero
    cover_thumb: z.string(),                        // square thumb for grids/lists

    author: z.string().default('Ken Tannenbaum'),
    edition: z.string().default('2026 Edition'),
    publisher: z.string().default('Finnoybu Press'),

    description: z.string(),
    doc_count: z.number().int(),
    docs: z.array(z.string()),                      // list of included documents

    formats: z.array(z.object({
      type: z.enum(['pdf-epub', 'kindle', 'paperback']),
      label: z.string(),
      price: z.string(),
      url: z.string().url().optional(),
    })),

    status: z.enum(['draft', 'in-development', 'published']).default('published'),
  }),
});

export const collections = { books, toolkits };
