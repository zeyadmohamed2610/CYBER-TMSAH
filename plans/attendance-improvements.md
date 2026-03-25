# تقرير تحسينات نظام الحضور والغياب - CYBER TMSAH

## ملخص الوضع الحالي

### ✅ ما يعمل جيداً:
- نظام JWT و RLS آمن
- نظام Rotating Hash للPresence (2 دقيقة)
- تقسيم الأدوار (Owner/Doctor/Student)
- Database Indices مضافة
- Rate Limiting للـ Edge Functions
- Forms محسنة مع Validation

---

## 🔴 تحسينات مطلوبة - Backend/Database

### 1. إضافة Functions جديدة للـ PostgreSQL

```sql
-- تابع لتحديث مدة الجلسة (تعديل expiration)
CREATE OR REPLACE FUNCTION public.extend_session(
  p_session_id UUID,
  p_minutes INTEGER
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller public.users;
  v_session public.sessions;
BEGIN
  v_caller := private.get_caller_user();
  IF v_caller IS NULL OR v_caller.role NOT IN ('owner', 'doctor') THEN
    RAISE EXCEPTION 'permission_denied: only owners/doctors may extend sessions';
  END IF;
  
  UPDATE public.sessions 
  SET expires_at = expires_at + (p_minutes || ' minutes')::interval
  WHERE id = p_session_id
  RETURNING * INTO v_session;
  
  RETURN v_session;
END;
$$;

-- تابع لحساب attendance rate للطالب في مادة معينة
CREATE OR REPLACE FUNCTION public.get_student_attendance_rate(
  p_student_id UUID,
  p_subject_id UUID
)
RETURNS TABLE(
  total_sessions INTEGER,
  attended_sessions INTEGER,
  rate DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH sessions_count AS (
    SELECT COUNT(*)::INTEGER as total
    FROM public.sessions
    WHERE subject_id = p_subject_id
  ),
  attendance_count AS (
    SELECT COUNT(*)::INTEGER as attended
    FROM public.attendance a
    JOIN public.sessions s ON a.session_id = s.id
    WHERE a.student_id = p_student_id AND s.subject_id = p_subject_id
  )
  SELECT 
    COALESCE(s.total, 0),
    COALESCE(a.attended, 0),
    CASE 
      WHEN s.total > 0 THEN (a.attended::DECIMAL / s.total * 100)
      ELSE 0
    END
  FROM sessions_count s, attendance_count a;
END;
$$;
```

### 2. إضافة pg_cron للـ Scheduled Jobs

```sql
-- تفعيل pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- جدولة تنظيف الجلسات المنتهية كل 15 دقيقة
SELECT cron.schedule(
  'cleanup-sessions',
  '*/15 * * * *',
  'SELECT public.cleanup_expired_sessions()'
);

-- جدولة إنشاء تقرير يومي
SELECT cron.schedule(
  'daily-attendance-report',
  '0 0 * * *', -- كل يوم midnight
  'SELECT public.generate_daily_report()'
);
```

### 3. تحسين RLS Policies

```sql
-- إضافة Policy للـ doctor يعرض طلاب مادته فقط
CREATE POLICY "doctors_see_their_students"
ON public.users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users teachers
    WHERE teachers.id = auth.uid()
    AND teachers.role = 'doctor'
    AND teachers.subject_id = public.users.subject_id
  )
);
```

---

## 🟡 تحسينات مطلوبة - نظام الحضور

### 4. إضافة نظامpresence الـ (بديل للـ QR)

```typescript
// إضافة نوع حضور جديد في enum
export type AttendanceMethod = 'qr' | 'location' | 'manual';

// تحديث جدول attendance
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS method attendance_method DEFAULT 'qr',
ADD COLUMN IF NOT EXISTS location_data JSONB,
ADD COLUMN IF NOT EXISTS ip_address INET;
```

### 5. إضافة نظام التنبيهات

```typescript
// Frontend - خدمة التنبيهات
interface Notification {
  id: string;
  user_id: string;
  type: 'session_starting' | 'attendance_low' | 'session_ended';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

// إضافة جدول للـ notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 6. إضافة نظام التقارير

```typescript
// أنواع التقارير
interface ReportConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  format: 'pdf' | 'excel' | 'csv';
  includeCharts: boolean;
  dateFrom?: string;
  dateTo?: string;
  subjectId?: string;
}

// إضافة جدول للتقارير المحفوظة
CREATE TABLE IF NOT EXISTS public.saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🟢 تحسينات مطلوبة - Frontend

### 7. إضافة Dashboard للطالب

```typescript
// ميزاتDashboard الطالب
interface StudentDashboardFeatures {
  // الحضور في كل المواد
  overallAttendance: number;
  
  // الحضور لكل مادة
  subjectAttendance: Record<string, number>;
  
  // الجلسات القادمة
  upcomingSessions: SessionSummary[];
  
  // الإشعارات
  notifications: Notification[];
  
  // سجل الحضور
  attendanceHistory: AttendanceRecord[];
}
```

### 8. إضافة نظام المراسلة

```typescript
// إضافة نظام رسائل بين الأدوار
interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  subject: string;
  body: string;
  read: boolean;
  created_at: string;
}

// جدول الرسائل
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 9. إضافة إعدادات لكل role

```typescript
// إعدادات المستخدم
interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    sessionReminders: boolean;
  };
  display: {
    language: 'ar' | 'en';
    theme: 'light' | 'dark';
  };
  privacy: {
    showInAttendanceList: boolean;
  };
}

// جدول الإعدادات
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 📊 تحسينات التحليل والتقارير

### 10. إضافة Analytics متقدم

```typescript
// تحليلات كل مادة
interface SubjectAnalytics {
  subjectId: string;
  totalStudents: number;
  averageAttendance: number;
  peakAttendanceHour: number;
  mostAbsentStudents: string[];
  attendanceTrend: TrendPoint[];
}

// مقارنة بين المواد
interface ComparativeAnalytics {
  bestPerformingSubject: string;
  worstPerformingSubject: string;
  averageAttendanceRate: number;
  comparisonByMonth: Record<string, number>;
}
```

---

## 🔒 تحسينات الأمان

### 11. إضافة Two-Factor Authentication

```sql
-- إضافة column للـ 2FA
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
```

### 12. إضافة Session Management

```sql
-- جدول الـ sessions النشطة
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  device_info JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- تابع لإنهاء جميع جلسات المستخدم
CREATE OR REPLACE FUNCTION public.revoke_all_user_sessions(
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.active_sessions WHERE user_id = p_user_id;
END;
$$;
```

---

## 📋 خطة التنفيذ المقترحة

| الأولوية | التحسين | الجهد | التأثير |
|---------|---------|-------|--------|
| عالية | إضافة pg_cron + Scheduled Jobs | متوسط | عالي |
| عالية | نظام التنبيهات | كبير | عالي |
| متوسطة | إعدادات المستخدم | صغير | متوسط |
| متوسطة | تقارير محسنة | كبير | عالي |
| منخفضة | نظام المراسلة | كبير | منخفض |
| منخفضة | 2FA | متوسط | عالي |

---

## 💡 توصيات فورية

1. **تفعيل pg_cron** - للتنظيف التلقائي والتقارير اليومية
2. **إضافة نظام التنبيهات** - wichtig für Lehrer
3. **تحسين Dashboard الطالب** - عرض أفضل للحضور
4. **إضافة Analytics** - تقارير أدق

---

*تم إنشاء هذا التقرير بناءً على تحليل شامل للنظام*
*التاريخ: 2026-03-25*