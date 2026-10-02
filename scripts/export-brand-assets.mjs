import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

// Export the approved master mark at exact browser/app dimensions.
const mark = `data:image/png;base64,${(await readFile('public/brand/mark.png')).toString('base64')}`;
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const [path, size, background, scale] of [
    ['public/logo.png', 512, null, 0.92],
    ['public/favicon.png', 64, '#060813', 0.92],
    ['public/brand/icon-192.png', 192, '#060813', 0.78],
    ['public/brand/icon-512.png', 512, '#060813', 0.78],
    ['public/brand/apple-touch-icon.png', 180, '#060813', 0.78],
    ['public/brand/tile-150.png', 150, '#060813', 0.78],
  ]) {
    const data = await page.evaluate(async ({ mark, size, background, scale }) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      if (background) { context.fillStyle = background; context.fillRect(0, 0, size, size); }
      const img = new Image(); img.src = mark; await img.decode();
      context.imageSmoothingQuality = 'high';
      const inset = size * (1 - scale) / 2;
      context.drawImage(img, inset, inset, size * scale, size * scale);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { mark, size, background, scale });
    await writeFile(path, Buffer.from(data, 'base64'));
    console.log(`${path}: ${size}x${size}`);
  }
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#060813;color:#f8fafc;font-family:Arial,sans-serif}
    .cover{width:1200px;height:630px;position:relative;overflow:hidden;display:flex;align-items:center;padding:80px;gap:58px;
      background:radial-gradient(ellipse at 10% 40%,#7c3aed22,transparent 55%),linear-gradient(120deg,#060813,#0f1127)}
    .frame{position:absolute;inset:24px;border:1px solid #a855f72e;border-radius:28px}
    .orb{position:absolute;right:-150px;top:-310px;width:760px;height:760px;border-radius:50%;border:1px solid #a855f727;box-shadow:0 0 0 60px #a855f707,0 0 0 120px #a855f705}
    .mark{width:290px;height:290px;position:relative;flex-shrink:0}
    .copy{position:relative;flex:1}.eyebrow{font-size:13px;letter-spacing:5px;color:#c084fc;margin-bottom:24px}
    h1{font-size:63px;letter-spacing:-2px;line-height:1.06;margin:0;font-weight:800;white-space:nowrap}
    h1 span{color:#c084fc}.line{width:65px;height:3px;background:#a855f7;margin:30px 0}
    .arabic{font-size:28px;line-height:1.6;margin:0;color:#e2e8f0;text-align:left;direction:rtl}
    .sub{font-size:16px;letter-spacing:1px;color:#94a3b8;margin-top:14px}
    .bottom{position:absolute;bottom:60px;left:80px;right:80px;display:flex;justify-content:space-between;font-size:12px;letter-spacing:2px;color:#64748b}
    .dot{color:#a855f7;margin:0 12px}
  </style></head><body><main class="cover"><div class="frame"></div><div class="orb"></div>
    <img class="mark" src="${mark}" alt=""><div class="copy"><div class="eyebrow">THE ACADEMIC PLATFORM</div>
    <h1>CYBER <span>TMSAH</span></h1><div class="line"></div><p class="arabic">تجربة أكاديمية واحدة، من الحضور إلى المتابعة.</p>
    <div class="sub">One platform. Every academic day.</div></div>
    <div class="bottom"><span>ATTENDANCE <span class="dot">/</span> LECTURES <span class="dot">/</span> INSIGHTS</span><span>CYBER TMSAH</span></div>
  </main></body></html>`);
  await page.locator('.mark').evaluate(img => img.decode());
  await page.screenshot({ path: 'public/og-image.png' });
  console.log('public/og-image.png: 1200x630');
} finally {
  await browser.close();
}
