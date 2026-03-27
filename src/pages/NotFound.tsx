import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";

/**
 * 404 Not Found Page Component
 * Displayed when user navigates to a non-existent route
 */
const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "page_not_found", {
        page_path: location.pathname,
      });
    }
  }, [location.pathname]);

  return (
    <>
      <SEO 
        title="404 - الصفحة غير موجودة"
        description="عذراً، الصفحة المطلوبة غير موجودة. الرجاء التحقق من الرابط أو العودة للصفحة الرئيسية."
      />
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          {/* Error Icon */}
          <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
          </div>

          {/* Error Code */}
          <h1 className="text-6xl md:text-8xl font-black text-foreground mb-4">
            404
          </h1>

          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground mb-3">
            الصفحة غير موجودة
          </h2>

          {/* Description */}
          <p className="text-muted-foreground mb-8">
            عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
            <br />
            الرجاء التحقق من الرابط أو العودة للصفحة الرئيسية.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90 hover:scale-105"
            >
              <Home className="w-4 h-4" />
              العودة للرئيسية
            </Link>
            
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-card text-foreground font-medium transition-all hover:bg-card/80"
            >
              <ArrowLeft className="w-4 h-4" />
              رجوع
            </button>
          </div>

          {/* Current Path */}
          <p className="mt-8 text-sm text-muted-foreground">
            المسار: <code className="bg-muted px-2 py-1 rounded text-xs">{location.pathname}</code>
          </p>
        </div>
      </div>
    </>
  );
};

export default NotFound;
