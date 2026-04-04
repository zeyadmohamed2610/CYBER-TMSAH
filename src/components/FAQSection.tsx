import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "ما هي منصة CYBER TMSAH؟",
    answer: "CYBER TMSAH (سايبر تمساح) هي منصة أكاديمية شاملة مصممة خصيصاً لطلاب تخصص الأمن السيبراني في كلية التكنولوجيا الصناعة والطاقة بجامعة حلوان التكنولوجية الدولية. توفر المنصة مجموعة متكاملة من الخدمات الأكاديمية: المقررات الدراسية، الجداول الأسبوعية، نظام الحضور الذكي، الإشعارات الأكاديمية، والموارد التعليمية."
  },
  {
    question: "هل المنصة مجانية؟",
    answer: "نعم، المنصة مجانية بالكامل لطلاب تخصص الأمن السيبراني. تأتي هذه الخدمة ضمن الجهود المبذولة لتسهيل الوصول للمحتوى الأكاديمي وتنظيم العملية التعليمية دون أي تكلفة على الطلاب."
  },
  {
    question: "ما هي المقررات الدراسية المتاحة؟",
    answer: "تغطي المنصة 7 مقررات متخصصة في الأمن السيبراني: مبادئ الأمن السيبراني، اللغة الإنجليزية التقنية، أساسيات التكنولوجيا، الرسم الهندسي والإسقاط، شبكات البيانات، أنظمة التشغيل، ومهارات التفاوض الفعال. يتضمن كل مقرر محاضرات وملخصات وملفات للتحميل."
  },
  {
    question: "كيف يعمل نظام الحضور الذكي؟",
    answer: "يعتمد النظام على التحقق من الموقع الجغرافي داخل نطاق القاعة الدراسية، بالإضافة إلى كود جلسة ديناميكي يظهر للمحاضر ويتجدد كل 60 ثانية. عند إدخال الكود والتأكد من الموقع، يتم تسجيل الحضور تلقائياً. تدعم المنصة أيضاً تسجيل الحضور في حالة انقطاع الاتصال سيتم المزامنة تلقائياً عند استعادة الشبكة."
  },
  {
    question: "هل يمكنني تسجيل الحضور بدون إنترنت؟",
    answer: "نعم، تدعم المنصة تسجيل الحضور في وضع عدم الاتصال. سيتم تخزين التسجيل محلياً على جهازك، وعند استعادة الاتصال بالإنترنت سيتم إرساله تلقائياً للمزامنة. يمكنك متابعة عدد الطلبات المعلقة من خلال لوحة التحكم."
  },
  {
    question: "كيف أصل للجدول الدراسي؟",
    answer: "يمكن الوصول للجدول الدراسي من خلال صفحة 'الجدول الدراسي' في القائمة الرئيسية. قم باختيار مجموعتك الدراسية من القائمة المنسدلة اطلع على الجدول الأسبوعي الكامل الذي يتضمن أسماء المقررات وأرقام القاعات وأسماء المحاضرين لكل حصة."
  },
  {
    question: "هل المنصة تعمل على الهاتف المحمول؟",
    answer: "نعم، المنصة تعمل على جميع الأجهزة. يتوفر تسجيل الحضور عبر الهاتف المحمول لضمان دقة تحديد الموقع الجغرافي، بينما يمكنك تصفح المقررات والجدول الدراسي من أي جهاز."
  },
  {
    question: "كيف أتابع مواعيد الاختبارات والامتحانات؟",
    answer: "يقوم فريق الإدارة بإضافة مواعيد الاختبارات والامتحانات كإشعارات تلقائية. ستستلم تنبيهات قبل الموعد بـ 24 ساعة وقبل ساعة واحدة، حتى في حالة عدم الاتصال بالإنترنت. تتوفر جميع الإشعارات في أيقونة الإشعارات بلوحة التحكم."
  },
  {
    question: "هل يمكنني تحميل المواد التعليمية؟",
    answer: "نعم، يمكنك تحميل المحاضرات والملفات المتاحة لكل مقرر مباشرة من صفحة المقرر. يتضمن كل مقرر قائمة شاملة بجميع المحاضرات والملفات المرفوعة."
  }
];

export const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section 
      className="py-16 section-container"
      vocab="https://schema.org/"
      typeof="FAQPage"
    >
      <div className="max-w-3xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 mb-4">
            <HelpCircle className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">الأسئلة الشائعة</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">
            أسئلة <span className="text-primary">متكررة</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            إليك إجابات على أكثر الأسئلة شيوعاً حول منصة CYBER TMSAH
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {faqData.map((item, index) => (
            <div 
              key={index}
              property="mainEntity" 
              typeof="Question"
              className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
                openIndex === index 
                  ? "border-primary/50 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.1)]" 
                  : "border-border/50 bg-card/50 hover:border-border"
              }`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between gap-4 p-5 text-right transition-colors"
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
              >
                <h3 property="name" className={`font-bold text-base md:text-lg transition-colors ${
                  openIndex === index ? "text-primary" : "text-foreground"
                }`}>
                  {item.question}
                </h3>
                <ChevronDown 
                  className={`w-5 h-5 shrink-0 text-primary transition-transform duration-300 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              
              <div
                id={`faq-answer-${index}`}
                property="acceptedAnswer" 
                typeof="Answer"
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? "max-h-96" : "max-h-0"
                }`}
              >
                <div className="px-5 pb-5 pt-0 border-t border-primary/10">
                  <p property="text" className="text-muted-foreground leading-relaxed pt-4">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
