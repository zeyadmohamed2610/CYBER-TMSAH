// @vitest-environment node
import { createRequire } from "node:module";
import { expect, it } from "vitest";
const require = createRequire(import.meta.url);
const braces = require(require.resolve("braces", { paths: [require.resolve("tailwindcss")] }));
it("rejects deeply nested brace and parenthesis patterns before recursive consumers overflow", () => {
  for (const [open, close] of [
    ["{", "}"],
    ["(", ")"],
  ]) {
    const malicious = open!.repeat(4000) + "a,b" + close!.repeat(4000);
    for (const operation of [braces.parse, braces.compile, braces.expand])
      expect(() => operation(malicious)).toThrow("Pattern nesting exceeds 128 levels");
  }
});
it("preserves normal build pattern expansion", () => {
  expect(braces.expand("src/{components,pages}/**/*.{ts,tsx}")).toEqual([
    "src/components/**/*.ts",
    "src/components/**/*.tsx",
    "src/pages/**/*.ts",
    "src/pages/**/*.tsx",
  ]);
});
