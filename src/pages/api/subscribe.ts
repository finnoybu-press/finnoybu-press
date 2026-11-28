import type { APIRoute } from 'astro';
import { getEnv, getSiteUrl } from '~/lib/env';
import { cleanSource, isValidEmail, normalizeEmail, subscribe } from '~/lib/subscribers';

export const prerender = false;

// POST /api/subscribe
// Accepts a plain form post (no-JS fallback: 303 to /subscribe/check-email)
// or a fetch from SignupForm.astro (Accept: application/json -> JSON).
// The response never reveals whether an address is already on the list.
export const POST: APIRoute = async (ctx) => {
  const wantsJson = (ctx.request.headers.get('accept') ?? '').includes('application/json');
  const reply = (ok: boolean, error?: string, status = ok ? 200 : 400) =>
    wantsJson
      ? Response.json(ok ? { ok: true } : { ok: false, error }, { status })
      : ok
        ? ctx.redirect('/subscribe/check-email', 303)
        : ctx.redirect('/subscribe/check-email?error=1', 303);

  let email = '';
  let source: string | null = null;
  let honeypot = '';
  try {
    const type = ctx.request.headers.get('content-type') ?? '';
    if (type.includes('application/json')) {
      const body = (await ctx.request.json()) as Record<string, unknown>;
      email = normalizeEmail(body.email);
      source = cleanSource(body.source);
      honeypot = typeof body.website === 'string' ? body.website : '';
    } else {
      const form = await ctx.request.formData();
      email = normalizeEmail(form.get('email'));
      source = cleanSource(form.get('source'));
      honeypot = String(form.get('website') ?? '');
    }
  } catch {
    return reply(false, 'Something went wrong. Please try again.');
  }

  // Bots fill the hidden field; pretend success and do nothing.
  if (honeypot) return reply(true);

  if (!isValidEmail(email)) {
    return reply(false, 'Please enter a valid email address.');
  }

  const env = getEnv();
  if (!env.DB) {
    return reply(false, 'Sign-up is not available right now. Please try again later.', 503);
  }

  try {
    await subscribe(env.DB, email, source, getSiteUrl(ctx));
    return reply(true);
  } catch (err) {
    console.error('[subscribe] failed', err);
    return reply(false, 'Something went wrong. Please try again in a few minutes.', 500);
  }
};
