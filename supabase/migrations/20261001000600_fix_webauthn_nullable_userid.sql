-- Fix webauthn_credentials: make user_id nullable so passkey creation
-- doesn't fail when the users table row isn't fetched yet.
ALTER TABLE public.webauthn_credentials
  ALTER COLUMN user_id DROP NOT NULL;

-- Ensure avatar_url column exists on users table (idempotent)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add RLS policy to allow authenticated users to update their own avatar_url
DROP POLICY IF EXISTS "Users can update own avatar" ON public.users;
CREATE POLICY "Users can update own avatar" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);
