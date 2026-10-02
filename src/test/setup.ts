import { afterEach } from "vitest";

afterEach(() => {
  // Keep the shared JSDOM environment clean between tests.
  if (typeof document !== "undefined") document.body.innerHTML = "";
});
