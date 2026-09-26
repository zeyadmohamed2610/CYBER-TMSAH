-- Migration: 20260926000300_password_reset_requests.sql
-- Description: Create password_reset_requests table for storing student/user password recovery requests.

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  phone        text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  notes        text,
  created_at   timestamptz DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pw_reset_status ON public.password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_pw_reset_created ON public.password_reset_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pw_reset_email ON public.password_reset_requests(email);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_reset_request" ON public.password_reset_requests;
CREATE POLICY "anon_insert_reset_request"
  ON public.password_reset_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "owner_all_reset_requests" ON public.password_reset_requests;
CREATE POLICY "owner_all_reset_requests"
  ON public.password_reset_requests FOR ALL
  USING (private.current_user_role() = 'owner'::user_role)
  WITH CHECK (private.current_user_role() = 'owner'::user_role);

GRANT INSERT ON public.password_reset_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_requests TO authenticated;
GRANT ALL ON public.password_reset_requests TO service_role;
