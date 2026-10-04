import { expect, test } from "@playwright/test";
test("public pages expose consistent brand metadata and private unknown pages stay out of search", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("CYBER TMSAH | سايبر تمساح — المنصة الأكاديمية");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://www.cyber-tmsah.site/",
  );
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://www.cyber-tmsah.site/og-image.png",
  );
  await expect(page.locator('input[name="identifier"]')).toBeVisible();
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/brand/icon-192.png");
  await page.getByRole("link", { name: "عن المنصة", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(
    page.getByRole("heading", { name: "عن منصة CYBER TMSAH — سايبر تمساح" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "الحضور والغياب", exact: true })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://www.cyber-tmsah.site/about",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index,/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/join");
  await expect(page).toHaveTitle(/طلب الانضمام/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://www.cyber-tmsah.site/join",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index,/);
  await page.goto("/unknown-seo-verification-page");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
});
