// src/components/GlobalCursorGlow.tsx
import { useEffect, useRef, useState } from "react";

/**
 * GlobalCursorGlow
 * High-performance, silky-smooth dynamic cursor glow and element raycast engine.
 * Projects a luxury ambient light across the entire application and magnetically
 * reacts whenever hovering over any button, input, link, or interactive card.
 */
export function GlobalCursorGlow() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Position references for 60fps / 120fps lerp animation
  const mousePos = useRef({ x: -500, y: -500 });
  const glowPos = useRef({ x: -500, y: -500 });
  const glowRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    // Only enable on desktop / fine-pointer devices with hover capability
    const isFinePointer = window.matchMedia("(pointer: fine) and (hover: hover)").matches;
    if (!isFinePointer) return;

    setEnabled(true);

    const handlePointerMove = (e: PointerEvent) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;

      // Update global CSS variables for element raycasting
      document.documentElement.style.setProperty("--cursor-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${e.clientY}px`);

      // Detect if hovering over any interactive element anywhere in the DOM
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInteractive = Boolean(
          target.closest(
            "button, a, input, select, textarea, [role='button'], [role='tab'], label, .cursor-pointer"
          )
        );
        setHovering(isInteractive);
      }
    };

    const handlePointerLeave = () => {
      mousePos.current.x = -600;
      mousePos.current.y = -600;
      setHovering(false);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("mouseleave", handlePointerLeave, { passive: true });

    // Smooth Lerp loop for silky organic inertia
    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

    const render = () => {
      // 0.16 lerp factor gives a buttery-smooth fluid follower
      glowPos.current.x = lerp(glowPos.current.x, mousePos.current.x, 0.16);
      glowPos.current.y = lerp(glowPos.current.y, mousePos.current.y, 0.16);

      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${glowPos.current.x}px, ${glowPos.current.y}px, 0) translate(-50%, -50%)`;
      }
      if (coreRef.current) {
        // Direct snappy follower for the core nucleus
        coreRef.current.style.transform = `translate3d(${mousePos.current.x}px, ${mousePos.current.y}px, 0) translate(-50%, -50%)`;
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handlePointerLeave);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden z-[9999]"
      aria-hidden="true"
    >
      {/* ── Wide Ambient Spotlight (Follows with gentle fluid inertia) ── */}
      <div
        ref={glowRef}
        className="absolute top-0 left-0 rounded-full transition-[width,height,opacity] duration-300 ease-out will-change-transform"
        style={{
          width: hovering ? 480 : 380,
          height: hovering ? 480 : 380,
          background: hovering
            ? "radial-gradient(circle, rgba(129, 140, 248, 0.22) 0%, rgba(99, 102, 241, 0.12) 35%, rgba(79, 70, 229, 0.04) 65%, transparent 80%)"
            : "radial-gradient(circle, rgba(99, 102, 241, 0.16) 0%, rgba(79, 70, 229, 0.08) 40%, transparent 75%)",
          filter: "blur(32px)",
          opacity: 0.95,
        }}
      />

      {/* ── Snappy Interactive Core Nucleus (Locks directly to cursor tip) ── */}
      <div
        ref={coreRef}
        className="absolute top-0 left-0 rounded-full transition-all duration-200 ease-out will-change-transform"
        style={{
          width: hovering ? 52 : 24,
          height: hovering ? 52 : 24,
          background: hovering
            ? "radial-gradient(circle, rgba(199, 210, 254, 0.45) 0%, rgba(129, 140, 248, 0.25) 50%, transparent 80%)"
            : "radial-gradient(circle, rgba(165, 180, 252, 0.35) 0%, rgba(99, 102, 241, 0.15) 60%, transparent 90%)",
          boxShadow: hovering
            ? "0 0 24px rgba(129, 140, 248, 0.5), inset 0 0 12px rgba(255, 255, 255, 0.3)"
            : "0 0 12px rgba(99, 102, 241, 0.3)",
          filter: "blur(4px)",
          border: hovering ? "1px solid rgba(199, 210, 254, 0.4)" : "none",
        }}
      />
    </div>
  );
}
