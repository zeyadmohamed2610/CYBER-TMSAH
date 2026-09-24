-- ===========================================================
-- 20260101000050_gps_and_helpers.sql
-- University Attendance System — GPS function + private helpers
-- (ordered: 2 of 5 — must run BEFORE functions.sql and rls.sql)
--
-- gps_distance_meters and the private RLS-safe helpers are created
-- here, *before* any RPC that calls gps_distance_meters and before
-- any RLS policy that calls the private helpers, so every later
-- migration resolves them at parse time.
-- ===========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- generate_totp — 6-digit TOTP from a secret + time window
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_totp(p_secret TEXT, p_window BIGINT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lpad((
    ('x' || substring(encode(digest(p_secret || p_window::text, 'sha256'), 'hex') from 1 for 8))::bit(32)::bigint % 1000000
  )::text, 6, '0');
$$;

-- ─────────────────────────────────────────────
-- gps_distance_meters — Haversine distance in meters.
-- Returns 0 when either side is NULL (defensive).
-- IMMUTABLE so it is cheap and cacheable.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gps_distance_meters(
  lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  R CONSTANT DOUBLE PRECISION := 6371000;
  dLat DOUBLE PRECISION;
  dLon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN 0;
  END IF;

  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  lat1 := radians(lat1);
  lat2 := radians(lat2);

  a := sin(dLat / 2) * sin(dLat / 2) +
       cos(lat1) * cos(lat2) *
       sin(dLon / 2) * sin(dLon / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));

  RETURN R * c;
END;
$$;

-- ─────────────────────────────────────────────
-- PRIVATE HELPERS (RLS-safe, no recursion)
-- SECURITY DEFINER so they bypass RLS on public.users when
-- invoked from policies / functions. Not directly callable
-- by client roles (revoked in the permissions migration).
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.get_caller_user()
RETURNS public.users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_user_subject_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT subject_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.request_headers()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb;
$$;

CREATE OR REPLACE FUNCTION private.current_request_ip()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_headers   JSONB;
  v_forwarded TEXT;
BEGIN
  v_headers := private.request_headers();
  v_forwarded := COALESCE(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', '');

  IF btrim(v_forwarded) <> '' THEN
    RETURN btrim(split_part(v_forwarded, ',', 1));
  END IF;

  RETURN COALESCE(NULLIF(inet_client_addr()::text, ''), 'unknown');
END;
$$;

CREATE OR REPLACE FUNCTION private.current_request_user_agent()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT NULLIF(btrim(COALESCE(private.request_headers()->>'user-agent', '')), '');
$$;
