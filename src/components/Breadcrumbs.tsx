import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  path: string;
}

/**
 * Breadcrumbs Component for SEO and Navigation
 * Helps users and search engines understand site structure
 */
export const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "الرئيسية", path: "/" },
    ...pathnames.map((pathname, index) => {
      const path = `/${pathnames.slice(0, index + 1).join("/")}`;
      const labels: { [key: string]: string } = {
        "materials": "المواد الدراسية",
        "schedule": "الجدول الدراسي",
        "negotiation": "التفاوض والحل الإبداعي",
        "cybersecurity": "أساسيات الأمن السيبراني",
        "english": "اللغة الإنجليزية",
        "networking": "الشبكات",
        "engineering-drawing": "الرسم الهندسي",
        "technology": "تكنولوجيا المعلومات",
        "os": "أنظمة التشغيل"
      };
      return { label: labels[pathname] || pathname, path };
    })
  ];

  if (pathnames.length === 0) return null;

  return (
    <nav 
      aria-label="Breadcrumb" 
      className="py-4 px-4 md:px-8"
      vocab="https://schema.org/"
      typeof="BreadcrumbList"
    >
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {breadcrumbItems.map((item, index) => (
          <li 
            key={item.path}
            property="itemListElement" 
            typeof="ListItem"
            className="flex items-center"
          >
            {index > 0 && (
              <ChevronLeft className="w-4 h-4 mx-2 text-muted-foreground" />
            )}
            
            {index === breadcrumbItems.length - 1 ? (
              <span 
                property="name"
                className="text-foreground font-medium"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                property="item"
                typeof="WebPage"
                className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                {index === 0 && <Home className="w-4 h-4" />}
                <span property="name">{item.label}</span>
              </Link>
            )}
            
            <meta property="position" content={(index + 1).toString()} />
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
