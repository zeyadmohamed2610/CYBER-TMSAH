BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('owner', 'doctor', 'student');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE public.session_status AS ENUM ('scheduled', 'active', 'ended', 'cancelled');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE public.attendance_status AS ENUM ('present', 'late', 'absent');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_severity') THEN
    CREATE TYPE public.log_severity AS ENUM ('info', 'warning', 'critical');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email CITEXT NOT NULL UNIQUE,
  full_name TEXT,
  role public.user_role NOT NULL DEFAULT 'student',
  device_fingerprint_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  account_locked_until TIMESTAMPTZ,
  last_failed_login_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users (id),
  updated_by UUID REFERENCES public.users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS device_fingerprint_hash TEXT;

CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.users (id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users (id),
  updated_by UUID REFERENCES public.users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.users (id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  room TEXT,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  geofence_radius_meters INTEGER NOT NULL DEFAULT 120 CHECK (geofence_radius_meters > 0),
  status public.session_status NOT NULL DEFAULT 'scheduled',
  rotating_hash_window_seconds INTEGER NOT NULL DEFAULT 30 CHECK (rotating_hash_window_seconds = 30),
  created_by UUID REFERENCES public.users (id),
  updated_by UUID REFERENCES public.users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sessions_valid_time_range CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  submitted_window BIGINT NOT NULL,
  rotating_hash TEXT NOT NULL,
  request_nonce TEXT NOT NULL UNIQUE,
  ip_address INET,
  device_hash TEXT NOT NULL,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attendance_one_per_student_session UNIQUE (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  severity public.log_severity NOT NULL DEFAULT 'info',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  device_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON public.users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_subjects_set_updated_at ON public.subjects;
CREATE TRIGGER trg_subjects_set_updated_at
BEFORE UPDATE ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_sessions_set_updated_at ON public.sessions;
CREATE TRIGGER trg_sessions_set_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role public.user_role;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;

    SELECT role INTO requester_role
    FROM public.users
    WHERE id = auth.uid();

    IF requester_role IS DISTINCT FROM 'owner' THEN
      RAISE EXCEPTION 'Role changes are restricted to owner-level RPC flows';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_prevent_role_escalation ON public.users;
CREATE TRIGGER trg_users_prevent_role_escalation
BEFORE UPDATE OF role ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.tg_prevent_role_escalation();

CREATE OR REPLACE FUNCTION public.tg_validate_session_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'Session end time must be greater than start time';
  END IF;

  IF NEW.status = 'active' AND NEW.ends_at <= now() THEN
    RAISE EXCEPTION 'Session cannot remain active after end_time';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_enforce_doctor_single_active_session()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  IF NEW.ends_at <= now() THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.doctor_id::text));

  IF EXISTS (
    SELECT 1
    FROM public.sessions existing_session
    WHERE existing_session.doctor_id = NEW.doctor_id
      AND existing_session.status = 'active'
      AND existing_session.ends_at > now()
      AND (NEW.id IS NULL OR existing_session.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Doctor already has an active session that has not ended';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_validate_state ON public.sessions;
CREATE TRIGGER trg_sessions_validate_state
BEFORE INSERT OR UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.tg_validate_session_state();

DROP TRIGGER IF EXISTS trg_sessions_single_active_doctor ON public.sessions;
CREATE TRIGGER trg_sessions_single_active_doctor
BEFORE INSERT OR UPDATE OF doctor_id, status, ends_at ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.tg_enforce_doctor_single_active_session();

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_lock_window ON public.users (account_locked_until);
CREATE INDEX IF NOT EXISTS idx_users_device_fingerprint_hash ON public.users (device_fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_subjects_owner ON public.subjects (owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_doctor_time ON public.sessions (doctor_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_subject_time ON public.sessions (subject_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status_time ON public.sessions (status, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_doctor_active_end ON public.sessions (doctor_id, ends_at DESC)
WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_attendance_student_submitted ON public.attendance (student_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_session_submitted ON public.attendance (session_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_nonce ON public.attendance (request_nonce);
CREATE INDEX IF NOT EXISTS idx_system_logs_action_time ON public.system_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_actor_time ON public.system_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_ip_time ON public.system_logs (ip_address, created_at DESC);

COMMIT;
