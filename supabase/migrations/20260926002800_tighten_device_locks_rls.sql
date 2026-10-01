-- ==============================================================================
-- Migration: 20260926002800_tighten_device_locks_rls.sql
-- Description:
--   Tighten device_locks RLS policies per FINAL_REMEDIATION_REVIEW.md:
--   - Restricts UPDATE on public.device_locks strictly to 'owner' and 'coordinator'.
--   - Students must NOT be permitted to directly update their bound device fingerprint.
--   - Device resets can only be performed by administrators.
-- ==============================================================================

-- Drop the overly broad UPDATE policy created in 002400
DROP POLICY IF EXISTS "device_locks_update_policy" ON public.device_locks;

-- Recreate strict admin-only UPDATE policy
CREATE POLICY "device_locks_update_policy" ON public.device_locks
  FOR UPDATE TO authenticated
  USING  ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'))
  WITH CHECK ((SELECT private.get_current_user_role()) IN ('owner', 'coordinator'));
