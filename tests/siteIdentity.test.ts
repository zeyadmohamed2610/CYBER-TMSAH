// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { seoPages } from "../scripts/seo-pages";
import { SITE_DESCRIPTION, siteStructuredData, pageMetadata } from "../src/shared/lib/siteMetadata";

describe("public identity delivered to crawlers", () => {
  it("provides readable home content and noindex errors before JavaScript runs", async () => {
    const output = await mkdtemp(path.join(tmpdir(), "cyber-identity-"));
    expect(path.dirname(path.resolve(output))).toBe(path.resolve(tmpdir()));
    try {
      await writeFile(path.join(output, "index.html"), await readFile("index.html", "utf8"));
      const plugin = seoPages();
      const resolve = plugin.configResolved as (config: unknown) => void;
      resolve({ root: output, build: { outDir: "." } });
      const close = plugin.closeBundle as () => Promise<void>;
      await close();
      const home = await readFile(path.join(output, "index.html"), "utf8");
      expect(home).toContain(SITE_DESCRIPTION);
      expect(home).not.toContain('href="/about"');
      await expect(readFile(path.join(output, "about/index.html"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
      const missing = await readFile(path.join(output, "404.html"), "utf8");
      expect(missing).toContain('name="robots" content="noindex, follow"');
      expect(missing).toContain("<h1>الصفحة غير موجودة</h1>");
      expect(missing).not.toContain(SITE_DESCRIPTION);
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });
  it("uses the academic brand and keeps protected routes out of search", () => {
    expect(siteStructuredData["@graph"][0].logo).toBe(
      "https://www.cyber-tmsah.site/brand/icon-512.png",
    );
    expect(pageMetadata("/about").indexable).toBe(false);
    for (const route of ["/owner-dashboard", "/student-panel", "/profile", "/does-not-exist"]) {
      expect(pageMetadata(route).indexable).toBe(false);
    }
  });
  it("does not rewrite unknown URLs into a successful homepage", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8"));
    expect(config.rewrites.some((route: { source: string }) => route.source === "/:match*")).toBe(
      false,
    );
    expect(config.rewrites.some((route: { source: string }) => route.source === "/about")).toBe(
      false,
    );
    expect(config.redirects).toContainEqual({
      source: "/about",
      destination: "/",
      permanent: true,
    });
  });
});
