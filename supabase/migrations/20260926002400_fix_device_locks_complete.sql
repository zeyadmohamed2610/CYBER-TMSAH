-- ==============================================================================
-- Migration: 20260926002400_fix_device_locks_complete.sql
-- Description:
--   Comprehensive fix for device_locks:
--   1. GRANT SELECT, INSERT, UPDATE, DELETE to authenticated & service_role
--   2. RLS policies covering SELECT, INSERT, UPDATE for student's own record
--   3. RPC function public.lock_student_device (SECURITY DEFINER)
-- ==============================================================================

-- 1. Ensure table permissions (Crucial: UPDATE was previously missing, causing 403 on upsert)
GRANT ALL ON public.device_locks TO authenticated;
GRANT ALL ON public.device_locks TO service_role;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "device_locks_insert_consolidated" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_select_consolidated" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_update_consolidated" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_delete_consolidated" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_admin_consolidated"  ON public.device_locks;
DROP POLICY IF EXISTS "owner_all_device_locks"           ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_student_own_insert"  ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_student_own_select"  ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_student_own_update"  ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_admin_update"        ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_admin_delete"        ON public.device_locks;

-- 3. Create fresh, unambiguous policies
-- SELECT: Student can read their own lock, Admin can read all
CREATE POLICY "device_locks_select_policy" ON public.device_locks
  FOR SELECT TO authenticated
  USING (
    student_auth_id = auth.uid()
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- INSERT: Student can lock their own device, Admin can insert
CREATE POLICY "device_locks_insert_policy" ON public.device_locks
  FOR INSERT TO authenticated
  WITH CHECK (
    student_auth_id = auth.uid()
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- UPDATE: Student can update their own lock, Admin can update
CREATE POLICY "device_locks_update_policy" ON public.device_locks
  FOR UPDATE TO authenticated
  USING (
    student_auth_id = auth.uid()
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  )
  WITH CHECK (
    student_auth_id = auth.uid()
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

-- DELETE: Admin only (for resetting locks)
CREATE POLICY "device_locks_delete_policy" ON public.device_locks
  FOR DELETE TO authenticated
  USING ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'));

-- 4. RPC Function for bulletproof device locking (bypasses RLS edge-cases)
CREATE OR REPLACE FUNCTION public.lock_student_device(
  p_fingerprint TEXT,
  p_label TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT device_fingerprint INTO v_existing
  FROM public.device_locks
  WHERE student_auth_id = v_uid;

  IF v_existing IS NOT NULL THEN
    IF v_existing = p_fingerprint THEN
      RETURN jsonb_build_object('success', true, 'message', 'Device already locked');
    ELSE
      RAISE EXCEPTION 'الحساب مقترن بالفعل بجهاز آخر. يرجى مراجعة إدارة الكلية.';
    END IF;
  END IF;

  INSERT INTO public.device_locks (student_auth_id, device_fingerprint, device_label, locked_at)
  VALUES (v_uid, p_fingerprint, COALESCE(p_label, 'جهاز معتمد'), now())
  ON CONFLICT (student_auth_id) 
  DO UPDATE SET 
    device_fingerprint = EXCLUDED.device_fingerprint,
    device_label = EXCLUDED.device_label,
    locked_at = now()
  WHERE public.device_locks.device_fingerprint = p_fingerprint;

  -- Sync with student_devices if table exists
  BEGIN
    INSERT INTO public.student_devices (student_id, device_fingerprint, bound_at, last_seen_at)
    VALUES (v_uid, p_fingerprint, now(), now())
    ON CONFLICT (device_fingerprint) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if student_devices table schema differs
    NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lock_student_device(TEXT, TEXT) TO authenticated;
