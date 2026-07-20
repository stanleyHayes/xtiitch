-- §3.3: settlement syncs are triggered on the Money Desk read path so payouts
-- show near real time, but a provider pull on EVERY read would hammer the
-- Settlements API. This watermark records when each business's settlements were
-- last mirrored; the read-path sync skips businesses synced inside the throttle
-- window (5 minutes). NULL means "never synced" — the first read syncs.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS settlement_synced_at timestamptz;
