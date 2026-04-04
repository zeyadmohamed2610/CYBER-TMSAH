export const transitionStyles = {
  fade: "page-enter",
  "slide-right": "page-slide-right",
  "slide-left": "page-slide-left",
  scale: "page-scale",
} as const;

export type TransitionType = keyof typeof transitionStyles;