import { type ReactNode } from "react";
import ReadingProgress from "../../shared/components/ReadingProgress";
import Footer from "./Footer";
import Navbar from "./Navbar";

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col font-cairo bg-[#060813] text-[#F1F5F9] relative overflow-x-hidden selection:bg-purple-600/30 selection:text-white">
    <div aria-hidden="true" className="app-ambient fixed inset-0 pointer-events-none" />

    <ReadingProgress />
    <Navbar />
    <main id="main-content" className="flex-1 relative z-10" role="main" tabIndex={-1}>
      {children}
    </main>
    <Footer />
  </div>
);

export default Layout;
