-- ===========================================================
-- GPS + Short Code Migration
-- Adds location tracking and short 6-digit session codes
-- ===========================================================

-- Add GPS columns to sessions (doctor location at session creation)
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS radius_meters INTEGER NOT NULL DEFAULT 50;

-- Add a short_code column (6-digit numeric code, easier to type than 64-char hash)
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS short_code TEXT;

-- Index on short_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_sessions_short_code ON public.sessions (short_code);

-- Add student location at time of attendance (anti-cheat audit trail)
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS student_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS student_longitude DOUBLE PRECISION;

-- Create a GPS distance calculation function (Haversine formula)
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
