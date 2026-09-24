-- ===========================================================
-- 20260101000000_initial_schema.sql
-- University Attendance System — base schema (ordered: 1 of 5)
--
-- This migration defines every table and column the application,
-- the RPC functions, the RLS policies and the grants rely on.
-- GPS columns and the JSONB metadata column are created here so
-- that later function migrations which reference them are
-- guaranteed to resolve.
-- ===========================================================

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
-- 'ta' is defined up-front so no non-transactional
-- ALTER TYPE ADD VALUE is required later.
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('owner', 'doctor', 'student', 'ta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- TABLE: subjects
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subjects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  doctor_name TEXT        NOT NULL DEFAULT 'غير محدد',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subjects_name ON public.subjects (name);

-- ─────────────────────────────────────────────
-- TABLE: users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     UUID             NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT             NOT NULL,
  role        public.user_role NOT NULL,
  subject_id  UUID             REFERENCES public.subjects(id) ON DELETE SET NULL,
  national_id TEXT,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),

  CONSTRAINT chk_subject_per_role CHECK (
    (role = 'owner'    AND subject_id IS NULL)      OR
    (role = 'doctor'   AND subject_id IS NOT NULL)  OR
    (role = 'student'  AND subject_id IS NULL)      OR
    (role = 'ta'       AND subject_id IS NOT NULL)
  ),
  CONSTRAINT chk_national_id_format CHECK (
    national_id IS NULL OR national_id ~ '^\d{14}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_users_auth_id    ON public.users (auth_id);
CREATE INDEX IF NOT EXISTS idx_users_subject_id ON public.users (subject_id);
CREATE INDEX IF NOT EXISTS idx_users_role       ON public.users (role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_national_id_unique
  ON public.users (national_id)
  WHERE national_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- TABLE: lectures
-- Defined before sessions.lecture_id FK, so the reference resolves.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lectures (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   UUID        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL DEFAULT 'Lecture',
  lecture_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_by   UUID        REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_lectures_subject_date_title UNIQUE (subject_id, lecture_date, title)
);

CREATE INDEX IF NOT EXISTS idx_lectures_subject_date ON public.lectures (subject_id, lecture_date DESC);

-- ─────────────────────────────────────────────
-- TABLE: sessions
-- Includes GPS columns + short_code + section up-front so
-- functions defined in a later migration resolve them.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    UUID        NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  rotating_hash TEXT        NOT NULL UNIQUE,
  short_code    TEXT,
  section       TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  radius_meters INTEGER     NOT NULL DEFAULT 50,
  lecture_id    UUID        REFERENCES public.lectures(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_subject_id ON public.sessions (subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at  ON public.sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_lecture     ON public.sessions (lecture_id);
CREATE INDEX IF NOT EXISTS idx_sessions_short_code  ON public.sessions (short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_section      ON public.sessions (section) WHERE section IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_subject_expires ON public.sessions (subject_id, expires_at);

-- ─────────────────────────────────────────────
-- TABLE: course_materials
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_materials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  icon                TEXT NOT NULL DEFAULT '📚',
  instructor          TEXT NOT NULL,
  second_instructor   TEXT,
  teaching_assistants TEXT[] DEFAULT '{}',
  articles            JSONB DEFAULT '[]',
  sections_content    JSONB DEFAULT '[]',
  pdf_url             TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_materials_slug ON public.course_materials (slug);
CREATE INDEX IF NOT EXISTS idx_course_materials_sort  ON public.course_materials (sort_order);

-- ─────────────────────────────────────────────
-- TABLE: attendance
-- GPS columns + ip_address + section for anti-cheat / audit.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id        UUID        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_latitude  DOUBLE PRECISION,
  student_longitude DOUBLE PRECISION,
  ip_address        TEXT,
  section           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_attendance_student_session UNIQUE (student_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session_id  ON public.attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id  ON public.attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_session ON public.attendance (student_id, session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_created_at_desc ON public.attendance (created_at DESC);

-- ─────────────────────────────────────────────
-- TABLE: system_logs
-- Structured JSONB metadata column so audit writes carry
-- structured context in addition to the human-readable action.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  action     TEXT        NOT NULL,
  metadata   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_actor_id    ON public.system_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at  ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_actor_action ON public.system_logs (actor_id, action);
CREATE INDEX IF NOT EXISTS idx_system_logs_date_range ON public.system_logs (created_at DESC, action);

-- ─────────────────────────────────────────────
-- TABLE: student_devices (1:1 device binding per student)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_devices (
  student_id          UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  device_fingerprint  TEXT NOT NULL,
  ip_address          TEXT,
  bound_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_devices_fingerprint_unique
  ON public.student_devices (device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_student_devices_last_seen
  ON public.student_devices (last_seen_at DESC);

-- ─────────────────────────────────────────────
-- TABLE: login_sessions (login audit trail)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.login_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_sessions_user_created
  ON public.login_sessions (user_id, created_at DESC);

-- ─────────────────────────────────────────────
-- TABLE: device_locks (student self-service device lock)
-- Written directly by the frontend via REST under RLS policies.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.device_locks (
  student_auth_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_label TEXT,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_locks_student ON public.device_locks (student_auth_id);
