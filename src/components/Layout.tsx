import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Breadcrumbs from "./Breadcrumbs";
import FloatingBlogButton from "./FloatingBlogButton";
import BackToTop from "./BackToTop";
import ReadingProgress from "./ReadingProgress";

/**
 * Layout Component
 * Wraps all pages with consistent layout including navbar, footer, and floating button
 * Includes skip-to-content accessibility feature, reading progress, and back to top
 */
const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col font-cairo">
    <ReadingProgress />
    <Navbar />
    <Breadcrumbs />
    <main id="main-content" className="flex-1" role="main" tabIndex={-1}>
      {children}
    </main>
    <Footer />
    <FloatingBlogButton />
    <BackToTop />
  </div>
);

export default Layout;
