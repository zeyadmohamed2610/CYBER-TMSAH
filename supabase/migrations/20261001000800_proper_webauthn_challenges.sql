-- =============================================================================
-- Migration: 20261001000800_proper_webauthn_challenges.sql
-- Purpose  : Add server-side WebAuthn challenge table and add public_key +
--            sign_count + transports columns to webauthn_credentials so we
--            can do proper server-side signature verification.
--
-- Security model:
--   1. Server generates a random challenge and stores it (5-minute TTL).
--   2. Client calls navigator.credentials.create() / .get() with that challenge.
--   3. Client returns the credential/assertion to the server.
--   4. Server verifies the signature using @simplewebauthn/server.
--   5. Challenge is consumed (deleted) immediately — no replay possible.
-- =============================================================================

-- ── 1. Add missing columns to webauthn_credentials ──────────────────────────
ALTER TABLE public.webauthn_credentials
  ADD COLUMN IF NOT EXISTS public_key         TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sign_count         BIGINT  DEFAULT 0,
  -- Default to ARRAY['internal'] so platform authenticators are always preferred
  ADD COLUMN IF NOT EXISTS transports         TEXT[]  DEFAULT ARRAY['internal'],
  ADD COLUMN IF NOT EXISTS aaguid             TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attestation_object TEXT    DEFAULT NULL;

-- Backfill existing rows that have NULL or empty transports
UPDATE public.webauthn_credentials
  SET transports = ARRAY['internal']
  WHERE transports IS NULL OR transports = '{}'::TEXT[];

COMMENT ON COLUMN public.webauthn_credentials.public_key IS
  'COSE public key (base64url encoded). Used for server-side assertion signature verification.';
COMMENT ON COLUMN public.webauthn_credentials.sign_count IS
  'Authenticator signature counter — incremented on each use. 0 means counter not supported.';
COMMENT ON COLUMN public.webauthn_credentials.transports IS
  'Authenticator transports reported during registration (internal, usb, ble, nfc, hybrid).';

-- ── 2. Create webauthn_challenges table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge    TEXT        NOT NULL,
  auth_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('registration', 'authentication')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes')
);

COMMENT ON TABLE public.webauthn_challenges IS
  'Short-lived server-generated WebAuthn challenges. Consumed immediately after verification.';

-- Note: removed partial index (WHERE expires_at > now()) because now() is
-- not IMMUTABLE in Postgres and causes an error. The expires_at column
-- index below is sufficient for pruning expired challenges efficiently.
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_lookup
  ON public.webauthn_challenges (challenge, type);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires
  ON public.webauthn_challenges (expires_at);

-- ── 3. RLS — only the edge function (service role) accesses this table ───────
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. No user-facing policies needed.
-- Anon / authenticated users cannot read or write challenges directly.

-- ── 4. Auto-prune expired challenges (optional pg_cron if available) ─────────
-- This is best-effort. The edge function always checks expires_at.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'prune-webauthn-challenges',
      '*/5 * * * *',
      $cron$DELETE FROM public.webauthn_challenges WHERE expires_at < now()$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 5. Grant USAGE on sequence (if any) to service_role ─────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webauthn_challenges TO service_role;

-- ── 6. Ensure webauthn_credentials is accessible correctly ──────────────────
GRANT SELECT ON public.webauthn_credentials TO anon;
GRANT SELECT, INSERT, UPDATE ON public.webauthn_credentials TO authenticated;
GRANT ALL ON public.webauthn_credentials TO service_role;
