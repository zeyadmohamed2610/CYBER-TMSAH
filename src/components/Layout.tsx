import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import ReadingProgress from "./ReadingProgress";

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col font-cairo">
    <ReadingProgress />
    <Navbar />
    <main id="main-content" className="flex-1" role="main" tabIndex={-1}>
      {children}
    </main>
    <Footer />
  </div>
);

export default Layout;
