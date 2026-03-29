export interface Article {
  id: string;
  title: string;
  blogUrl: string;
}

export interface SectionContent {
  id: string;
  title: string;
  description: string;
}

export interface Subject {
  id: string;
  title: string;
  icon: string;
  instructor: string;
  secondInstructor?: string;
  teachingAssistants?: string[];
  articles: Article[];
  sections?: SectionContent[];
}

// ============================================
// 📚 SUBJECTS DATA
// ============================================

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
    ],
    sections: [
      { id: "s1", title: "سكشن 1", description: "شرح أنظمة العد والتحويل بينها" },
      { id: "s2", title: "سكشن 2", description: "العمليات الحسابية في النظام الثنائي" },
    ]
  },
  { 
    id: "engineering-drawing", 
    title: "رسم هندسي واسقاط", 
    icon: "📐", 
    instructor: "د. محمد عثمان",
    secondInstructor: "د. حسين السيد",
    teachingAssistants: ["م. دينا علي"],
    articles: [
      { id: "1", title: "المحاضرة الأولى - أساسيات الرسم الهندسي", blogUrl: "#" },
      { id: "2", title: "المحاضرة الثانية - الإسقاط العمودي", blogUrl: "#" },
      { id: "3", title: "المحاضرة الثالثة - المناظير", blogUrl: "#" },
    ],
    sections: [
      { id: "s1", title: "سكشن 1", description: "أساسيات الرسم الهندسي" },
      { id: "s2", title: "سكشن 2", description: "الإسقاط العمودي" },
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
    ],
    sections: [
      { id: "s1", title: "سكشن 1", description: "مقدمة في أنظمة التشغيل" },
      { id: "s2", title: "سكشن 2", description: "إدارة العمليات والذاكرة" },
    ]
  },
];
