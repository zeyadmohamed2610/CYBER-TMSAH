-- ==============================================================================
-- Migration: 20260926002000_multi_subject_and_dept_filter.sql
-- Description:
--   1. Add department column to subjects table (for filtering in UI)
--   2. Create user_subjects junction table for multi-subject assignment
--   3. Migrate existing subject_id data to the junction table
--   4. Add RPC: assign_user_subjects(p_user_id, p_subject_ids[]) for atomic multi-assign
--   5. Add RPC: get_user_subjects(p_user_id) to fetch assigned subjects
-- ==============================================================================

-- ── 1. Add department column to subjects (if not already present) ──────────────
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS department TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_department ON public.subjects (department);

-- ── 2. Create user_subjects junction table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_subjects (
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subjects_user_id    ON public.user_subjects (user_id);
CREATE INDEX IF NOT EXISTS idx_user_subjects_subject_id ON public.user_subjects (subject_id);

-- ── 3. Migrate existing single subject_id to junction table ───────────────────
-- Copy existing doctor/ta subject assignments into the new table
INSERT INTO public.user_subjects (user_id, subject_id)
SELECT id, subject_id
FROM public.users
WHERE role IN ('doctor', 'ta')
  AND subject_id IS NOT NULL
ON CONFLICT (user_id, subject_id) DO NOTHING;

-- ── 4. RLS Policies for user_subjects ─────────────────────────────────────────
ALTER TABLE public.user_subjects ENABLE ROW LEVEL SECURITY;

-- Owners and coordinators can see all user_subjects
CREATE POLICY "owner_coordinator_see_user_subjects" ON public.user_subjects
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'coordinator')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('owner', 'coordinator')
  );

-- Users can see their own subjects
CREATE POLICY "user_see_own_subjects" ON public.user_subjects
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- ── 5. RPC: assign_user_subjects ─────────────────────────────────────────────
-- Atomically replaces all subjects for a doctor/TA
-- Only owner or coordinator can call this
CREATE OR REPLACE FUNCTION public.assign_user_subjects(
  p_user_id    UUID,
  p_subject_ids UUID[]
)
RETURNS SETOF public.user_subjects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
  v_target      public.users;
  v_sid         UUID;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'permission_denied: only owners or coordinators may assign subjects to users';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: user % does not exist', p_user_id;
  END IF;

  IF v_target.role NOT IN ('doctor', 'ta', 'coordinator') THEN
    RAISE EXCEPTION 'validation_error: only doctors, TAs, and coordinators can have subject assignments';
  END IF;

  -- Remove all current assignments for this user
  DELETE FROM public.user_subjects WHERE user_id = p_user_id;

  -- Insert new assignments
  IF p_subject_ids IS NOT NULL THEN
    FOREACH v_sid IN ARRAY p_subject_ids LOOP
      IF v_sid IS NOT NULL THEN
        INSERT INTO public.user_subjects (user_id, subject_id)
        VALUES (p_user_id, v_sid)
        ON CONFLICT (user_id, subject_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Keep users.subject_id in sync with the first assigned subject (backward compat)
  UPDATE public.users
  SET subject_id = (
    SELECT subject_id FROM public.user_subjects
    WHERE user_id = p_user_id
    ORDER BY assigned_at ASC
    LIMIT 1
  )
  WHERE id = p_user_id;

  INSERT INTO public.system_logs (actor_id, action)
  VALUES (v_caller.id,
    format('assign_user_subjects: set %s subjects for user %s', array_length(p_subject_ids, 1), p_user_id));

  RETURN QUERY
    SELECT * FROM public.user_subjects WHERE user_id = p_user_id ORDER BY assigned_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_user_subjects(UUID, UUID[]) TO authenticated;

-- ── 6. RPC: get_user_subjects ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_subjects(
  p_user_id UUID
)
RETURNS TABLE(subject_id UUID, subject_name TEXT, department TEXT, assigned_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_caller      public.users;
  v_caller_role text;
BEGIN
  v_caller := private.get_caller_user();
  v_caller_role := COALESCE(
    v_caller.role::text,
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role'
  );

  -- Anyone authenticated can see their own subjects; owners/coordinators can see all
  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'permission_denied: authentication required';
  END IF;

  IF v_caller_role NOT IN ('owner', 'coordinator') AND v_caller.id <> p_user_id THEN
    RAISE EXCEPTION 'permission_denied: you may only view your own subject assignments';
  END IF;

  RETURN QUERY
    SELECT
      s.id          AS subject_id,
      s.name        AS subject_name,
      s.department  AS department,
      us.assigned_at
    FROM public.user_subjects us
    JOIN public.subjects s ON s.id = us.subject_id
    WHERE us.user_id = p_user_id
    ORDER BY s.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_subjects(UUID) TO authenticated;
