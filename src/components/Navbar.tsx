import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, BookOpen, Calendar, ShieldCheck, Home } from "lucide-react";
import { NavLink } from "@/components/NavLink";

type NavItem = { label: string; path: string; icon: React.ElementType };

const navLinks: NavItem[] = [
  { label: "الجدول الدراسي", path: "/schedule",  icon: Calendar },
  { label: "المواد الدراسية", path: "/materials", icon: BookOpen },
  { label: "الحضور",          path: "/attendance", icon: ShieldCheck },
];

// Mobile menu includes Home
const mobileNavLinks: NavItem[] = [
  { label: "الرئيسية",        path: "/",          icon: Home },
  ...navLinks,
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  // Prevent body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-[60] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg"
      >
        تخطي إلى المحتوى
      </a>

      <nav
        ref={menuRef}
        className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl"
        role="navigation"
        aria-label="التنقل الرئيسي"
      >
        <div className="section-container flex items-center justify-between py-3.5">
          {/* Logo */}
          <Link to="/" className="group relative flex items-center" dir="ltr">
            <span className="relative text-2xl md:text-3xl font-black tracking-widest">
              <span
                className="bg-gradient-to-r from-cyan-400 via-primary to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_10px_hsl(var(--primary)/0.8)]"
                style={{
                  textShadow:
                    "0 0 20px hsl(174 72% 50% / 0.6), 0 0 40px hsl(174 72% 50% / 0.4), 0 0 60px hsl(174 72% 50% / 0.2)",
                }}
              >
                CYBER
              </span>
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-400 via-primary to-cyan-400 shadow-[0_0_10px_hsl(var(--primary))]" />
            </span>

            <span className="text-primary text-3xl md:text-4xl font-thin mx-2 animate-pulse">⟡</span>

            <span className="relative text-2xl md:text-3xl font-black tracking-widest">
              <span className="text-foreground group-hover:text-primary transition-all duration-500 ease-out group-hover:drop-shadow-[0_0_15px_hsl(var(--primary)/0.8)]">
                TMSAH
              </span>
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary via-cyan-400 to-primary group-hover:w-full transition-all duration-700 ease-out shadow-[0_0_10px_hsl(var(--primary))]" />
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className="group relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 overflow-hidden text-muted-foreground hover:text-primary hover:bg-primary/10"
                  activeClassName="text-primary-foreground bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                >
                  {!isActive && (
                    <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                  {isActive && <span className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-100" />}
                  <span className="relative z-10">{link.label}</span>
                  {!isActive && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary rounded-full group-hover:w-2/3 transition-all duration-300" />
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center text-foreground p-2.5 rounded-xl hover:bg-primary/10 transition-colors min-h-[44px] min-w-[44px]"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open
              ? <X className="h-6 w-6 transition-all duration-200" />
              : <Menu className="h-6 w-6 transition-all duration-200" />}
          </button>
        </div>

        {/* Mobile menu — animates via max-height */}
        <div
          id="mobile-menu"
          role="menu"
          className={`md:hidden border-t border-border bg-background/95 backdrop-blur-xl overflow-hidden transition-all duration-300 ease-in-out ${
            open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="section-container flex flex-col gap-1 py-4">
            {mobileNavLinks.map((link) => {
              const isHome = link.path === "/";
              const isActive = isHome
                ? location.pathname === "/"
                : location.pathname.startsWith(link.path);
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-base font-semibold transition-all duration-200 min-h-[48px] ${
                    isActive
                      ? "text-primary bg-primary/10 border border-primary/30"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                  }`}
                  activeClassName=""
                >
                  {/* RTL: text on right, icon on left — but flex row-reverse keeps icon on right in RTL */}
                  <span className="flex items-center gap-3">
                    <link.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/60"}`} />
                    <span>{link.label}</span>
                  </span>
                  {isActive && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Backdrop for mobile menu */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default Navbar;
