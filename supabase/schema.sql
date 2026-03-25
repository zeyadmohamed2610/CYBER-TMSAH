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
-- TABLE: notifications
-- For storing user notifications
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  message    TEXT,
  read        BOOLEAN    NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications (read);

-- ═══════════════════════════════════════════════
-- TABLE: user_settings
-- For storing user preferences
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_settings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  settings   JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings (user_id);
