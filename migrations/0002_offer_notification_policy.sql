-- Existing rows keep their original individual two-email routing on retries.
ALTER TABLE leads ADD COLUMN consultant_notification_mode TEXT NOT NULL DEFAULT 'individual'
  CHECK (consultant_notification_mode IN ('individual', 'daily', 'immediate-and-daily'));
ALTER TABLE leads ADD COLUMN offer_campaign_title TEXT;

-- Digest eligibility begins only when a new row explicitly opts into the policy.
CREATE INDEX leads_offer_digest_created_at_idx ON leads (consultant_notification_mode, created_at, id);
