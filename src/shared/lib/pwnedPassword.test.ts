// @vitest-environment node
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { checkPwnedPassword } from "./pwnedPassword";

afterEach(() => vi.unstubAllGlobals());

it("permits the password range API under the deployed CSP", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  const policy = config.headers
    .flatMap((entry: { headers: { key: string; value: string }[] }) => entry.headers)
    .find((header: { key: string }) => header.key === "Content-Security-Policy").value;
  expect(policy.match(/connect-src[^;]+/)[0]).toContain("https://api.pwnedpasswords.com");
});

it("sends only the hash prefix, bounds the request, and detects LF responses", async () => {
  const password = "local regression fixture";
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const fetch = vi.fn().mockResolvedValue(new Response(`OTHER:0\n${hash.slice(5)}:42\n`));
  vi.stubGlobal("fetch", fetch);
  expect(await checkPwnedPassword(password)).toEqual({ isPwned: true, count: 42 });
  expect(fetch).toHaveBeenCalledWith(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
    method: "GET",
    headers: { "Add-Padding": "true" },
    signal: expect.any(AbortSignal),
  });
  expect(JSON.stringify(fetch.mock.calls)).not.toContain(password);
});

it("ignores padded zero-count suffixes", async () => {
  const password = "padding regression fixture";
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`${hash.slice(5)}:0\r\n`)));
  expect(await checkPwnedPassword(password)).toEqual({ isPwned: false, count: 0 });
});
