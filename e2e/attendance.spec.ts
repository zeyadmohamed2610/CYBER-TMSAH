import { expect, test } from "@playwright/test";
test("development health reports only the web server", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data).toMatchObject({ scope: "web-server", checks: { server: "ok" } });
  expect(data.checks).not.toHaveProperty("database");
});
test("installation manifest and icons exist", async ({ request }) => {
  const response = await request.get("/manifest.json");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(["/", "/login"]).toContain(manifest.start_url);
  for (const icon of manifest.icons) {
    const iconResponse = await request.get(icon.src);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toContain("image/");
  }
});
