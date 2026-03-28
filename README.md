<div dir="rtl">

<p align="center">
  <img src="public/founder.jpeg" alt="CYBER TMSAH" width="120" height="160" style="border-radius: 16px; border: 3px solid #0d9488;" />
</p>

<h1 align="center">CYBER TMSAH</h1>

<p align="center">
  <strong>Smart University Attendance & Academic Platform</strong>
</p>

<p align="center">
  منصة جامعية متكاملة تجمع بين التنظيم الأكاديمي، المحتوى الدراسي، الحضور الذكي GPS، وإدارة المستخدمين — في تجربة واحدة آمنة واحترافية.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-blue?logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/Vite-8-purple?logo=vite" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase" />
  <img src="https://img.shields.io/badge/Tailwind-3-cyan?logo=tailwindcss" />
</p>

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite 8 |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Backend** | Supabase (PostgreSQL + RLS + Edge Functions) |
| **Auth** | Supabase Auth (email/password) |
| **Database** | PostgreSQL with SECURITY DEFINER RPCs |
| **Real-time** | Supabase Realtime subscriptions |
| **PWA** | Service Worker + offline support |
| **Deployment** | Vercel (frontend) + Supabase Cloud (backend) |

---

## Features

### Attendance System
- **GPS Geofencing**: Student must be within configurable radius (10-500m) of session location
- **6-digit rotating codes**: Session codes refresh every 60 seconds
- **Device binding**: First login locks attendance to that device permanently
- **Anti-cheat**: Cannot check into two sessions simultaneously, device fingerprint verification
- **Haversine formula**: Accurate circular distance calculation on Earth's surface

### Role-Based Dashboards

| Role | Access | Key Features |
|------|--------|-------------|
| **Owner** | Any device | Full system control: users, subjects, schedule, materials, TAs, lectures, devices, logs |
| **Doctor** | Any device | Create lectures, start sessions with GPS, manage attendance, export reports |
| **TA (معيد)** | Any device | Manage sections for assigned subject, same features as doctor |
| **Student** | Mobile only | View active sessions, see live code + QR, submit attendance with GPS |

### Content Management
- **Schedule Editor**: Owner can edit weekly timetable from the dashboard
- **Materials Editor**: Owner can add/edit subjects with articles and sections
- **Lecture Management**: Create lectures → create sessions within lectures → export per-lecture reports
- **TA Management**: Assign TAs to subjects with section numbers

### Security
- **RLS (Row Level Security)**: All 9+ tables protected with role-based policies
- **SECURITY DEFINER RPCs**: All mutations go through server-side functions
- **Rate limiting**: 10 attendance submissions/minute, 20 session creations/minute
- **Input validation**: 14-digit national ID, 8+ char passwords, bounded durations
- **Device fingerprinting**: Canvas + timezone + vendor + platform hash

### Data & Reporting
- **Per-lecture export**: CSV, Excel (HTML), PDF (via html2canvas with Arabic support)
- **Dashboard metrics**: Attendance rate, active sessions, total students
- **System logs**: Full audit trail of all actions
- **90-day log cleanup**: Automatic old data removal

---

## Database Schema

```
users ─────────────────── auth_id, full_name, national_id, role (owner/doctor/student/ta)
subjects ─────────────── name, doctor_name
doctor_subjects ──────── doctor_id, subject_id (many-to-many)
lectures ─────────────── subject_id, title, lecture_date, created_by
sessions ─────────────── subject_id, lecture_id, rotating_hash, short_code, expires_at, GPS, radius
attendance ───────────── student_id, session_id, GPS coordinates, submitted_at
student_devices ──────── student_id, device_fingerprint, ip_address
system_logs ──────────── actor_id, action, created_at
course_schedule ──────── section, day_of_week, time_slot, subject, instructor, room
course_materials ─────── slug, title, icon, instructor, articles (JSONB), sections (JSONB)
```

---

## SQL Functions

| Function | Purpose |
|----------|---------|
| `generate_rotating_hash()` | Create session with GPS + radius + lecture link |
| `submit_attendance()` | Validate code, check GPS, bind device, prevent double-checkin |
| `create_lecture()` | Create lecture for a subject |
| `end_lecture()` | Stop all sessions, delete empty ones |
| `get_lecture_attendees()` | Get full attendance details (name, national ID, IP, time) |
| `get_active_sessions()` | Get all currently active sessions for students |
| `create_subject() / update_subject() / delete_subject()` | Subject CRUD (owner only) |
| `add_schedule_entry() / update_schedule_entry() / delete_schedule_entry()` | Schedule CRUD |
| `add_material() / update_material() / delete_material()` | Materials CRUD |
| `assign_doctor_to_subject() / remove_doctor_from_subject()` | Doctor-subject linking |
| `delete_user_by_id()` | User deletion (owner only) |
| `cleanup_old_logs()` | Remove logs older than 90 days |

---

## ملخص المشروع

**CyberTmsah** منصة جامعية متكاملة تجمع بين:

- **التنظيم الأكاديمي**: جدول دراسي + مواد دراسية + محاضرات
- **الحضور الذكي**: GPS + كود متحرك + ربط جهاز + منع التحايل
- **إدارة المستخدمين**: 4 أدوار (مالك، دكتور، معيد، طالب) مع RLS
- **لوحات تحكم**: كل فئة لها لوحة مخصصة بخصائصها
- **تقارير**: CSV / Excel / PDF مع تصميم موحد CYBER TMSAH

---

## المؤسس

<div style="text-align: center;">
  <img src="public/founder.jpeg" alt="Zeyad Mohamed" width="100" style="border-radius: 12px;" />
  <br/>
  <strong>Zeyad Mohamed</strong> — Cyber Security Student
  <br/>
  <a href="https://github.com/zeyadmohamed2610">GitHub</a> ·
  <a href="https://wa.me/201068868549">WhatsApp</a>
</div>

</div>
