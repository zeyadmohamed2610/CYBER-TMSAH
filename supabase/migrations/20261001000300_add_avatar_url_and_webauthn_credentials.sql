-- Add avatar_url to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create webauthn_credentials table for biometric / passkey cross-device authentication
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT,
  counter BIGINT DEFAULT 0,
  device_name TEXT NOT NULL DEFAULT 'هذا الجهاز',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage webauthn" ON public.webauthn_credentials;
CREATE POLICY "Users can manage webauthn" ON public.webauthn_credentials FOR ALL TO authenticated USING (auth.uid() = auth_id) WITH CHECK (auth.uid() = auth_id);

DROP POLICY IF EXISTS "Public read webauthn" ON public.webauthn_credentials;
CREATE POLICY "Public read webauthn" ON public.webauthn_credentials FOR SELECT TO public USING (true);
