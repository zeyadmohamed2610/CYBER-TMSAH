// src/i18n/en.ts — English translations (primary language)

const en = {
  // ── Auth ─────────────────────────────────────────────────
  auth: {
    welcome: "Welcome Back",
    subtitle: "Sign in to access your CYBER TMSAH dashboard",
    username: "Username",
    usernamePlaceholder: "Enter your username",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    signIn: "Sign In",
    signingIn: "Signing in…",
    joinTitle: "Request Access",
    joinSubtitle: "Fill in the form and wait for admin approval",
    submitRequest: "Submit Request",
    submitting: "Submitting…",
    requestSent: "Request submitted! Wait for admin approval.",
    // Join form fields
    fullName: "Full Name",
    fullNamePlaceholder: "Enter your full name",
    chooseRole: "Your Role",
    student: "Student",
    doctor: "Professor (Doctor)",
    ta: "Teaching Assistant",
    seatNumber: "Seat Number / Student ID",
    seatNumberPlaceholder: "e.g. 20240001",
    sectionNumber: "Section Number",
    sectionPlaceholder: "e.g. 3",
    rankInList: "Rank in Register (optional)",
    rankPlaceholder: "e.g. 15",
    // Errors
    loginFailed: "Invalid username or password. Please try again.",
    lockedOut: "Too many failed attempts.",
    lockedOutTimer: "Try again in {{minutes}} minute(s).",
    requiredField: "This field is required.",
    usernameTaken: "This username is already taken.",
  },

  // ── Navigation ───────────────────────────────────────────
  nav: {
    schedule: "Schedule",
    materials: "Materials",
    attendance: "Attendance",
    about: "About",
    logout: "Logout",
    dashboard: "Dashboard",
  },

  // ── Roles ────────────────────────────────────────────────
  roles: {
    owner: "Owner",
    doctor: "Doctor",
    ta: "Teaching Assistant",
    student: "Student",
  },

  // ── Common ───────────────────────────────────────────────
  common: {
    loading: "Loading…",
    error: "Something went wrong.",
    retry: "Retry",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    approve: "Approve",
    reject: "Reject",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    noData: "No data available.",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    language: "Language",
    section: "Section",
    day: "Day",
    period: "Period",
    subject: "Subject",
    instructor: "Instructor",
    room: "Room",
  },

  // ── Schedule ─────────────────────────────────────────────
  schedule: {
    title: "Weekly Schedule",
    noSchedule: "No schedule published yet.",
    noScheduleHint: "The admin needs to publish the schedule from the dashboard.",
    download: "Download Schedule",
    lectures: "Lectures",
    sections: "Sections",
    days: 7,
    today: "Today",
    holiday: "Holiday",
    training: "Training Day",
  },

  // ── Owner Dashboard ──────────────────────────────────────
  owner: {
    dashboardTitle: "Owner Dashboard",
    joinRequests: "Join Requests",
    pendingRequests: "Pending Requests",
    noRequests: "No pending requests.",
    approveUser: "Approve",
    rejectUser: "Reject",
    publishSchedule: "Publish Schedule",
    scheduleEditor: "Schedule Editor",
    examSchedules: "Exam Schedules",
  },

  // ── Student Dashboard ────────────────────────────────────
  student: {
    dashboardTitle: "My Dashboard",
    mySchedule: "My Schedule",
    myAttendance: "My Attendance",
    attendanceRate: "Attendance Rate",
  },

  // ── About ────────────────────────────────────────────────
  about: {
    title: "About CYBER TMSAH",
    description:
      "CYBER TMSAH is an academic platform for cybersecurity students at Helwan International Technological University.",
  },
} as const;

export default en;
export type Translations = typeof en;
