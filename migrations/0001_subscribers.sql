-- Email sign-up list ("tell me when new editions come out").
-- Double opt-in: rows start 'pending' and become 'confirmed' when the
-- subscriber clicks the link in the confirmation email. The same token is
-- reused for the unsubscribe link once confirmed.
-- Timestamps are epoch seconds (Drizzle `mode: "timestamp"`).

CREATE TABLE IF NOT EXISTS `subscribers` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `token` text NOT NULL,
  `source` text,
  `created_at` integer NOT NULL,
  `confirm_sent_at` integer,
  `confirmed_at` integer,
  `unsubscribed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `subscribers_email_unique` ON `subscribers` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `subscribers_token_unique` ON `subscribers` (`token`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `subscribers_status_idx` ON `subscribers` (`status`);
