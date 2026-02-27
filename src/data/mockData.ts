// Sections from 1 to 15
export const sections = Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`);

export interface Lecture {
  time: string;
  subject: string;
  instructor: string;
  room: string;
  type?: "lecture" | "section";
  isNext?: boolean;
}

export interface DaySchedule {
  day: string;
  date: string;
  lectures: Lecture[];
  isHoliday?: boolean;
  isTraining?: boolean;
  trainingMessage?: string;
}

// Helper to generate time slots (8 periods, 1 hour each, 5 min break)
// First period starts at 9:00 AM
export const timeSlots = [
  "09:00 - 09:40",
  "09:45 - 10:25",
  "10:30 - 11:10",
  "11:15 - 11:55",
  "12:00 - 12:40",
  "12:45 - 13:25",
  "13:30 - 14:10",
  "14:15 - 14:55",
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
      { time: timeSlots[0], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "قاعة 101", type: "lecture" },
      { time: timeSlots[1], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
      { time: timeSlots[2], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
    ],
  },
  {
    day: "الأحد",
    date: weekDates[1],
    lectures: [
      { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
      { time: timeSlots[1], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
      { time: timeSlots[2], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف ميمي", room: "قاعة 201", type: "lecture" },
      { time: timeSlots[3], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    ],
  },
  {
    day: "الاثنين",
    date: weekDates[2],
    lectures: [],
    isTraining: true,
    trainingMessage: "قريباً سيتم تزويد التفاصيل",
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
      { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
      { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
      { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
      { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
    ],
  },
  {
    day: "الخميس",
    date: weekDates[5],
    lectures: [
      { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
      { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
    ],
  },
  {
    day: "الجمعة",
    date: weekDates[6],
    lectures: [],
    isHoliday: true,
  },
];

// Get today's schedule (for all sections - default schedule)
export const getTodaySchedule = (section?: string): DaySchedule | null => {
  const today = new Date();
  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const todayName = dayNames[today.getDay()];
  const schedule = section ? getSectionSchedule(section) : weekSchedule;
  return schedule.find(d => d.day === todayName) || null;
};

// Get schedule for a specific section
export const getSectionSchedule = (section: string): DaySchedule[] => {
  // For now, all sections share the same schedule
  // You can customize this per section if needed
  return weekSchedule;
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
  teachingAssistants?: string[];
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
    teachingAssistants: ["م. ولاء جمعه", "م. رضوي شعبان"],
    articles: [
      { id: "1", title: "المحاضرة 1 -  شرح كامل لنظم الأعداد في الحاسوب ", blogUrl: "https://cyber-tmsah.blogspot.com/2026/02/networks-data-communication-lecture-1-number-systems.html" },
    ]
  },
  { 
    id: "engineering-drawing", 
    title: "رسم هندسي واسقاط", 
    icon: "📐", 
    instructor: "د. محمد عثمان - د. حسين السيد",
    teachingAssistants: ["م. دينا علي"],
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
    teachingAssistants: ["م. محمد حمدي", "م. كريم عادل"],
    articles: [
      { id: "1", title: "المحاضرة 1 - مفهوم نظام التشغيل ومكوناته وأنواعه بالتفصيل", blogUrl: "https://cyber-tmsah.blogspot.com/2026/02/operating-systems-lecture-1-basics.html" },
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
