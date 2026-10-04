export const SITE_ORIGIN = "https://www.cyber-tmsah.site";
export const SITE_NAME = "CYBER TMSAH";
export const SITE_DESCRIPTION =
  "منصة سايبر تمساح الأكاديمية لمتابعة الجدول الدراسي والمحاضرات والسكاشن والحضور والغياب لطلاب جامعة حلوان التكنولوجية الدولية.";
export const SITE_OVERVIEW = {
  heading: "عن منصة CYBER TMSAH — سايبر تمساح",
  introduction: SITE_DESCRIPTION,
  audience:
    "تجمع المنصة الطلاب والدكاترة والمعيدين ومنسقي البرامج في مكان واحد لتنظيم الدراسة وإدارة الحضور، مع عرض المعلومات والمهام المناسبة لكل حساب.",
  sections: [
    {
      title: "الجدول الدراسي والامتحانات",
      description:
        "عرض يومي وأسبوعي للمحاضرات والسكاشن ومواعيد الامتحانات. يرى الطالب جدول فرقته وسكشنه، وتتولى الإدارة استيراد جدول الجامعة وتحديث المواعيد والأماكن.",
    },
    {
      title: "الحضور والغياب",
      description:
        "تسجيل الحضور بمفتاح الدخول بعد تأكيد الهوية على الجهاز، ومتابعة السجل ونتائج الحضور حسب المادة، وتقديم الأعذار وطلبات تصحيح التسجيل ومراجعتها.",
    },
    {
      title: "الأقسام والمواد والحسابات",
      description:
        "إدارة الأقسام والفرق الدراسية والمواد المسندة إلى هيئة التدريس، واعتماد طلبات الانضمام. يقتصر وصول كل حساب على ما تسمح به رتبته وأقسامه المعتمدة.",
    },
  ],
  access:
    "استخدام الخدمات الأكاديمية يتطلب حسابًا معتمدًا. يمكن للطالب أو عضو هيئة التدريس تقديم طلب انضمام، ثم تسجيل الدخول بعد موافقة الإدارة.",
};
export function pageMetadata(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  const entry = path === "/" || path === "/login",
    join = path === "/join",
    about = path === "/about";
  return {
    title: join
      ? "طلب الانضمام | CYBER TMSAH — سايبر تمساح"
      : about
        ? "عن المنصة | CYBER TMSAH — سايبر تمساح"
        : entry
          ? "CYBER TMSAH | سايبر تمساح — المنصة الأكاديمية"
          : "CYBER TMSAH | سايبر تمساح",
    description: join
      ? "قدّم طلب الانضمام إلى منصة CYBER TMSAH لمتابعة جدولك الدراسي والحضور والغياب بعد اعتماد حسابك."
      : SITE_DESCRIPTION,
    url: SITE_ORIGIN + (entry ? "/" : path),
    indexable: entry || join || about,
  };
}
export const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": SITE_ORIGIN + "/#organization",
      name: SITE_NAME,
      alternateName: "سايبر تمساح",
      url: SITE_ORIGIN + "/",
      logo: SITE_ORIGIN + "/brand/icon-512.png",
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": SITE_ORIGIN + "/#website",
      name: SITE_NAME,
      alternateName: "سايبر تمساح",
      url: SITE_ORIGIN + "/",
      description: SITE_DESCRIPTION,
      inLanguage: "ar",
      publisher: { "@id": SITE_ORIGIN + "/#organization" },
    },
  ],
};
