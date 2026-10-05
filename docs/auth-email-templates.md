# قوالب بريد CYBER TMSAH

القوالب الستة عربية وتستخدم الشعار الحالي والعنوان البريدي `cybertmsah@gmail.com` الموجود في إعداد SMTP. كل ملف HTML مستقل، ويمكن نسخ محتواه كاملًا إلى خانة **Body / Source** في Supabase → Authentication → Emails → Templates.

- **Confirm sign up**: [confirmation.html](../supabase/templates/confirmation.html). العنوان: `تأكيد بريدك الإلكتروني | CYBER TMSAH`.
- **Invite user**: [invite.html](../supabase/templates/invite.html). العنوان: `دعوتك إلى المنصة | CYBER TMSAH`.
- **Magic link or OTP**: [magic-link.html](../supabase/templates/magic-link.html). العنوان: `رابط تسجيل الدخول | CYBER TMSAH`.
- **Change email address**: [email-change.html](../supabase/templates/email-change.html). العنوان: `تأكيد تغيير البريد الإلكتروني | CYBER TMSAH`.
- **Reset password**: [recovery.html](../supabase/templates/recovery.html). العنوان: `استعادة كلمة المرور | CYBER TMSAH`.
- **Reauthentication**: [reauthentication.html](../supabase/templates/reauthentication.html). العنوان: `رمز تأكيد هويتك | CYBER TMSAH`.

تم حفظ هذه القوالب وعناوينها في المشروع المستضاف يوم 5 أكتوبر 2026. يحتفظ Supabase بإعدادات إرسال البريد والصلاحية؛ تغيير التصميم لا يفعّل مسارات تسجيل دخول جديدة في التطبيق ولا يوافق على طلبات الانضمام.

تستخدم القوالب `{{ .ConfirmationURL }}` لرابط العملية الخاص بها، و`{{ .Token }}` لرمز OTP، و`{{ .NewEmail }}` في تأكيد البريد الجديد فقط. لا تستبدل هذه المتغيرات بقيم ثابتة. قالب إعادة التحقق يعرض رمزًا فقط. محتوى الرسائل يعتمد على الجداول والتنسيق المضمّن، ويظل واضحًا حتى عند حجب الصورة؛ لا توجد سكربتات أو خطوط خارجية أو أدوات تتبع.

لتوحيد التصميم والنصوص بين القوالب، المصدر هو [generate-auth-email-templates.mjs](../scripts/generate-auth-email-templates.mjs). تحقّق من قيمة `auth.email.otp_expiry` في إعدادات المشروع المستضاف قبل إعادة التوليد، ثم مرّرها بالثواني:

```powershell
node scripts/generate-auth-email-templates.mjs --otp-expiry-seconds=1800
```

القيمة المتحقق منها يوم 5 أكتوبر 2026 هي 1800 ثانية؛ رسالة الاستعادة تقول «30 دقيقة من وقت إصداره»، وليس من وقت فتح الرسالة. إذا تغير إعداد الصلاحية، أعد توليد القوالب ونشرها بالقيمة الجديدة. المولد يرفض العمل دون قيمة صريحة؛ لا يغيّر إعدادات Supabase ولا يرسل رسائل.

يتضمن التصميم هيدرًا مختصرًا، ونصوصًا ثانوية أوضح، وملخصًا مخفيًا لمعاينة الوارد، وألوانًا داكنة لبرامج البريد التي تدعمها، وخصائص عرض بديلة لـOutlook. يعتمد التصميم الأساسي على تنسيق مضمّن ليبقى مقروءًا إذا تجاهل برنامج البريد CSS الموجود في رأس الرسالة. اسم المنصة مكتوب كنص مستقل عن الصورة.

التحقق من العرض في متصفح لا يغني عن معاينة برنامج البريد؛ قد تختلف معالجة الألوان والزوايا والوضع الداكن بين Gmail وOutlook. تم اختبار استعادة كلمة المرور فعليًا على الخادم؛ بقية مسارات المصادقة لم تُفعّل أو تُرسل رسائل اختبار إلى المستخدمين لمجرد تغيير القوالب.

المراجع: [قوالب البريد في Supabase](https://supabase.com/docs/guides/auth/auth-email-templates)، [المتغيرات والقوالب](https://supabase.com/docs/guides/local-development/customizing-email-templates).
