-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create enum types (use IF NOT EXISTS to avoid errors on re-run)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('owner', 'doctor', 'student');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_severity') THEN
    CREATE TYPE log_severity AS ENUM ('info', 'warning', 'error', 'critical');
  END IF;
END $$;

-- Users table (synced with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'student',
  student_id TEXT,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(email),
  CONSTRAINT valid_student_id CHECK (student_id IS NULL OR length(student_id) <= 50)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL DEFAULT 50,
  notes TEXT,
  attendance_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by UUID REFERENCES public.users(id),
  
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_radius CHECK (radius > 0 AND radius <= 1000),
  CONSTRAINT valid_coordinates CHECK (
    location_lat >= -90 AND location_lat <= 90 AND
    location_lng >= -180 AND location_lng <= 180
  )
);

-- Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  distance_from_center DOUBLE PRECISION NOT NULL,
  ip_address TEXT,
  device_hash TEXT NOT NULL,
  user_agent TEXT,
  verified BOOLEAN DEFAULT true,
  
  UNIQUE(session_id, user_id),
  CONSTRAINT valid_attendance_coords CHECK (
    location_lat >= -90 AND location_lat <= 90 AND
    location_lng >= -180 AND location_lng <= 180
  )
);

-- System logs table
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  uid UUID,
  email TEXT,
  session_id UUID REFERENCES public.sessions(id),
  ip TEXT,
  user_agent TEXT,
  device_hash TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  severity log_severity DEFAULT 'info',
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  attempts BIGINT[] DEFAULT '{}',
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_failure TIMESTAMPTZ,
  last_success TIMESTAMPTZ,
  
  UNIQUE(identifier, action)
);

-- Alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  uid UUID,
  ip TEXT,
  details JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server secrets table (for rotating hash secret)
-- Only accessible by service role
CREATE TABLE IF NOT EXISTS public._server_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Insert default server secret (CHANGE IN PRODUCTION!)
INSERT INTO public._server_config (key, value) 
VALUES ('server_secret', 'CHANGE-THIS-SECRET-IN-PRODUCTION-MIN-32-CHARS')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON public.sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON public.sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON public.sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_subject_id ON public.sessions(subject_id);

CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON public.attendance(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_device_hash ON public.attendance(device_hash);

CREATE INDEX IF NOT EXISTS idx_system_logs_type ON public.system_logs(type);
CREATE INDEX IF NOT EXISTS idx_system_logs_uid ON public.system_logs(uid);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_session_id ON public.system_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.rate_limits(identifier);

CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON public.alerts(resolved);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._server_config ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Owners can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow anyone to insert their own profile when creating account
CREATE POLICY "Anyone can insert own user record"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Sessions policies
CREATE POLICY "Doctors can create sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('doctor', 'owner')
    )
  );

CREATE POLICY "Doctors can view own sessions"
  ON public.sessions FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner') OR
    (is_active = true AND EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'student'
    ))
  );

CREATE POLICY "Doctors can update own sessions"
  ON public.sessions FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Doctors can delete own sessions"
  ON public.sessions FOR DELETE
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner')
  );

-- Attendance policies - NO direct writes from client!
CREATE POLICY "Students can view own attendance"
  ON public.attendance FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Doctors can view attendance for own sessions"
  ON public.attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE id = session_id AND created_by = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner')
  );

-- No INSERT, UPDATE, DELETE policies for attendance - handled by Edge Functions

-- System logs policies
CREATE POLICY "Only owners can view logs"
  ON public.system_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner')
  );

-- No INSERT policy for client - handled by triggers/Edge Functions

-- Alerts policies
CREATE POLICY "Only owners can view alerts"
  ON public.alerts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner')
  );

-- Rate limits - no client access
-- Alerts - handled by Edge Functions

-- Block all access to server config from client
CREATE POLICY "No client access to server config"
  ON public._server_config FOR ALL
  USING (false);

