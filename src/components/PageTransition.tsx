import { useLocation, useOutlet } from "react-router-dom";
import { useState, useEffect } from "react";

type TransitionType = "fade" | "slide-right" | "slide-left" | "scale";

interface PageTransitionProps {
  children: React.ReactNode;
  type?: TransitionType;
}

const transitionStyles: Record<TransitionType, string> = {
  fade: "page-enter",
  "slide-right": "page-slide-right",
  "slide-left": "page-slide-left",
  scale: "page-scale",
};

export const PageTransition = ({ children, type = "fade" }: PageTransitionProps) => {
  return (
    <div className={transitionStyles[type]} key={type}>
      {children}
    </div>
  );
};

export const usePageTransition = () => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionType, setTransitionType] = useState<TransitionType>("fade");

  useEffect(() => {
    if (location !== displayLocation) {
      const currentIndex = location.pathname.split("/").length;
      const prevIndex = displayLocation.pathname.split("/").length;
      
      if (currentIndex > prevIndex) {
        setTransitionType("slide-right");
      } else if (currentIndex < prevIndex) {
        setTransitionType("slide-left");
      } else {
        setTransitionType("fade");
      }
      setDisplayLocation(location);
    }
  }, [location, displayLocation]);

  return { displayLocation, transitionType };
};

export const AnimatedOutlet = () => {
  const outlet = useOutlet();
  const { transitionType } = usePageTransition();

  if (!outlet) return null;

  return (
    <div className={transitionStyles[transitionType]} key={transitionType}>
      {outlet}
    </div>
  );
};