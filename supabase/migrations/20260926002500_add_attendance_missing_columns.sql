-- ==============================================================================
-- Migration: 20260926002500_add_attendance_missing_columns.sql
-- Description:
--   Pre-flight fix for BUG-01: Attendance Schema Drift.
--   Adds missing columns expected by attendance submission and audit logging:
--     1. device_fingerprint (TEXT, nullable, preserves historical records as NULL)
--     2. metadata (JSONB, NOT NULL DEFAULT '{}'::jsonb)
--
-- Invariants:
--   - Historical rows are preserved with device_fingerprint = NULL (unknown).
--   - Historical rows automatically receive metadata = '{}'::jsonb without table lock/rewrite.
--   - No existing attendance data is rewritten or dropped.
-- ==============================================================================

-- 1. Add device_fingerprint column if not exists
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

-- 2. Add metadata column with default '{}'::jsonb if not exists
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Documentation comments for schema clarity
COMMENT ON COLUMN public.attendance.device_fingerprint IS
  'Client device fingerprint hash recorded at attendance submission. NULL for legacy records predating migration 20260926002500.';

COMMENT ON COLUMN public.attendance.metadata IS
  'Structured audit metadata: ip, gps_verified, user_agent, distance_meters, submitted_at. Empty JSON object for legacy records.';
