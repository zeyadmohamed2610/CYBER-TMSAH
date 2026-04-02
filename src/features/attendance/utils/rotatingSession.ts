import { sha256Hash } from "./fingerprint";

export const ROTATING_WINDOW_SECONDS = 10;

export const getTimeWindow = (date: Date = new Date()): number => {
  return Math.floor(date.getTime() / 1000 / ROTATING_WINDOW_SECONDS);
};

export const getSecondsUntilNextWindow = (date: Date = new Date()): number => {
  const seconds = Math.floor(date.getTime() / 1000);
  const elapsedInWindow = seconds % ROTATING_WINDOW_SECONDS;
  return ROTATING_WINDOW_SECONDS - elapsedInWindow;
};

export const generateTOTPCode = async (secret: string | null | undefined, date: Date = new Date()): Promise<string> => {
  if (!secret) return "000000";
  const window = getTimeWindow(date);
  const input = secret + window.toString();

  const fullHash = await sha256Hash(input);
  const hex = fullHash.substring(0, 8);

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
