// Sections from 1 to 10
export const sections = Array.from({ length: 10 }, (_, i) => `سكشن ${i + 1}`);

export interface Lecture {
  time: string;
  subject: string;
  instructor: string;
  room: string;
  isNext?: boolean;
}

export interface DaySchedule {
  day: string;
  date: string;
  lectures: Lecture[];
  isHoliday?: boolean;
}

// Helper to generate time slots (8 periods, 1 hour each, 5 min break)
// First period starts at 9:00 AM
export const timeSlots = [
  "09:00 - 10:00",
  "10:05 - 11:05",
  "11:10 - 12:10",
  "12:15 - 13:15",
  "13:20 - 14:20",
  "14:25 - 15:25",
  "15:30 - 16:30",
  "16:35 - 17:35",
];

// Get current week dates starting from Saturday
const getWeekDates = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // Calculate days since Saturday (Saturday = 6)
  const daysSinceSaturday = (dayOfWeek + 1) % 7;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() - daysSinceSaturday);
  
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(saturday);
    date.setDate(saturday.getDate() + i);
    dates.push(date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }));
  }
  return dates;
};

const weekDates = getWeekDates();

export const weekSchedule: DaySchedule[] = [
  {
    day: "السبت",
    date: weekDates[0],
    lectures: [
      { time: timeSlots[0], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "قاعة 101" },
      { time: timeSlots[1], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1" },
      { time: timeSlots[2], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203" },
    ],
  },
  {
    day: "الأحد",
    date: weekDates[1],
    lectures: [
      { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102" },
      { time: timeSlots[1], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم" },
      { time: timeSlots[2], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف ميمي", room: "قاعة 201" },
      { time: timeSlots[3], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2" },
    ],
  },
  {
    day: "الاثنين",
    date: weekDates[2],
    lectures: [
      { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1" },
      { time: timeSlots[1], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "قاعة 101" },
      { time: timeSlots[2], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203" },
    ],
  },
  {
    day: "الثلاثاء",
    date: weekDates[3],
    lectures: [],
    isHoliday: true,
  },
  {
    day: "الأربعاء",
    date: weekDates[4],
    lectures: [
      { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102" },
      { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2" },
      { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم" },
      { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201" },
    ],
  },
  {
    day: "الخميس",
    date: weekDates[5],
    lectures: [
      { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1" },
      { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203" },
    ],
  },
  {
    day: "الجمعة",
    date: weekDates[6],
    lectures: [],
    isHoliday: true,
  },
];

// Get today's schedule
export const getTodaySchedule = (): DaySchedule | null => {
  const today = new Date();
  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const todayName = dayNames[today.getDay()];
  return weekSchedule.find(d => d.day === todayName) || null;
};

export const getTodayName = (): string => {
  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return dayNames[new Date().getDay()];
};

export const getTodayDate = (): string => {
  return new Date().toLocaleDateString('ar-EG', { 
    weekday: 'long',
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
};

export interface Subject {
  id: string;
  title: string;
  icon: string;
  instructor: string;
  pdfUrl?: string;
  articles: Article[];
}

export interface Article {
  id: string;
  title: string;
  blogUrl: string;
}

export const subjects: Subject[] = [
  { 
    id: "negotiation", 
    title: "مهارات التفاوض", 
    icon: "🤝", 
    instructor: "د. نجلاء عبدالمحسن",
    articles: [
      { id: "1", title: "المحاضرة 1 -  أساسيات التفاوض واستراتيجيات النجاح  ", blogUrl: "https://cyber-tmsah.blogspot.com/2026/02/negotiation-skills-lecture-1.html" },
    ]
  },
  { 
    id: "cybersecurity", 
    title: "مبادئ الأمن السيبراني", 
    icon: "🛡️", 
    instructor: "د. سامح مصطفى",
    articles: [
      { id: "1", title: "المحاضرة 1 - مقدمة في أمن المعلومات ", blogUrl: "https://cyber-tmsah.blogspot.com/2026/02/information-security-basics-cia-triad.html" },
    ]
  },
  { 
    id: "english", 
    title: "لغة انجليزية", 
    icon: "📚", 
    instructor: "د. صابرين",
    articles: [
      { id: "1", title: "المحاضرة الأولى - Grammar Basics", blogUrl: "#" },
      { id: "2", title: "المحاضرة الثانية - Vocabulary Building", blogUrl: "#" },
      { id: "3", title: "المحاضرة الثالثة - Reading Comprehension", blogUrl: "#" },
    ]
  },
  { 
    id: "networking", 
    title: "شبكات وتراسل البيانات", 
    icon: "🌐", 
    instructor: "د. سيمون عزت",
    articles: [
      { id: "1", title: "المحاضرة 1 -  شرح كامل لنظم الأعداد في الحاسوب ", blogUrl: "https://cyber-tmsah.blogspot.com/2026/02/networks-data-communication-lecture-1-number-systems.html" },
    ]
  },
  { 
    id: "engineering-drawing", 
    title: "رسم هندسي واسقاط", 
    icon: "📐", 
    instructor: "د. محمد عثمان",
    articles: [
      { id: "1", title: "المحاضرة الأولى - أساسيات الرسم الهندسي", blogUrl: "#" },
      { id: "2", title: "المحاضرة الثانية - الإسقاط العمودي", blogUrl: "#" },
      { id: "3", title: "المحاضرة الثالثة - المناظير", blogUrl: "#" },
    ]
  },
  { 
    id: "technology", 
    title: "مبادئ تكنولوجيا", 
    icon: "💻", 
    instructor: "د. أشرف",
    articles: [
      { id: "1", title: "المحاضرة الأولى - مقدمة في التكنولوجيا", blogUrl: "#" },
      { id: "2", title: "المحاضرة الثانية - تطور التكنولوجيا", blogUrl: "#" },
      { id: "3", title: "المحاضرة الثالثة - التطبيقات التكنولوجية", blogUrl: "#" },
    ]
  },
  { 
    id: "os", 
    title: "نظم تشغيل", 
    icon: "⚙️", 
    instructor: "د. عبير حسن",
    articles: [
      { id: "1", title: "المحاضرة الأولى - مقدمة في نظم التشغيل", blogUrl: "#" },
      { id: "2", title: "المحاضرة الثانية - إدارة الذاكرة", blogUrl: "#" },
      { id: "3", title: "المحاضرة الثالثة - إدارة العمليات", blogUrl: "#" },
    ]
  },
];

// Founder social links
export const founderSocials = {
  name: "زياد محمد",
  role: "مؤسس المنصة",
  title: "طالب أمن سيبراني | صانع محتوى",
  bio: "أعمل على الإنترنت منذ أكثر من 11 عامًا، متخصص في التدوين وصناعة المحتوى على يوتيوب والمنصات المختلفة. أدرت العديد من المجتمعات الكبرى على فيسبوك بفضل قدرتي على التواصل الفعّال مع الجميع. شغوف بالأمن السيبراني والتقنية. وأشغل منصب Co-Lead في GDG CITU.",
  experience: "+11",
  experienceLabel: "سنة خبرة",
  facebook: "https://www.facebook.com/zeyad.eltmsah",
  whatsapp: "https://wa.me/201553450232",
  linkedin: "https://www.linkedin.com/in/zeyadmohamed26/",
  github: "https://github.com/zeyadmohamed2610",
};