-- Allow users to insert themselves when they sign up (instead of trigger)
CREATE POLICY "Users can insert on signup via auth"
  ON public.users FOR INSERT
  WITH CHECK (
    auth.uid() = id OR 
    (auth.uid() IS NULL AND current_setting('request.jwt.claim.role', true) = 'authenticated')
  );

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS on_users_updated ON public.users;
CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Haversine distance function (in meters)
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  earth_radius CONSTANT DOUBLE PRECISION := 6371000;
  dlat DOUBLE PRECISION;
  dlng DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlng/2) * sin(dlng/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate rotating hash function
CREATE OR REPLACE FUNCTION public.generate_rotating_hash(
  p_session_id UUID
)
RETURNS TABLE(hash TEXT, expires_at BIGINT, window_start BIGINT) AS $$
DECLARE
  v_secret TEXT;
  v_window_start BIGINT;
  v_expires_at BIGINT;
  v_hash TEXT;
  v_numeric_hash BIGINT;
  v_char CHAR(1);
  v_value INTEGER;
BEGIN
  -- Get server secret (only service role can access this)
  SELECT value INTO v_secret FROM public._server_config WHERE key = 'server_secret';
  
  -- Calculate time window (30 second intervals)
  v_window_start := floor(extract(epoch from now()) / 30) * 30;
  v_expires_at := v_window_start + 30;
  
  -- Generate HMAC-SHA256 hash
  v_hash := encode(
    hmac(
      p_session_id::text || ':' || v_window_start::text,
      v_secret,
      'sha256'
    ),
    'hex'
  );
  
  -- Convert to numeric PIN (6 digits)
  v_numeric_hash := 0;
  FOR i IN 1..length(v_hash) LOOP
    v_char := substring(v_hash from i for 1);
    v_value := ascii(v_char) - 
      CASE WHEN v_char BETWEEN '0' AND '9' THEN 48
           WHEN v_char BETWEEN 'a' AND 'f' THEN 87
           ELSE 0 END;
    v_numeric_hash := (v_numeric_hash + v_value) % 1000000;
  END LOOP;
  
  -- Format as 6-digit PIN
  v_hash := lpad(v_numeric_hash::text, 6, '0');
  
  RETURN QUERY SELECT v_hash, v_expires_at, v_window_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate attendance function
CREATE OR REPLACE FUNCTION public.validate_attendance(
  p_session_id UUID,
  p_rotating_hash TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_device_fingerprint TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT, attendance_id UUID) AS $$
DECLARE
  v_session RECORD;
  v_distance DOUBLE PRECISION;
  v_hash_result RECORD;
  v_valid_hash BOOLEAN := false;
  v_user RECORD;
  v_existing_count INTEGER;
  v_current_window BIGINT;
BEGIN
  -- Get current user
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'User not found'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Check if user is a student
  IF v_user.role != 'student' THEN
    RETURN QUERY SELECT false, 'Only students can mark attendance'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Get session
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Session not found'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Check session is active
  IF NOT v_session.is_active THEN
    RETURN QUERY SELECT false, 'Session is not active'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Check time window
  IF now() < v_session.start_time - interval '5 minutes' THEN
    RETURN QUERY SELECT false, 'Session has not started yet'::text, NULL::uuid;
    RETURN;
  END IF;
  
  IF now() > v_session.end_time THEN
    RETURN QUERY SELECT false, 'Session has ended'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Validate rotating hash (check current and previous window)
  v_current_window := floor(extract(epoch from now()) / 30) * 30;
  
  FOR i IN 0..1 LOOP
    SELECT * INTO v_hash_result 
    FROM public.generate_rotating_hash_with_window(p_session_id, v_current_window - (i * 30));
    
    IF v_hash_result.hash = p_rotating_hash THEN
      v_valid_hash := true;
      EXIT;
    END IF;
  END LOOP;
  
  IF NOT v_valid_hash THEN
    -- Log suspicious activity
    INSERT INTO public.system_logs (type, uid, session_id, ip, severity, details)
    VALUES ('attendance_failed', auth.uid(), p_session_id, p_ip_address, 'warning', 
            jsonb_build_object('reason', 'invalid_hash', 'hash', p_rotating_hash));
    
    RETURN QUERY SELECT false, 'Invalid or expired code'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Check geofence
  v_distance := public.haversine_distance(
    v_session.location_lat, v_session.location_lng,
    p_latitude, p_longitude
  );
  
  IF v_distance > v_session.radius THEN
    INSERT INTO public.system_logs (type, uid, session_id, ip, severity, details)
    VALUES ('attendance_failed', auth.uid(), p_session_id, p_ip_address, 'warning',
            jsonb_build_object('reason', 'outside_geofence', 'distance', v_distance));
    
    RETURN QUERY SELECT false, 
      format('You are %s meters outside the attendance area', floor(v_distance - v_session.radius))::text, 
      NULL::uuid;
    RETURN;
  END IF;
  
  -- Check for duplicate attendance
  SELECT COUNT(*) INTO v_existing_count
  FROM public.attendance
  WHERE session_id = p_session_id AND user_id = auth.uid();
  
  IF v_existing_count > 0 THEN
    RETURN QUERY SELECT false, 'You have already marked attendance for this session'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Check device reuse (suspicious if same device used by multiple users recently)
  SELECT COUNT(DISTINCT user_id) INTO v_existing_count
  FROM public.attendance
  WHERE device_hash = public.encode(encode(digest(p_device_fingerprint, 'sha256'), 'hex'), 'hex')::text
    AND timestamp > now() - interval '5 minutes'
    AND user_id != auth.uid();
  
  IF v_existing_count >= 2 THEN
    INSERT INTO public.system_logs (type, uid, session_id, ip, severity, details)
    VALUES ('suspicious_activity', auth.uid(), p_session_id, p_ip_address, 'critical',
            jsonb_build_object('reason', 'device_reuse', 'device_hash', p_device_fingerprint));
    
    RETURN QUERY SELECT false, 'This device has been used by multiple students recently'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Insert attendance record
  INSERT INTO public.attendance (
    session_id, user_id, student_id, name, email,
    location_lat, location_lng, distance_from_center,
    ip_address, device_hash, user_agent, verified
  ) VALUES (
    p_session_id, auth.uid(), v_user.student_id, v_user.name, v_user.email,
    p_latitude, p_longitude, v_distance,
    p_ip_address, encode(digest(p_device_fingerprint, 'sha256'), 'hex'),
    p_user_agent, true
  ) RETURNING id INTO attendance_id;
  
  -- Update session attendance count
  UPDATE public.sessions 
  SET attendance_count = attendance_count + 1
  WHERE id = p_session_id;
  
  -- Log success
  INSERT INTO public.system_logs (type, uid, session_id, ip, severity)
  VALUES ('attendance_marked', auth.uid(), p_session_id, p_ip_address, 'info');
  
  RETURN QUERY SELECT true, 'Attendance marked successfully'::text, attendance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function for hash with specific window
CREATE OR REPLACE FUNCTION public.generate_rotating_hash_with_window(
  p_session_id UUID,
  p_window_start BIGINT
)
RETURNS TABLE(hash TEXT, expires_at BIGINT, window_start BIGINT) AS $$
DECLARE
  v_secret TEXT;
  v_hash TEXT;
  v_numeric_hash BIGINT;
  v_char CHAR(1);
  v_value INTEGER;
BEGIN
  SELECT value INTO v_secret FROM public._server_config WHERE key = 'server_secret';
  
  v_hash := encode(
    hmac(
      p_session_id::text || ':' || p_window_start::text,
      v_secret,
      'sha256'
    ),
    'hex'
  );
  
  v_numeric_hash := 0;
  FOR i IN 1..length(v_hash) LOOP
    v_char := substring(v_hash from i for 1);
    v_value := ascii(v_char) - 
      CASE WHEN v_char BETWEEN '0' AND '9' THEN 48
           WHEN v_char BETWEEN 'a' AND 'f' THEN 87
           ELSE 0 END;
    v_numeric_hash := (v_numeric_hash + v_value) % 1000000;
  END LOOP;
  
  v_hash := lpad(v_numeric_hash::text, 6, '0');
  
  RETURN QUERY SELECT v_hash, p_window_start + 30, p_window_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
