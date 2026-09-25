// src/i18n/ar.ts — Arabic translations (secondary language)

import type { Translations } from "./en";

const ar: Translations = {
  auth: {
    welcome: "مرحباً بعودتك",
    subtitle: "سجّل دخولك للوصول إلى لوحة تحكم CYBER TMSAH",
    username: "اسم المستخدم",
    usernamePlaceholder: "أدخل اسم المستخدم",
    password: "كلمة المرور",
    passwordPlaceholder: "أدخل كلمة المرور",
    signIn: "تسجيل الدخول",
    signingIn: "جاري الدخول…",
    joinTitle: "طلب الانضمام",
    joinSubtitle: "أكمل النموذج وانتظر موافقة المشرف",
    submitRequest: "إرسال الطلب",
    submitting: "جاري الإرسال…",
    requestSent: "تم إرسال الطلب! انتظر موافقة المشرف.",
    fullName: "الاسم الثلاثي",
    fullNamePlaceholder: "أدخل اسمك الثلاثي كاملاً",
    chooseRole: "رتبتك",
    student: "طالب",
    doctor: "دكتور",
    ta: "معيد",
    seatNumber: "رقم الجلوس / كود الطالب",
    seatNumberPlaceholder: "مثال: 20240001",
    sectionNumber: "رقم الشعبة / السكشن",
    sectionPlaceholder: "مثال: 3",
    rankInList: "الترتيب في الكشف (اختياري)",
    rankPlaceholder: "مثال: 15",
    loginFailed: "اسم المستخدم أو كلمة المرور غير صحيحة.",
    lockedOut: "تجاوزت الحد المسموح من المحاولات.",
    lockedOutTimer: "حاول مجدداً بعد {{minutes}} دقيقة.",
    requiredField: "هذا الحقل مطلوب.",
    usernameTaken: "اسم المستخدم هذا مستخدم بالفعل.",
  },

  nav: {
    schedule: "الجدول الدراسي",
    materials: "المواد الدراسية",
    attendance: "الحضور",
    about: "عن المنصة",
    logout: "تسجيل الخروج",
    dashboard: "لوحة التحكم",
  },

  roles: {
    owner: "المالك",
    doctor: "الدكتور",
    ta: "المعيد",
    student: "الطالب",
  },

  common: {
    loading: "جاري التحميل…",
    error: "حدث خطأ ما.",
    retry: "إعادة المحاولة",
    save: "حفظ",
    cancel: "إلغاء",
    confirm: "تأكيد",
    approve: "قبول",
    reject: "رفض",
    pending: "قيد الانتظار",
    approved: "مقبول",
    rejected: "مرفوض",
    noData: "لا توجد بيانات.",
    darkMode: "الوضع الداكن",
    lightMode: "الوضع الفاتح",
    language: "اللغة",
    section: "شعبة",
    day: "اليوم",
    period: "الحصة",
    subject: "المادة",
    instructor: "المحاضر",
    room: "القاعة",
  },

  schedule: {
    title: "الجدول الدراسي الأسبوعي",
    noSchedule: "لا يوجد جدول منشور حالياً.",
    noScheduleHint: "المدير بحاجة لنشر الجدول أولاً من لوحة التحكم.",
    download: "تحميل الجدول",
    lectures: "محاضرات",
    sections: "سكشنات",
    days: 7,
    today: "اليوم",
    holiday: "إجازة",
    training: "يوم تدريب",
  },

  owner: {
    dashboardTitle: "لوحة تحكم المالك",
    joinRequests: "طلبات الانضمام",
    pendingRequests: "الطلبات المعلقة",
    noRequests: "لا توجد طلبات معلقة.",
    approveUser: "قبول",
    rejectUser: "رفض",
    publishSchedule: "نشر الجدول",
    scheduleEditor: "محرر الجدول",
    examSchedules: "جداول الامتحانات",
  },

  student: {
    dashboardTitle: "لوحتي",
    mySchedule: "جدولي الدراسي",
    myAttendance: "سجل حضوري",
    attendanceRate: "نسبة الحضور",
  },

  about: {
    title: "عن منصة سايبر تمساح",
    description:
      "CYBER TMSAH (سايبر تمساح) منصة أكاديمية متكاملة لطلاب الأمن السيبراني في جامعة حلوان التكنولوجية الدولية.",
  },
};

export default ar;
