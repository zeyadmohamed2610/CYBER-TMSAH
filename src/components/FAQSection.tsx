import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "ما هي منصة CYBER TMSAH؟",
    answer: "CYBER TMSAH (سايبر تمساح) هي منصة أكاديمية شاملة مصممة خصيصاً لطلاب الأمن السيبراني في جامعة حلوان التكنولوجية الدولية. توفر لك كل ما تحتاجه في مكان واحد: مواد دراسية، جداول محاضرات، نظام حضور ذكي، مواعيد امتحانات، إشعارات فورية، ومراجعات كاملة."
  },
  {
    question: "هل المنصة مجانية؟",
    answer: "نعم، المنصة مجانية بالكامل لجميع طلاب الأمن السيبراني. الهدف هو تسهيل الوصول للمواد الدراسية وتنظيم حياتك الأكاديمية بدون أي تكلفة."
  },
  {
    question: "ما هي المواد الدراسية المتاحة؟",
    answer: "المنصة تغطي 7 مواد: مبادئ الأمن السيبراني، اللغة الإنجليزية، مبادئ التكنولوجيا، الرسم الهندسي والإسقاط، شبكات وتراسل البيانات، نظم التشغيل، ومهارات التفاوض. كل مادة تحتوي على محاضرات، ملخصات، وملفات قابلة للتحميل."
  },
  {
    question: "كيف يعمل نظام الحضور الذكي؟",
    answer: "النظام يعتمد على تحديد موقعك الجغرافي بالقرب من القاعة، بالإضافة إلى كود جلسة يظهر للدكتور ويتجدد كل 60 ثانية. عند إدخال الكود وتأكيد الموقع، يتم تسجيل حضورك تلقائياً. يمكنك أيضاً تسجيل الحضور حتى بدون إنترنت وسيتم المزامنة لاحقاً."
  },
  {
    question: "هل يمكنني تسجيل الحضور بدون إنترنت؟",
    answer: "نعم! إذا لم يكن لديك اتصال بالإنترنت، سيتم حفظ تسجيل الحضور محلياً في جهازك. عند عودة الاتصال، يتم إرسال التسجيل تلقائياً. ستجد عداد الطلبات المعلقة في لوحة التحكم الخاصة بك."
  },
  {
    question: "كيف أصل للجدول الدراسي؟",
    answer: "من خلال صفحة 'الجدول الدراسي' في القائمة الرئيسية. يمكنك اختيار سكشنك من القائمة المنسدلة وسترى الجدول الأسبوعي الكامل مع أسماء المواد والقاعة والمحاضر لكل محاضرة."
  },
  {
    question: "هل المنصة تعمل على الهاتف المحمول؟",
    answer: "نعم، المنصة مصممة لتعمل على جميع الأجهزة. تسجيل الحضور متاح فقط من الهاتف المحمول لضمان دقة تحديد الموقع، بينما يمكنك تصفح المواد والجدول من أي جهاز."
  },
  {
    question: "كيف أعرف مواعيد الامتحانات والكويزات؟",
    answer: "يقوم فريق الإدارة بإضافة مواعيد الامتحانات والكويزات كإشعارات تلقائياً. ستصلك تذكيرات قبل الموعد بـ 24 ساعة وقبل الموعد بساعة واحدة، حتى لو كنت غير متصل بالإنترنت. ستجد جميع الإشعارات في أيقونة الجرس في لوحة التحكم."
  },
  {
    question: "هل يمكنني تحميل المواد الدراسية؟",
    answer: "نعم، يمكنك تحميل المحاضرات والملفات المتاحة لكل مادة مباشرة من صفحة المادة. كل مادة تحتوي على قائمة بجميع المحاضرات والملفات المرفوعة."
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
