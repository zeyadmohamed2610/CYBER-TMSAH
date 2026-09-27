-- ==============================================================================
-- Migration: 20260926002300_fix_device_locks_rls.sql
-- Description:
--   Fix device_locks RLS to allow students to read/insert their own device lock.
--   Previously only owner/coordinator could access device_locks.
-- ==============================================================================

-- Drop old consolidated policies
DROP POLICY IF EXISTS "device_locks_insert_consolidated" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_select_consolidated" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_update_consolidated" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_delete_consolidated" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_admin_consolidated"  ON public.device_locks;

-- Students can insert/select their own device lock; admins can do anything
CREATE POLICY "device_locks_student_own_insert" ON public.device_locks
  FOR INSERT TO authenticated
  WITH CHECK (
    student_auth_id = auth.uid()
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "device_locks_student_own_select" ON public.device_locks
  FOR SELECT TO authenticated
  USING (
    student_auth_id = auth.uid()
    OR (SELECT private.get_current_user_role()) IN ('owner', 'coordinator')
  );

CREATE POLICY "device_locks_admin_update" ON public.device_locks
  FOR UPDATE TO authenticated
  USING  ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  WITH CHECK ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'));

CREATE POLICY "device_locks_admin_delete" ON public.device_locks
  FOR DELETE TO authenticated
  USING ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'));
