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
      // 0.10 lerp factor gives a buttery-smooth, relaxed ambient float
      glowPos.current.x = lerp(glowPos.current.x, mousePos.current.x, 0.1);
      glowPos.current.y = lerp(glowPos.current.y, mousePos.current.y, 0.1);

      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${glowPos.current.x}px, ${glowPos.current.y}px, 0) translate(-50%, -50%)`;
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
      {/* ── Soft Luxury Ambient Glow (Ultra-diffused, gentle, non-distracting) ── */}
      <div
        ref={glowRef}
        className="absolute top-0 left-0 rounded-full transition-[width,height,opacity] duration-500 ease-out will-change-transform"
        style={{
          width: hovering ? 420 : 340,
          height: hovering ? 420 : 340,
          background: hovering
            ? "radial-gradient(circle, rgba(129, 140, 248, 0.12) 0%, rgba(99, 102, 241, 0.06) 45%, rgba(79, 70, 229, 0.015) 70%, transparent 85%)"
            : "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(79, 70, 229, 0.035) 45%, transparent 75%)",
          filter: "blur(64px)",
          opacity: hovering ? 0.85 : 0.65,
        }}
      />
    </div>
  );
}
