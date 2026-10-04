import { Link } from "react-router-dom";
import Footer from "../layouts/Footer";
import { SITE_OVERVIEW } from "@/shared/lib/siteMetadata";

export default function About() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <main className="section-container max-w-3xl py-10 sm:py-16">
        <header className="space-y-5">
          <img
            src="/brand/icon-192.png"
            alt="شعار CYBER TMSAH"
            width="72"
            height="72"
            className="rounded-2xl"
          />
          <h1 className="text-2xl font-black leading-relaxed sm:text-3xl">
            {SITE_OVERVIEW.heading}
          </h1>
          <p className="text-base leading-8 text-muted-foreground">{SITE_OVERVIEW.introduction}</p>
          <p className="text-base leading-8 text-muted-foreground">{SITE_OVERVIEW.audience}</p>
        </header>
        <div className="mt-8 grid gap-4">
          {SITE_OVERVIEW.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-border bg-card p-5 sm:p-6"
            >
              <h2 className="text-lg font-bold">{section.title}</h2>
              <p className="mt-3 leading-8 text-muted-foreground">{section.description}</p>
            </section>
          ))}
        </div>
        <section className="mt-8">
          <h2 className="text-lg font-bold">كيفية الانضمام</h2>
          <p className="mt-3 leading-8 text-muted-foreground">{SITE_OVERVIEW.access}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/join"
              className="rounded-xl bg-primary-solid px-5 py-3 font-bold text-primary-foreground"
            >
              طلب الانضمام
            </Link>
            <Link to="/login" className="rounded-xl border border-border px-5 py-3 font-bold">
              تسجيل الدخول
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
