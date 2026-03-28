// Time slots (8 periods, 60 min each + 5 min break)
// 12-hour format with AM/PM
export const timeSlots = [
  "9:00 AM - 10:00 AM",
  "10:05 AM - 11:05 AM",
  "11:10 AM - 12:10 PM",
  "12:15 PM - 1:15 PM",
  "1:20 PM - 2:20 PM",
  "2:25 PM - 3:25 PM",
  "3:30 PM - 4:30 PM",
  "4:35 PM - 5:35 PM",
];

// Get current week dates starting from Saturday
const getWeekDates = () => {
  // Fixed dates for semester (starting from Saturday)
  return [
    "7 مارس 2026",
    "8 مارس 2026",
    "9 مارس 2026",
    "10 مارس 2026",
    "11 مارس 2026",
    "12 مارس 2026",
    "13 مارس 2026",
  ];
};

export const weekDates = getWeekDates();

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

// Sections from 1 to 15
export const sections = Array.from({ length: 15 }, (_, i) => `سكشن ${i + 1}`);

// ============================================
// 📅 SCHEDULE DATA FOR EACH DAY
// ============================================

// Saturday - Section-specific lectures (each section can have different schedule)
const saturdayLectures: { [key: number]: Lecture[] } = {
  1: [
    { time: timeSlots[0], subject: "نظم تشغيل", instructor: "م. محمد حمدي", room: "A02", type: "section" },
    { time: timeSlots[2], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "G201", type: "lecture" },
    { time: timeSlots[5], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "G203", type: "lecture" },
  ],
  2: [
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "م. محمد حمدي", room: "A02", type: "section" },
    { time: timeSlots[2], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "G201", type: "lecture" },
    { time: timeSlots[5], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "G203", type: "lecture" },
  ],
  3: [
    { time: timeSlots[3], subject: "نظم تشغيل", instructor: "م. محمد حمدي", room: "A02", type: "section" },
    { time: timeSlots[2], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "G201", type: "lecture" },
    { time: timeSlots[5], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "G203", type: "lecture" },
  ],
  4: [
    { time: timeSlots[2], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "G201", type: "lecture" },
    { time: timeSlots[5], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "G203", type: "lecture" },
  ],
  5: [
    { time: timeSlots[2], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "G201", type: "lecture" },
    { time: timeSlots[5], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "G203", type: "lecture" },
  ],
  6: [
    { time: timeSlots[2], subject: "نظم تشغيل", instructor: "م. محمد حمدي", room: "A02", type: "section" },
    { time: timeSlots[3], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "F-Sem", type: "lecture" },
    { time: timeSlots[4], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "F-Sem", type: "lecture" },
  ],
  7: [
    { time: timeSlots[3], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "F-Sem", type: "lecture" },
    { time: timeSlots[4], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "F-Sem", type: "lecture" },
  ],
  8: [
    { time: timeSlots[3], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "F-Sem", type: "lecture" },
    { time: timeSlots[4], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "F-Sem", type: "lecture" },
  ],
  9: [
    { time: timeSlots[3], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "F-Sem", type: "lecture" },
    { time: timeSlots[4], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "F-Sem", type: "lecture" },
  ],
  10: [
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "م. رضوي شعبان", room: "D104", type: "section" },
    { time: timeSlots[3], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "F-Sem", type: "lecture" },
    { time: timeSlots[4], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "F-Sem", type: "lecture" },
  ],
  11: [
    { time: timeSlots[2], subject: "شبكات وتراسل البيانات", instructor: "م. رضوي شعبان", room: "D104", type: "section" },
    { time: timeSlots[3], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "F-Sem", type: "lecture" },
    { time: timeSlots[4], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "F-Sem", type: "lecture" },
  ],
  12: [
    { time: timeSlots[3], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "G203", type: "lecture" },
    { time: timeSlots[4], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "G203", type: "lecture" },
  ],
  13: [
    { time: timeSlots[3], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "G203", type: "lecture" },
    { time: timeSlots[4], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "G203", type: "lecture" },
    { time: timeSlots[5], subject: "نظم تشغيل", instructor: "م. كريم عادل", room: "A02", type: "section" },
  ],
  14: [
    { time: timeSlots[3], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "G203", type: "lecture" },
    { time: timeSlots[4], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "G203", type: "lecture" },
    { time: timeSlots[6], subject: "نظم تشغيل", instructor: "م. كريم عادل", room: "A02", type: "section" },
  ],
   15: [
    { time: timeSlots[3], subject: "مهارات التفاوض", instructor: "د. نجلاء عبدالمحسن", room: "G203", type: "lecture" },
    { time: timeSlots[4], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "G203", type: "lecture" },
    { time: timeSlots[7], subject: "نظم تشغيل", instructor: "م. كريم عادل", room: "A02", type: "section" },
  ],
};

