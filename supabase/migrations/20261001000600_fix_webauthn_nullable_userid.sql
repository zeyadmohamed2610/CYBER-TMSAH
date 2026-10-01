-- =============================================================================
-- Migration: 20261001000600_fix_webauthn_nullable_userid.sql
-- Purpose  : 1. Fix webauthn_credentials table schema, nullability, grants and RLS.
--            2. Backfill existing passkeys from auth.users user_metadata.
--            3. Add RPC passkey_lookup_user to allow resolving passkey credentials.
--            4. Ensure avatar_url column and update policy on public.users.
-- =============================================================================

-- 1. Ensure webauthn_credentials table exists and columns are properly configured
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT,
  counter BIGINT DEFAULT 0,
  device_name TEXT NOT NULL DEFAULT 'هذا الجهاز',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now()
);

-- Make user_id nullable if it was NOT NULL
ALTER TABLE public.webauthn_credentials
  ALTER COLUMN user_id DROP NOT NULL;

-- Ensure credential_id has unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_webauthn_cred_id ON public.webauthn_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_auth_id ON public.webauthn_credentials(auth_id);

-- Enable RLS
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- Permissions
GRANT SELECT ON public.webauthn_credentials TO anon, authenticated;
GRANT ALL ON public.webauthn_credentials TO authenticated, service_role;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage webauthn" ON public.webauthn_credentials;
DROP POLICY IF EXISTS "Public read webauthn" ON public.webauthn_credentials;
DROP POLICY IF EXISTS "webauthn_read_policy" ON public.webauthn_credentials;
DROP POLICY IF EXISTS "webauthn_auth_manage" ON public.webauthn_credentials;

CREATE POLICY "webauthn_read_policy" ON public.webauthn_credentials
  FOR SELECT TO public
  USING (true);

CREATE POLICY "webauthn_auth_manage" ON public.webauthn_credentials
  FOR ALL TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

-- 2. Backfill passkeys from auth.users raw_user_meta_data into webauthn_credentials
DO $$
DECLARE
  u RECORD;
  pk JSONB;
  v_cred_id TEXT;
  v_label TEXT;
  v_created TIMESTAMPTZ;
  v_profile_id UUID;
BEGIN
  FOR u IN SELECT id, raw_user_meta_data FROM auth.users WHERE raw_user_meta_data ? 'passkeys' LOOP
    SELECT id INTO v_profile_id FROM public.users WHERE auth_id = u.id LIMIT 1;
    
    FOR pk IN SELECT * FROM jsonb_array_elements(u.raw_user_meta_data->'passkeys') LOOP
      v_cred_id := pk->>'id';
      IF v_cred_id IS NOT NULL AND length(trim(v_cred_id)) > 0 THEN
        v_label := COALESCE(pk->>'label', 'مفتاح أمان بيومتري');
        BEGIN
          v_created := (pk->>'createdAt')::timestamptz;
        EXCEPTION WHEN OTHERS THEN
          v_created := now();
        END;

        INSERT INTO public.webauthn_credentials (
          auth_id,
          user_id,
          credential_id,
          device_name,
          created_at
        ) VALUES (
          u.id,
          v_profile_id,
          v_cred_id,
          v_label,
          COALESCE(v_created, now())
        )
        ON CONFLICT (credential_id) DO UPDATE SET
          auth_id = EXCLUDED.auth_id,
          user_id = EXCLUDED.user_id,
          device_name = EXCLUDED.device_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 3. Create security definer RPC passkey_lookup_user to reliably find a user by credential_id
CREATE OR REPLACE FUNCTION public.passkey_lookup_user(
  p_credential_id text,
  p_raw_id text DEFAULT NULL
)
RETURNS TABLE (
  auth_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  device_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_auth_id uuid;
  v_user_id uuid;
  v_email text;
  v_full_name text;
  v_role text;
  v_device_name text;
BEGIN
  -- 1. Try matching in webauthn_credentials
  SELECT w.auth_id, w.user_id, w.device_name
  INTO v_auth_id, v_user_id, v_device_name
  FROM public.webauthn_credentials w
  WHERE w.credential_id = p_credential_id
     OR (p_raw_id IS NOT NULL AND w.credential_id = p_raw_id)
  LIMIT 1;

  -- 2. If not found in table, check auth.users metadata JSON
  IF v_auth_id IS NULL THEN
    SELECT u.id, pk->>'label'
    INTO v_auth_id, v_device_name
    FROM auth.users u,
         jsonb_array_elements(COALESCE(u.raw_user_meta_data->'passkeys', '[]'::jsonb)) pk
    WHERE pk->>'id' = p_credential_id
       OR pk->>'rawId' = p_credential_id
       OR (p_raw_id IS NOT NULL AND (pk->>'id' = p_raw_id OR pk->>'rawId' = p_raw_id))
    LIMIT 1;
  END IF;

  IF v_auth_id IS NULL THEN
    RETURN;
  END IF;

  -- 3. Resolve user details from public.users or auth.users
  SELECT 
    pu.id,
    COALESCE(pu.email, au.email),
    COALESCE(pu.full_name, au.raw_user_meta_data->>'full_name'),
    COALESCE(pu.role::text, au.raw_user_meta_data->>'role', 'student')
  INTO v_user_id, v_email, v_full_name, v_role
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.auth_id = au.id
  WHERE au.id = v_auth_id
  LIMIT 1;

  RETURN QUERY SELECT 
    v_auth_id,
    v_user_id,
    v_email,
    v_full_name,
    v_role,
    COALESCE(v_device_name, 'مفتاح أمان بيومتري');
END;
$$;

GRANT EXECUTE ON FUNCTION public.passkey_lookup_user(text, text) TO anon, authenticated, service_role;

-- 4. Ensure avatar_url column exists on users table (idempotent)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add RLS policy to allow authenticated users to update their own avatar_url
DROP POLICY IF EXISTS "Users can update own avatar" ON public.users;
CREATE POLICY "Users can update own avatar" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);
