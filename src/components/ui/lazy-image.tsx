import { cn } from "@/lib/utils";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  placeholder?: React.ReactNode;
  aspectRatio?: "square" | "video" | "portrait";
}

export const LazyImage = ({ 
  src, 
  alt, 
  className, 
  placeholder,
  aspectRatio = "square",
  ...props 
}: LazyImageProps) => {
  const aspectClasses = {
    square: "aspect-square",
    video: "aspect-video",
    portrait: "aspect-[3/4]",
  };

  return (
    <div className={cn("relative overflow-hidden bg-muted", aspectClasses[aspectRatio], className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-opacity duration-300"
        onLoad={(e) => {
          e.currentTarget.classList.add("opacity-100");
        }}
        {...props}
      />
      {!placeholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      {placeholder && (
        <div className="absolute inset-0 opacity-0 transition-opacity duration-300 data-[loaded=true]:opacity-100">
          {placeholder}
        </div>
      )}
    </div>
  );
};

export const OptimizedImage = ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
  <img 
    src={src} 
    alt={alt} 
    loading="lazy" 
    decoding="async"
    {...props} 
  />
);