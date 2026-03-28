import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "ما هي منصة CYBER TMSAH؟",
    answer: "CYBER TMSAH (سايبر تمساح) هي منصة أكاديمية متكاملة لطلاب الأمن السيبراني في جامعة حلوان التكنولوجية الدولية، توفر مواد دراسية، جداول محاضرات، ومراجعات شاملة في مكان واحد."
  },
  {
    question: "هل المنصة مجانية؟",
    answer: "نعم، منصة CYBER TMSAH مجانية بالكامل لجميع طلاب الأمن السيبراني في جامعة حلوان التكنولوجية الدولية. الهدف هو تسهيل الوصول للمواد الدراسية والمراجعات."
  },
  {
    question: "ما هي المواد المتاحة على المنصة؟",
    answer: "المنصة توفر مواد: مبادئ الأمن السيبراني، اللغة الإنجليزية، مبادئ التكنولوجيا، الرسم الهندسي والإسقاط، شبكات وتراسل البيانات، نظم التشغيل، ومهارات التفاوض."
  },
  {
    question: "كيف يمكنني الوصول للجدول الدراسي؟",
    answer: "يمكنك الوصول للجدول الدراسي من خلال صفحة 'الجدول الدراسي' في القائمة الرئيسية. الجدول يعرض جميع المحاضرات الأسبوعية مع التفاصيل الكاملة لكل محاضرة."
  },
  {
    question: "هل يمكنني تحميل المواد الدراسية؟",
    answer: "نعم، يمكنك تحميل المحاضرات والملفات المتاحة لكل مادة. كل مادة لها صفحة خاصة تحتوي على جميع المواد المتاحة للتحميل."
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
