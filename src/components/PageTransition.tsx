/* eslint-disable react-refresh/only-export-components */
import { useLocation, useOutlet } from "react-router-dom";
import { useState, useEffect, useCallback, memo } from "react";
import { transitionStyles, type TransitionType } from "./PageTransitionStyles";

interface PageTransitionProps {
  children: React.ReactNode;
  type?: TransitionType;
}

const PageTransitionComponent = memo(function PageTransition({ children, type = "fade" }: PageTransitionProps) {
  return (
    <div className={transitionStyles[type]} key={type}>
      {children}
    </div>
  );
});

export const PageTransition = PageTransitionComponent;

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

  const getTransitionType = useCallback(() => transitionType, [transitionType]);

  return { displayLocation, transitionType: getTransitionType() };
};

export const AnimatedOutlet = memo(function AnimatedOutlet() {
  const outlet = useOutlet();
  const { transitionType } = usePageTransition();

  if (!outlet) return null;

  return (
    <div className={transitionStyles[transitionType]} key={transitionType}>
      {outlet}
    </div>
  );
});