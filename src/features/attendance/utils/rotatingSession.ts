const ROTATING_WINDOW_SECONDS = 30;

export const getTimeWindow = (date: Date = new Date()): number => {
  return Math.floor(date.getTime() / 1000 / ROTATING_WINDOW_SECONDS);
};

export const getSecondsUntilNextWindow = (date: Date = new Date()): number => {
  const seconds = Math.floor(date.getTime() / 1000);
  const elapsedInWindow = seconds % ROTATING_WINDOW_SECONDS;
  return ROTATING_WINDOW_SECONDS - elapsedInWindow;
};

// M6: generateVisualRotatingHash removed — it was dead code disconnected from the
// actual DB hash (gen_random_bytes(32)). Nothing in the codebase called it.

export const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};
