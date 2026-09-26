CREATE TABLE IF NOT EXISTS public.audit_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action            text NOT NULL,
  identifier        text,
  role              text,
  user_agent        text,
  screen_resolution text,
  metadata          jsonb DEFAULT '{}',
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.audit_logs TO postgres, service_role;
GRANT INSERT ON TABLE public.audit_logs TO anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- Secure RPC function for checking username uniqueness (without exposing users table to anon)
CREATE OR REPLACE FUNCTION public.check_username_exists(p_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_username IS NULL OR trim(p_username) = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE lower(username) = lower(trim(p_username))
    UNION
    SELECT 1 FROM public.join_requests WHERE lower(username) = lower(trim(p_username)) AND status = 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_username_exists(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_username_exists(text) TO anon, authenticated;

-- Secure RPC function for checking email uniqueness
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email))
    UNION
    SELECT 1 FROM public.join_requests WHERE lower(email) = lower(trim(p_email)) AND status = 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_email_exists(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon, authenticated;
