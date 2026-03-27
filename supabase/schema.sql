-- ===========================================================
-- schema.sql
-- University Attendance System
-- Run order: 1 of 4
-- ===========================================================

-- ─────────────────────────────────────────────
-- PERFORMANCE: Additional indices for better query performance
-- These are safe to add - they don't affect existing functionality
-- ─────────────────────────────────────────────

-- Composite index for sessions: subject + expiry (common query pattern)
CREATE INDEX IF NOT EXISTS idx_sessions_subject_expires 
  ON public.sessions (subject_id, expires_at);

-- Index on attendance created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_attendance_created_at_desc 
  ON public.attendance (created_at DESC);

-- Composite index for attendance: student + session (faster lookups)
CREATE INDEX IF NOT EXISTS idx_attendance_student_session 
  ON public.attendance (student_id, session_id);

-- Index for system_logs filtering by date range
CREATE INDEX IF NOT EXISTS idx_system_logs_date_range 
  ON public.system_logs (created_at DESC, action);

-- ─────────────────────────────────────────────
-- PRIVATE SCHEMA
-- Created here (first file) and immediately locked down.
-- ─────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('owner', 'doctor', 'student');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- TABLE: subjects
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subjects (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- TABLE: users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id         UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id    UUID             NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT             NOT NULL,
  role       public.user_role NOT NULL,
  subject_id UUID             REFERENCES public.subjects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ      NOT NULL DEFAULT now(),

  CONSTRAINT chk_subject_per_role CHECK (
    (role = 'owner'              AND subject_id IS NULL) OR
    (role = 'doctor'            AND subject_id IS NOT NULL) OR
    (role = 'student'           AND subject_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_users_auth_id    ON public.users (auth_id);
CREATE INDEX IF NOT EXISTS idx_users_subject_id ON public.users (subject_id);
CREATE INDEX IF NOT EXISTS idx_users_role       ON public.users (role);

-- ─────────────────────────────────────────────
-- TABLE: sessions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    UUID        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  rotating_hash TEXT        NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_subject_id ON public.sessions (subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions (expires_at);

-- ─────────────────────────────────────────────
-- TABLE: attendance
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_attendance_student_session UNIQUE (student_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON public.attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance (student_id);

-- ─────────────────────────────────────────────
-- TABLE: system_logs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  action     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_actor_id   ON public.system_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.system_logs (created_at DESC);

-- ═══════════════════════════════════════════════
-- ═══════════════════════════════════════════════
-- ═══════════════════════════════════════════════
-- ═══════════════════════════════════════════════
-- ===========================================================
-- Attendance system reconciliation
-- These ALTER/CREATE statements keep the schema aligned with the
-- frontend code and are safe to rerun on an existing project.
-- ===========================================================

-- subjects.doctor_name is used throughout the attendance dashboards
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS doctor_name TEXT;

UPDATE public.subjects
SET doctor_name = COALESCE(NULLIF(trim(doctor_name), ''), 'غير محدد')
WHERE doctor_name IS NULL OR trim(doctor_name) = '';

ALTER TABLE public.subjects
  ALTER COLUMN doctor_name SET DEFAULT 'غير محدد';

ALTER TABLE public.subjects
  ALTER COLUMN doctor_name SET NOT NULL;

-- users.national_id is required for student login and device management
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS national_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_national_id_unique
  ON public.users (national_id)
  WHERE national_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_national_id_format'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT chk_national_id_format
      CHECK (national_id IS NULL OR national_id ~ '^\d{14}$');
  END IF;
END $$;

-- Device binding table: one active device per student
CREATE TABLE IF NOT EXISTS public.student_devices (
  student_id          UUID        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  device_fingerprint  TEXT        NOT NULL,
  ip_address          TEXT,
  bound_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_devices_fingerprint_unique
  ON public.student_devices (device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_student_devices_last_seen
  ON public.student_devices (last_seen_at DESC);

-- Login history used by owner/doctor dashboards
CREATE TABLE IF NOT EXISTS public.login_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_sessions_user_created
  ON public.login_sessions (user_id, created_at DESC);
