import {test,expect} from '@playwright/test';
test('public pages expose consistent brand metadata and private unknown pages stay out of search',async({page})=>{
 await page.goto('/');
 await expect(page).toHaveTitle('CYBER TMSAH | سايبر تمساح — المنصة الأكاديمية');
 await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://www.cyber-tmsah.site/');
 await expect(page.locator('meta[name="description"]')).toHaveCount(1);
 await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content','https://www.cyber-tmsah.site/og-image.png');
 await expect(page.locator('input[name="identifier"]')).toBeVisible();
 await page.goto('/join');
 await expect(page).toHaveTitle(/طلب الانضمام/);
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://www.cyber-tmsah.site/join');
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/^index,/);
 await page.goto('/unknown-seo-verification-page');
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, follow');
});
