// Minimal AWS SES v2 sender (SigV4 via aws4fetch, works in the Workers
// runtime). Server-only. Auth's magic-link mail has its own copy in
// src/lib/auth.ts; new mail types should use this helper.

import { AwsClient } from 'aws4fetch';
import { getEnv } from '~/lib/env';

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export function isEmailConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
}

export async function sendEmail(msg: OutboundEmail): Promise<void> {
  const env = getEnv();
  const region = env.AWS_REGION || 'us-east-1';
  const from = env.EMAIL_FROM || 'Finnoybu Press <hello@press.finnoybu.org>';

  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    // Dev / unconfigured: log instead of sending so the flow can be tested.
    console.warn(`[email] SES not configured. Would send "${msg.subject}" to ${msg.to}:\n${msg.text}`);
    return;
  }

  const aws = new AwsClient({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    service: 'ses',
    region,
  });

  const body = {
    FromEmailAddress: from,
    Destination: { ToAddresses: [msg.to] },
    ...(msg.replyTo ? { ReplyToAddresses: [msg.replyTo] } : {}),
    Content: {
      Simple: {
        Subject: { Data: msg.subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: msg.text, Charset: 'UTF-8' },
          Html: { Data: msg.html, Charset: 'UTF-8' },
        },
      },
    },
  };

  const res = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[email] SES send failed (${res.status}): ${errBody}`);
    throw new Error(`SES send failed: ${res.status}`);
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