// Sunday - Section-specific (only sections 12, 13, 14, 15 have attendance)
const sundayLectures: { [key: number]: Lecture[] } = {
  1: [], // إجازة
  2: [], // إجازة
  3: [], // إجازة
  4: [], // إجازة
  5: [], // إجازة
  6: [], // إجازة
  7: [], // إجازة
  8: [], // إجازة
  9: [], // إجازة
  10: [], // إجازة
  11: [], // إجازة
  12: [
    // الرسم الهندسي - م. دينا علي - G205 - الفترة 4
    { time: timeSlots[3], subject: "رسم هندسي واسقاط", instructor: "م. دينا علي", room: "G205", type: "section" },
    // الشبكات وتراسل البيانات - م. رضوي شعبان - D101 - الفترة 5
    { time: timeSlots[4], subject: "شبكات وتراسل البيانات", instructor: "م. رضوي شعبان", room: "D101", type: "section" },
  ],
  13: [
    // الرسم الهندسي - م. دينا علي - G205 - الفترة 3
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "م. دينا علي", room: "G205", type: "section" },
    // الشبكات وتراسل البيانات - م. رضوي شعبان - D101 - الفترة 2
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "م. رضوي شعبان", room: "D101", type: "section" },
  ],
  14: [
    // الرسم الهندسي - م. دينا علي - G205 - الفترة 4
    { time: timeSlots[3], subject: "رسم هندسي واسقاط", instructor: "م. دينا علي", room: "G205", type: "section" },
    // الشبكات وتراسل البيانات - م. رضوي شعبان - D101 - الفترة 3
    { time: timeSlots[2], subject: "شبكات وتراسل البيانات", instructor: "م. رضوي شعبان", room: "D101", type: "section" },
  ],
  15: [
    // الرسم الهندسي - م. دينا علي - G205 - الفترة 3
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "م. دينا علي", room: "G205", type: "section" },
    // الشبكات وتراسل البيانات - م. رضوي شعبان - D101 - الفترة 4
    { time: timeSlots[3], subject: "شبكات وتراسل البيانات", instructor: "م. رضوي شعبان", room: "D101", type: "section" },
  ],
};

// Tuesday - Section-specific (same as Sunday)
const tuesdayLectures: { [key: number]: Lecture[] } = { ...sundayLectures };

// Wednesday - Section-specific
const wednesdayLectures: { [key: number]: Lecture[] } = {
  1: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  2: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  3: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  4: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  5: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  6: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  7: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  8: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  9: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  10: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  11: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  12: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  13: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  14: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
  15: [
    { time: timeSlots[0], subject: "لغة انجليزية", instructor: "د. صابرين", room: "قاعة 102", type: "lecture" },
    { time: timeSlots[1], subject: "نظم تشغيل", instructor: "د. عبير حسن", room: "معمل 2", type: "lecture" },
    { time: timeSlots[2], subject: "رسم هندسي واسقاط", instructor: "د. محمد عثمان", room: "معمل الرسم", type: "lecture" },
    { time: timeSlots[3], subject: "مبادئ تكنولوجيا", instructor: "د. أشرف", room: "قاعة 201", type: "lecture" },
  ],
};

// Thursday - Section-specific
const thursdayLectures: { [key: number]: Lecture[] } = {
  1: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  2: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  3: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  4: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  5: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  6: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  7: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  8: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  9: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  10: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  11: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  12: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  13: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  14: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
  15: [
    { time: timeSlots[0], subject: "مبادئ الأمن السيبراني", instructor: "د. سامح مصطفى", room: "معمل 1", type: "lecture" },
    { time: timeSlots[1], subject: "شبكات وتراسل البيانات", instructor: "د. سيمون عزت", room: "قاعة 203", type: "lecture" },
  ],
};

// ============================================
// 🔧 FUNCTIONS
// ============================================

/**
 * Get schedule for a specific section
 * @param section - Section name like "سكشن 1", "سكشن 2", etc.
 * @returns Array of DaySchedule for the week
 * 
 * @example
 * // Get schedule for section 1
 * const schedule = getSectionSchedule("سكشن 1");
 * 
 * // Get schedule for section 5
 * const schedule = getSectionSchedule("سكشن 5");
 */
export const getSectionSchedule = (section: string): DaySchedule[] => {
  const sectionNum = parseInt(section.replace(/\D/g, ''));
  
  return [
    { day: "السبت", date: weekDates[0], lectures: saturdayLectures[sectionNum] || [] },
    { day: "الأحد", date: weekDates[1], lectures: sundayLectures[sectionNum] || [] },
    { day: "الاثنين", date: weekDates[2], lectures: [], isTraining: true, trainingMessage: "قريباً سيتم تزويد التفاصيل" },
    { day: "الثلاثاء", date: weekDates[3], lectures: tuesdayLectures[sectionNum] || [] },
    { day: "الأربعاء", date: weekDates[4], lectures: wednesdayLectures[sectionNum] || [] },
    { day: "الخميس", date: weekDates[5], lectures: thursdayLectures[sectionNum] || [] },
    { day: "الجمعة", date: weekDates[6], lectures: [], isHoliday: true },
  ];
};

/**
 * Get today's schedule for a specific section
 */
export const getTodaySchedule = (section?: string): DaySchedule | null => {
  const today = new Date();
  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const todayName = dayNames[today.getDay()];
  const schedule = getSectionSchedule(section || "سكشن 1");
  return schedule.find(d => d.day === todayName) || null;
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
