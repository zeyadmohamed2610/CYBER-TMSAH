import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import ReadingProgress from "./ReadingProgress";

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen flex flex-col font-cairo bg-[#060813] text-[#F1F5F9] relative overflow-x-hidden selection:bg-purple-600/30 selection:text-white">
    {/* ── Background: layered cyber gradients & grid matching login page ── */}
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {/* Deep purple glow — top */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "10%",
          width: "70vw",
          height: "70vh",
          background: "radial-gradient(ellipse at center, rgba(147,51,234,0.12) 0%, transparent 65%)",
          filter: "blur(50px)",
        }}
      />
      {/* Deep blue/indigo glow — bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          right: "5%",
          width: "55vw",
          height: "55vh",
          background: "radial-gradient(ellipse at center, rgba(79,70,229,0.09) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />
      {/* Cyber Noise texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />
      {/* Subtle futuristic grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 1,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 85% 85% at 50% 50%, black 30%, transparent 100%)",
        }}
      />
    </div>

    <ReadingProgress />
    <Navbar />
    <main id="main-content" className="flex-1 relative z-10" role="main" tabIndex={-1}>
      {children}
    </main>
    <Footer />
  </div>
);

export default Layout;
