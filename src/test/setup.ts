import { afterEach } from "vitest";

afterEach(() => {
  // Keep the shared JSDOM environment clean between tests.
  document.body.innerHTML = "";
});
