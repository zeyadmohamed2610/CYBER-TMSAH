import { useState, useEffect, useRef } from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  placeholder?: string;
}

/**
 * Optimized Image Component
 * Features:
 * - Lazy loading with Intersection Observer
 * - WebP support with fallback
 * - Blur placeholder effect
 * - Priority loading option
 */
export const OptimizedImage = ({
  src,
  alt,
  className = "",
  width,
  height,
  priority = false,
  placeholder = "#1a1a2e",
}: OptimizedImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "50px",
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  // Check if browser supports WebP
  const [supportsWebP, setSupportsWebP] = useState(false);

  useEffect(() => {
    const checkWebP = async () => {
      try {
        const webpData =
          "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
        const img = new Image();
        img.onload = () => setSupportsWebP(true);
        img.onerror = () => setSupportsWebP(false);
        img.src = webpData;
      } catch {
        setSupportsWebP(false);
      }
    };
    checkWebP();
  }, []);

  // Generate WebP src
  const getWebPSrc = (originalSrc: string) => {
    if (!supportsWebP) return originalSrc;
    const webpSrc = originalSrc.replace(/\.(jpg|jpeg|png)$/i, ".webp");
    return webpSrc;
  };

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: placeholder }}
    >
      {/* Blur placeholder */}
      {!isLoaded && (
        <div
          className="absolute inset-0 bg-muted animate-pulse"
          style={{
            filter: "blur(20px)",
            transform: "scale(1.1)",
          }}
        />
      )}

      {isInView && (
        <picture>
          {supportsWebP && (
            <source srcSet={getWebPSrc(src)} type="image/webp" />
          )}
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
            onLoad={() => setIsLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </picture>
      )}
    </div>
  );
};

export default OptimizedImage;
