import { useEffect, useRef, useState } from 'react';

export function GlobalCursorGlow() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pointer = matchMedia('(pointer: fine) and (hover: hover)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame: number | null = null;
    const target = { x: -600, y: -600 };
    const position = { ...target };
    const allowed = () => pointer.matches && !reduced.matches && !document.hidden;
    const stop = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; };
    const render = () => {
      frame = null;
      if (!allowed()) return;
      position.x += (target.x - position.x) * 0.15;
      position.y += (target.y - position.y) * 0.15;
      if (glowRef.current) glowRef.current.style.transform = 'translate3d(' + position.x + 'px,' + position.y + 'px,0) translate(-50%,-50%)';
      if (Math.abs(target.x - position.x) + Math.abs(target.y - position.y) > 0.5) frame = requestAnimationFrame(render);
    };
    const start = () => { if (allowed() && frame === null) frame = requestAnimationFrame(render); };
    const update = () => { setEnabled(pointer.matches && !reduced.matches); if (!allowed()) stop(); else start(); };
    const move = (event: PointerEvent) => {
      if (!allowed()) return;
      target.x = event.clientX; target.y = event.clientY;
      document.documentElement.style.setProperty('--cursor-x', event.clientX + 'px');
      document.documentElement.style.setProperty('--cursor-y', event.clientY + 'px');
      setHovering(Boolean((event.target as Element | null)?.closest('button,a,input,select,textarea,[role="button"],[role="tab"]')));
      start();
    };
    const leave = () => { target.x = -600; target.y = -600; setHovering(false); start(); };
    update();
    pointer.addEventListener('change', update); reduced.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('mouseleave', leave);
    return () => { stop(); pointer.removeEventListener('change', update); reduced.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); window.removeEventListener('pointermove', move); document.removeEventListener('mouseleave', leave); };
  }, []);
  if (!enabled) return null;
  return <div className="fixed inset-0 pointer-events-none overflow-hidden z-[9999]" aria-hidden="true"><div ref={glowRef} className="absolute top-0 left-0 rounded-full" style={{width:hovering?420:340,height:hovering?420:340,background:'radial-gradient(circle,rgba(99,102,241,0.08),transparent 75%)',filter:'blur(64px)',opacity:hovering?0.85:0.65}} /></div>;
}
