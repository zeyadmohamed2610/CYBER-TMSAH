import { Button } from "@/shared/components/ui/button";
import { Crop, Move, RotateCcw, RotateCw, Sparkles, X, ZoomIn, ZoomOut } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface CircularImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedDataUrl: string) => void;
  onCancel: () => void;
  targetSize?: number;
}

export const CircularImageCropper: React.FC<CircularImageCropperProps> = ({
  imageSrc,
  onCropComplete,
  onCancel,
  targetSize = 512,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState(300);
  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const touchDistanceRef = useRef<number | null>(null);

  // Measure container size dynamically
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const minDim = Math.min(rect.width || 300, 340);
        setContainerSize(Math.max(260, minDim));
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Load natural dimensions of the image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNaturalDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      // Reset transforms when new image source loads
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Circle diameter inside viewport
  const circleDiameter = containerSize * 0.88;
  const circleRadius = circleDiameter / 2;

  // Calculate base scale to ensure image covers circle diameter at zoom = 1
  const effectiveDimensions = naturalDimensions
    ? rotation % 180 === 0
      ? { w: naturalDimensions.width, h: naturalDimensions.height }
      : { w: naturalDimensions.height, h: naturalDimensions.width }
    : { w: 1, h: 1 };

  const baseScale = naturalDimensions
    ? Math.max(circleDiameter / effectiveDimensions.w, circleDiameter / effectiveDimensions.h)
    : 1;

  const currentScale = baseScale * zoom;

  // Max pan limits so image doesn't expose empty transparent background inside the circle
  const maxPanX = Math.max(0, (effectiveDimensions.w * currentScale - circleDiameter) / 2);
  const maxPanY = Math.max(0, (effectiveDimensions.h * currentScale - circleDiameter) / 2);

  const clampPan = useCallback(
    (x: number, y: number) => {
      // Soft elasticity or clamping
      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, x)),
        y: Math.max(-maxPanY, Math.min(maxPanY, y)),
      };
    },
    [maxPanX, maxPanY],
  );

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan(clampPan(panStartRef.current.x + dx, panStartRef.current.y + dy));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch pan & pinch zoom handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const first = e.touches[0];
    const second = e.touches[1];
    if (e.touches.length === 1 && first) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: first.clientX,
        y: first.clientY,
      };
      panStartRef.current = { ...pan };
      touchDistanceRef.current = null;
    } else if (e.touches.length === 2 && first && second) {
      // Pinch to zoom
      isDraggingRef.current = false;
      const dx = first.clientX - second.clientX;
      const dy = first.clientY - second.clientY;
      touchDistanceRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const first = e.touches[0];
    const second = e.touches[1];
    if (e.touches.length === 1 && first && isDraggingRef.current) {
      const dx = first.clientX - dragStartRef.current.x;
      const dy = first.clientY - dragStartRef.current.y;
      setPan(clampPan(panStartRef.current.x + dx, panStartRef.current.y + dy));
    } else if (
      e.touches.length === 2 &&
      first &&
      second &&
      touchDistanceRef.current !== null &&
      touchDistanceRef.current > 0
    ) {
      const dx = first.clientX - second.clientX;
      const dy = first.clientY - second.clientY;
      const distance = Math.hypot(dx, dy);
      const ratio = distance / touchDistanceRef.current;
      setZoom((prev) => Math.max(1, Math.min(3.5, prev * ratio)));
      touchDistanceRef.current = distance;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchDistanceRef.current = null;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.max(1, Math.min(3.5, prev + delta)));
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    setPan({ x: 0, y: 0 });
  };

  // Reset transforms
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  // Execute Canvas Crop
  const handleApplyCrop = () => {
    if (!naturalDimensions) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Ratio from viewport circle diameter to target export size
      const scaleRatio = targetSize / circleDiameter;

      // 1. Move to canvas center
      ctx.translate(targetSize / 2, targetSize / 2);

      // 2. Shift by user pan scaled to export canvas
      ctx.translate(pan.x * scaleRatio, pan.y * scaleRatio);

      // 3. Rotate by angle
      ctx.rotate((rotation * Math.PI) / 180);

      // 4. Scale by exact scale factor
      const finalScale = currentScale * scaleRatio;
      ctx.scale(finalScale, finalScale);

      // 5. Draw image centered
      ctx.drawImage(
        img,
        -naturalDimensions.width / 2,
        -naturalDimensions.height / 2,
        naturalDimensions.width,
        naturalDimensions.height,
      );

      // Export as WebP or JPEG
      try {
        const webpData = canvas.toDataURL("image/webp", 0.92);
        if (webpData.startsWith("data:image/webp")) {
          onCropComplete(webpData);
          return;
        }
      } catch {
        // fallback
      }

      onCropComplete(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.src = imageSrc;
  };

  return (
    <div className="w-full flex flex-col items-center select-none" dir="rtl">
      {/* Header Info */}
      <div className="w-full text-center pb-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold mb-1 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>المحرر الذكي: قص وضبط الفريم الدائري</span>
        </div>
        <p className="text-xs text-slate-300">
          اسحب الصورة لتوسيط الوجه داخل الدائرة، واستخدم شريط التكبير أو التدوير
        </p>
      </div>

      {/* Interactive Crop Viewport Area */}
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden bg-black/90 shadow-[0_10px_35px_rgba(0,0,0,0.8)] border border-purple-500/30 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
        style={{
          width: `${containerSize}px`,
          height: `${containerSize}px`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* The Transformed Image */}
        {naturalDimensions && (
          <img
            src={imageSrc}
            alt="Source for crop"
            draggable={false}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: `${naturalDimensions.width}px`,
              height: `${naturalDimensions.height}px`,
              maxWidth: "none",
              maxHeight: "none",
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${currentScale})`,
              transformOrigin: "center center",
              userSelect: "none",
              pointerEvents: "none",
              transition: isDraggingRef.current ? "none" : "transform 0.05s ease-out",
            }}
          />
        )}

        {/* Circular Mask Overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        >
          <defs>
            <mask id="circular-mask-cutout">
              {/* White background: fully visible mask */}
              <rect width="100%" height="100%" fill="white" />
              {/* Black circle: cut out (transparent window to see the image clearly) */}
              <circle cx="50%" cy="50%" r={circleRadius} fill="black" />
            </mask>
          </defs>

          {/* Dimmed surrounding outside the circular frame */}
          <rect
            width="100%"
            height="100%"
            fill="rgba(5, 7, 18, 0.78)"
            mask="url(#circular-mask-cutout)"
          />

          {/* Center alignment guides (subtle crosshair) */}
          <line
            x1="50%"
            y1={containerSize / 2 - circleRadius + 10}
            x2="50%"
            y2={containerSize / 2 + circleRadius - 10}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <line
            x1={containerSize / 2 - circleRadius + 10}
            y1="50%"
            x2={containerSize / 2 + circleRadius - 10}
            y2="50%"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Glowing Circular Border indicating the exact avatar frame */}
          <circle
            cx="50%"
            cy="50%"
            r={circleRadius}
            fill="none"
            stroke="url(#circle-gradient)"
            strokeWidth="2.5"
            className="filter drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]"
          />

          <defs>
            <linearGradient id="circle-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="50%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
          </defs>
        </svg>

        {/* Small floating hint on top */}
        <div className="absolute top-2.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-white/90 flex items-center gap-1 pointer-events-none shadow">
          <Move className="w-2.5 h-2.5 text-cyan-400" />
          <span>اسحب للتحريك</span>
        </div>
      </div>

      {/* Editor Controls (Zoom, Rotate, Reset) */}
      <div className="w-full max-w-sm mt-4 space-y-3 px-1">
        {/* Zoom Slider */}
        <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z - 0.15))}
            className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="تصغير"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min="1"
            max="3.5"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3.5, z + 0.15))}
            className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="تكبير"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-mono font-bold text-purple-300 min-w-10 text-center shrink-0">
            {zoom.toFixed(1)}x
          </span>
        </div>

        {/* Action Tool Buttons (Rotate 90°, Reset) */}
        <div className="flex items-center justify-center gap-2 pt-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRotate}
            className="h-8 px-3 rounded-xl bg-white/5 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 text-xs font-semibold gap-1.5 border border-white/5 hover:border-purple-500/30"
          >
            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>تدوير 90°</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold gap-1.5 border border-white/5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط</span>
          </Button>
        </div>
      </div>

      {/* Confirm & Cancel Buttons */}
      <div className="w-full flex items-center justify-between gap-3 pt-5 mt-2 border-t border-white/10">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="text-slate-400 hover:text-white rounded-xl text-xs h-10 px-4"
        >
          <X className="w-4 h-4 ml-1.5" />
          <span>إلغاء / تغيير الصورة</span>
        </Button>

        <Button
          type="button"
          onClick={handleApplyCrop}
          className="bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold rounded-xl text-xs h-10 px-6 gap-2 shadow-[0_4px_20px_rgba(124,58,237,0.4)] transition-all hover:scale-[1.02]"
        >
          <Crop className="w-4 h-4" />
          <span>تطبيق القص واعتماد الفريم</span>
        </Button>
      </div>
    </div>
  );
};

export default CircularImageCropper;
