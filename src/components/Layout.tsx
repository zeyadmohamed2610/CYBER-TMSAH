import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Breadcrumbs from "./Breadcrumbs";
import FloatingBlogButton from "./FloatingBlogButton";
import ReadingProgress from "./ReadingProgress";

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
  </div>
);

export default Layout;
