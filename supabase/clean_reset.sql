-- ================================================
-- 🧹 تنظيف Supabase والبدء من جديد
-- ================================================

-- 1. حذف الجداول إذا موجودة
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.system_logs CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public._server_config CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. حذف الأنواع إذا موجودة
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS log_severity CASCADE;

-- ================================================
-- ✨ إنشاء هيكل قاعدة البيانات الجديد
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create enum types
CREATE TYPE user_role AS ENUM ('owner', 'doctor', 'student');
CREATE TYPE log_severity AS ENUM ('info', 'warning', 'error', 'critical');

-- Users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  student_id TEXT,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  radius DOUBLE PRECISION DEFAULT 100,
  notes TEXT,
  attendance_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by UUID
);

-- Attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
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
  verified BOOLEAN DEFAULT false
);

-- System logs table
CREATE TABLE public.system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  uid UUID,
  email TEXT,
  session_id UUID,
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
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  attempts INT[] DEFAULT '{}',
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_failure TIMESTAMPTZ,
  last_success TIMESTAMPTZ
);

-- Alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  uid UUID,
  ip TEXT,
  details JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server config table
CREATE TABLE public._server_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 🔒 Row Level Security Policies
-- ================================================

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._server_config ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Owners can view all users" ON public.users FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Anyone can insert own user record" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Sessions policies
CREATE POLICY "Doctors can create sessions" ON public.sessions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('doctor', 'owner')));
CREATE POLICY "Doctors can view own sessions" ON public.sessions FOR SELECT USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner') OR (is_active = true AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'student')));
CREATE POLICY "Doctors can update own sessions" ON public.sessions FOR UPDATE USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));
CREATE POLICY "Anyone can delete sessions" ON public.sessions FOR DELETE USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));

-- Attendance policies
CREATE POLICY "Anyone can insert attendance" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view attendance" ON public.attendance FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner', 'doctor')));
CREATE POLICY "Doctors can update attendance" ON public.attendance FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('owner', 'doctor')));

-- System logs policies
CREATE POLICY "Anyone can insert logs" ON public.system_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Owners can view logs" ON public.system_logs FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));

-- Rate limits policies
CREATE POLICY "Anyone can insert rate limits" ON public.rate_limits FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rate limits" ON public.rate_limits FOR UPDATE USING (true);
CREATE POLICY "Anyone can select rate limits" ON public.rate_limits FOR SELECT USING (true);

-- Alerts policies
CREATE POLICY "Anyone can insert alerts" ON public.alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Owners can view alerts" ON public.alerts FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));
CREATE POLICY "Owners can update alerts" ON public.alerts FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));

-- Server config policies
CREATE POLICY "Anyone can read config" ON public._server_config FOR SELECT USING (true);
CREATE POLICY "Owners can update config" ON public._server_config FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));

-- ================================================
-- ⚙️ إعدادات السيرفر
-- ================================================

INSERT INTO public._server_config (key, value) VALUES 
  ('server_secret', 'CyberTMSAH_SecureKey_2024!@#$%^&*'),
  ('attendance_window_minutes', '30'),
  ('max_failed_attempts', '5'),
  ('geo_fence_radius_meters', '100')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ================================================
-- 👤 إنشاء مستخدم Owner تجريبي
-- ================================================

-- ملاحظة: هذا فقط للتوضيح، لا يمكن إنشاء مستخدم هنا مباشرة
-- يجب إنشاء المستخدم من التطبيق أو Supabase Auth أولاً
-- ثم إضافة بياناته هنا

-- بعد إنشاء حساب في التطبيق، شغل هذا الأمر مع استبدال UUID:
-- INSERT INTO public.users (id, email, name, role) 
-- VALUES ('YOUR-USER-UUID-HERE', 'your@email.com', 'Your Name', 'owner');

SELECT '✅ تم تنظيف وإنشاء قاعدة البيانات بنجاح!' as status;
