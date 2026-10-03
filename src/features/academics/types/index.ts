export type DepartmentId =
  | "cybersecurity"
  | "ai"
  | "data_science"
  | "mechatronics"
  | "autotronics"
  | "control_systems"
  | "garments";

export interface DepartmentInfo {
  id: DepartmentId;
  nameAr: string;
  nameEn: string;
}

export const DEPARTMENTS: DepartmentInfo[] = [
  { id: "cybersecurity", nameAr: "أمن سيبراني", nameEn: "Cybersecurity" },
  { id: "ai", nameAr: "ذكاء اصطناعي", nameEn: "Artificial Intelligence" },
  { id: "data_science", nameAr: "علوم بيانات", nameEn: "Data Science" },
  { id: "mechatronics", nameAr: "ميكاترونكس", nameEn: "Mechatronics" },
  { id: "autotronics", nameAr: "أوتوترونكس", nameEn: "Autotronics" },
  { id: "control_systems", nameAr: "أنظمة تحكم", nameEn: "Control Systems" },
  { id: "garments", nameAr: "صناعة الملابس الجاهزة", nameEn: "Ready-made Garments" },
];

export const ACADEMIC_YEARS = [
  { id: "1", nameAr: "الفرقة الأولى", nameEn: "First Year (Level 1)" },
  { id: "2", nameAr: "الفرقة الثانية", nameEn: "Second Year (Level 2)" },
  { id: "3", nameAr: "الفرقة الثالثة", nameEn: "Third Year (Level 3)" },
  { id: "4", nameAr: "الفرقة الرابعة", nameEn: "Fourth Year (Level 4)" },
] as const;

export interface Subject {
  id: string;
  name: string;
  doctor_name: string;
  createdAt: string;
}
