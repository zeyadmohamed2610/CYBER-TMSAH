# هوية CYBER TMSAH

رمز CT داخل إطار موحّد، بألوان مستمدة من واجهة المنصة. تُستخدم الكحلية `#060813` للخلفيات، والبنفسجي `#A855F7` للون الرئيسي، والبنفسجي الداكن `#7C3AED` واللافندر `#C084FC` للتدرجات والتأكيد.

## الملفات

- `public/brand/mark.png`: الأصل الشفاف عالي الدقة.
- `public/logo.png`: الرمز الشفاف، 512×512.
- `public/favicon.png`: أيقونة المتصفح، 64×64، بخلفية كحلية.
- `public/brand/icon-192.png` و`icon-512.png`: أيقونات التطبيق، مع هامش آمن للقص.
- `public/brand/apple-touch-icon.png`: أيقونة أجهزة Apple، 180×180.
- `public/brand/tile-150.png`: أيقونة Windows، 150×150.
- `public/og-image.png`: غلاف المشاركة وبانر README، 1200×630.

يُحافظ على نسبة الأبعاد ولا يُمدد الرمز أو يُضاف إليه نص داخل مساحته. استخدم الرمز الشفاف فوق خلفية هادئة؛ خلفية مربعات الشفافية ليست جزءًا من التصميم. صور الأشخاص لا تدخل ضمن تغيير الهوية.

## إعادة تصدير المقاسات

```bash
pnpm exec playwright install chromium
node scripts/export-brand-assets.mjs
```

البرنامج يصدر المقاسات من الأصل نفسه، ويركب غلاف المشاركة باستخدام نصوص قابلة للتعديل في الملف. لا يحتاج إلى مفاتيح أو اتصال بالخلفية.

## مصدر التصميم

وُلّد الأصل بأداة توليد الصور المدمجة، ثم صدرت منه المقاسات وتركيب الغلاف محليًا. وصف التوليد:

> A polished master emblem for CYBER TMSAH, an Arabic academic attendance platform: one compact interlocking CT monogram inside a restrained angular shield; purple #A855F7 and violet #7C3AED with lavender highlights; broad shapes readable at small sizes, generous negative space, a transparent background, no wordmark, checkerboard, circuits, hacking motifs, or glowing haze.
