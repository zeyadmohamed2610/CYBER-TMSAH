export const ROTATING_WINDOW_SECONDS = 10;

export const getTimeWindow = (date: Date = new Date()): number => {
  return Math.floor(date.getTime() / 1000 / ROTATING_WINDOW_SECONDS);
};

export const getSecondsUntilNextWindow = (date: Date = new Date()): number => {
  const seconds = Math.floor(date.getTime() / 1000);
  const elapsedInWindow = seconds % ROTATING_WINDOW_SECONDS;
  return ROTATING_WINDOW_SECONDS - elapsedInWindow;
};

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export const generateTOTPCode = async (secret: string | null | undefined, date: Date = new Date()): Promise<string> => {
  if (!secret) return "000000";
  const window = getTimeWindow(date);
  const input = secret + window.toString();

  let hex: string;
  try {
    if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      hex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 8);
    } else {
      hex = simpleHash(input).toString(16).padStart(8, "0").substring(0, 8);
    }
  } catch {
    hex = simpleHash(input).toString(16).padStart(8, "0").substring(0, 8);
  }

  const num = Number("0x" + hex);
  return (num % 1000000).toString().padStart(6, "0");
};

export const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};
