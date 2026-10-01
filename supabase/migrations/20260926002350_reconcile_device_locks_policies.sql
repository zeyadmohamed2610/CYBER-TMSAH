-- ==============================================================================
-- Migration: 20260926002350_reconcile_device_locks_policies.sql
-- Description:
--   Forward reconciliation migration to drop legacy untracked policies on
--   public.device_locks. This eliminates the SQLSTATE 42710 naming collision
--   when migration 20260926002400 creates its device_locks policies.
-- ==============================================================================

DROP POLICY IF EXISTS "device_locks_select_policy" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_insert_policy" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_update_policy" ON public.device_locks;
DROP POLICY IF EXISTS "device_locks_delete_policy" ON public.device_locks;
