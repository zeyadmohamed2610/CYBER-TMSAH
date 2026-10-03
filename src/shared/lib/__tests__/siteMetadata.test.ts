import { expect, it } from "vitest";
import { pageMetadata, SITE_ORIGIN, siteStructuredData } from "../siteMetadata";
it("consolidates the login and home entry without duplicate search results", () => {
  expect(pageMetadata("/login/")).toMatchObject({ url: SITE_ORIGIN + "/", indexable: true });
  expect(pageMetadata("/")).toEqual(pageMetadata("/login"));
});
it("keeps the public application page distinct", () => {
  expect(pageMetadata("/join")).toMatchObject({ url: SITE_ORIGIN + "/join", indexable: true });
  expect(pageMetadata("/join").title).toContain("طلب الانضمام");
});
it.each([
  "/profile",
  "/student-panel",
  "/owner-dashboard",
  "/doctor-dashboard",
  "/ta-dashboard",
  "/coordinator-dashboard",
  "/attendance",
  "/reset-password",
  "/not-a-page",
])("does not advertise private or unknown route %s to search engines", (route) => {
  expect(pageMetadata(route).indexable).toBe(false);
});
it("describes one brand and avoids invented courses, search routes and institution claims", () => {
  expect(siteStructuredData["@graph"].map((item) => item["@type"])).toEqual([
    "Organization",
    "WebSite",
  ]);
  expect(JSON.stringify(siteStructuredData)).not.toContain("/search");
});
