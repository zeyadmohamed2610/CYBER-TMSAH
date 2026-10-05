import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const expiryArg = process.argv.find((value) => value.startsWith("--otp-expiry-seconds="));
const expirySeconds = Number(expiryArg?.split("=")[1]);
if (!Number.isInteger(expirySeconds) || expirySeconds < 60 || expirySeconds % 60 !== 0) {
  throw new Error(
    "Pass --otp-expiry-seconds=<verified Supabase value in whole minutes> before generating emails.",
  );
}
const expiryMinutes = expirySeconds / 60;
const definitions = [
  {
    name: "recovery",
    subject: "استعادة كلمة المرور",
    title: "إعادة تعيين كلمة المرور",
    preview: `أعد تعيين كلمة المرور خلال ${expiryMinutes} دقيقة. رابط خاص بك للاستخدام مرة واحدة.`,
    description:
      "وصلنا طلب لاستعادة كلمة مرور حسابك. افتح الرابط، ثم أدخل كلمة مرور جديدة مختلفة عن السابقة وأكّدها.",
    action: "إعادة تعيين كلمة المرور",
    hint: "بعد الحفظ، سجّل الدخول بكلمة المرور الجديدة.",
    note: `الرابط صالح لمدة ${expiryMinutes} دقيقة من وقت إصداره ويُستخدم مرة واحدة. لا تشاركه مع أحد.`,
    ignore: "لم تطلب التغيير؟ تجاهل الرسالة؛ ستبقى كلمة مرورك كما هي.",
  },
  {
    name: "confirmation",
    subject: "تأكيد بريدك الإلكتروني",
    title: "تأكيد البريد الإلكتروني",
    preview:
      "أكّد ملكيتك لهذا البريد لاستكمال إجراءات حسابك. طلب الانضمام تراجعه الإدارة بشكل مستقل.",
    description: "لتأكيد أن هذا البريد يخصك، اضغط الزر التالي.",
    action: "تأكيد البريد الإلكتروني",
    note: "تأكيد البريد لا يعني الموافقة على طلب الانضمام؛ تُراجع الإدارة الطلب بشكل مستقل.",
    ignore: "لم تنشئ طلبًا؟ يمكنك تجاهل هذه الرسالة.",
  },
  {
    name: "invite",
    subject: "دعوتك إلى المنصة",
    title: "دعوة إلى المنصة",
    preview: "وصلتك دعوة للانضمام إلى المنصة. افتح رابط الدعوة للمتابعة.",
    description: "وصلتك دعوة للانضمام إلى سايبر تمساح. افتح رابط الدعوة للمتابعة.",
    action: "فتح الدعوة",
    note: "هذه الدعوة خاصة بك. لا تشارك رابطها مع أي شخص.",
    ignore: "لا تتوقع هذه الدعوة؟ تجاهل الرسالة أو تواصل معنا للاستفسار.",
  },
  {
    name: "magic-link",
    subject: "رابط تسجيل الدخول",
    title: "تسجيل الدخول إلى حسابك",
    preview: "رابط خاص لتسجيل الدخول مرة واحدة، أو استخدم رمز التحقق في شاشة الدخول.",
    description: "استخدم الرابط التالي لتسجيل الدخول إلى حسابك دون إدخال كلمة المرور.",
    action: "تسجيل الدخول",
    otp: true,
    note: "الرابط ورمز التحقق خاصّان بك ويُستخدمان مرة واحدة. لا تشاركهما مع أحد.",
    ignore: "لم تطلب تسجيل الدخول؟ تجاهل هذه الرسالة.",
  },
  {
    name: "email-change",
    subject: "تأكيد تغيير البريد الإلكتروني",
    title: "تأكيد عنوان البريد الجديد",
    preview: "أكّد تغيير البريد المرتبط بحسابك. تجاهل الرسالة إذا لم تطلب هذا التغيير.",
    description: "وصلنا طلب لتغيير بريد حسابك إلى العنوان التالي:",
    action: "تأكيد تغيير البريد الإلكتروني",
    address: true,
    note: "لن يكتمل التغيير إلا بعد استيفاء خطوات تأكيد البريد المطلوبة لحسابك.",
    ignore: "لم تطلب تغيير البريد؟ تجاهل الرسالة وتواصل معنا إذا احتجت مساعدة.",
  },
  {
    name: "reauthentication",
    subject: "رمز تأكيد هويتك",
    title: "تأكيد هويتك",
    preview: "رمز خاص لإكمال التحقق من هويتك قبل العملية الحساسة. لا تشاركه مع أحد.",
    description: "أدخل الرمز التالي في شاشة التحقق لإكمال العملية التي طلبتها.",
    otp: true,
    note: "الرمز خاص بك. لن نطلب منك مشاركته أو إرسال كلمة المرور عبر البريد.",
    ignore: "لم تطلب التحقق؟ تجاهل هذه الرسالة.",
  },
];
const baseStyle = "font-family:Tahoma,Arial,sans-serif;direction:rtl";
const button = (label) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="email-button" align="center" bgcolor="#7629c7" style="background-color:#7629c7;border-radius:10px;mso-padding-alt:14px 18px"><a class="email-button" href="{{ .ConfirmationURL }}" style="display:block;padding:14px 18px;font-size:16px;line-height:26px;font-weight:bold;color:#ffffff;text-align:center;text-decoration:none;border:1px solid #7629c7;border-radius:10px">${label}</a></td></tr></table>`;
const otp = (hasLink) =>
  `${hasLink ? '<p class="email-muted" style="margin:16px 0 8px;font-size:14px;line-height:24px;color:#4b5565">أو أدخل هذا الرمز إذا طلبته شاشة تسجيل الدخول:</p>' : ""}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="email-note" bgcolor="#f3edfb" dir="ltr" align="center" style="padding:16px 8px;border-radius:10px;text-align:center;font-family:Consolas,monospace;font-size:28px;line-height:40px;font-weight:bold;letter-spacing:3px;color:#542286">{{ .Token }}</td></tr></table>`;
const style = `<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  table { border-collapse: separate; border-spacing: 0; }
  a:focus { outline: 2px solid #b985ff; outline-offset: 3px; }
  @media screen and (max-width: 420px) {
    .email-content { padding: 22px 20px !important; }
    .email-heading { font-size: 22px !important; line-height: 34px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .email-bg { background-color: #090d18 !important; }
    .email-card { background-color: #151b2b !important; border-color: #343d52 !important; }
    .email-heading { color: #f3f5fc !important; }
    .email-copy, .email-muted { color: #cbd3e4 !important; }
    .email-kicker, .email-link { color: #d2aaff !important; }
    .email-note { background-color: #29223b !important; color: #e3d2fa !important; }
    .email-footer { background-color: #111726 !important; border-color: #343d52 !important; }
    .email-button { background-color: #7629c7 !important; color: #ffffff !important; border-color: #7629c7 !important; }
  }
  [data-ogsc] .email-bg { background-color: #090d18 !important; }
  [data-ogsc] .email-card { background-color: #151b2b !important; border-color: #343d52 !important; }
  [data-ogsc] .email-heading { color: #f3f5fc !important; }
  [data-ogsc] .email-copy, [data-ogsc] .email-muted { color: #cbd3e4 !important; }
  [data-ogsc] .email-kicker, [data-ogsc] .email-link { color: #d2aaff !important; }
  [data-ogsc] .email-note { background-color: #29223b !important; color: #e3d2fa !important; }
  [data-ogsc] .email-footer { background-color: #111726 !important; border-color: #343d52 !important; }
</style>`;
function render(item) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${item.subject} | CYBER TMSAH</title>${style}</head>
<body class="email-bg" style="margin:0;padding:0;background-color:#f3f4f8;${baseStyle};color:#202437">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${item.preview}${"&#8204;&nbsp;".repeat(60)}</div>
<table role="presentation" class="email-bg" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f4f8" style="width:100%;background-color:#f3f4f8"><tr><td align="center" style="padding:20px 12px">
<!--[if mso]><table role="presentation" width="560" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="email-card" width="560" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #e2e4ed;border-radius:16px;overflow:hidden">
<tr><td align="center" bgcolor="#101426" style="padding:18px 20px;background-color:#101426;border-top:4px solid #9344e8"><table role="presentation" align="center" dir="ltr" cellspacing="0" cellpadding="0" border="0"><tr><td width="40" valign="middle"><img src="https://www.cyber-tmsah.site/brand/mark.png" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border:0;color:#ffffff"></td><td style="padding-left:12px;text-align:center"><p dir="ltr" style="margin:0;font-size:20px;line-height:28px;font-weight:bold;letter-spacing:1px;color:#ffffff">CYBER <span style="color:#c99aff">TMSAH</span></p><p dir="rtl" style="margin:3px 0 0;font-size:12px;line-height:20px;color:#d4d9e5">متابعة الدراسة والحضور</p></td></tr></table></td></tr>
<tr><td class="email-content" dir="rtl" align="right" style="padding:24px;text-align:right;${baseStyle}">
<p class="email-kicker" style="margin:0 0 8px;font-size:13px;line-height:22px;font-weight:bold;color:#7133ad">أمان حسابك</p>
<h1 class="email-heading" style="margin:0 0 14px;font-size:24px;line-height:36px;color:#171b2e">${item.title}</h1>
<p class="email-copy" style="margin:0 0 20px;font-size:15px;line-height:28px;color:#424d61">${item.description}</p>
${item.address ? '<p class="email-copy" dir="ltr" style="margin:0 0 20px;font-size:14px;line-height:26px;color:#424d61;text-align:center;word-break:break-all;overflow-wrap:anywhere">{{ .NewEmail }}</p>' : ""}
${item.action ? button(item.action) : ""}${item.otp ? otp(Boolean(item.action)) : ""}
${item.hint ? `<p class="email-muted" style="margin:10px 0 0;font-size:14px;line-height:24px;text-align:center;color:#4b5565">${item.hint}</p>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px"><tr><td class="email-note" bgcolor="#f3edfb" style="padding:14px 16px;background-color:#f3edfb;border-radius:10px;font-size:14px;line-height:26px;color:#4b3367;text-align:right;${baseStyle}">${item.note}</td></tr></table>
<p class="email-muted" style="margin:16px 0 0;font-size:14px;line-height:26px;color:#4b5565">${item.ignore}</p>
${item.action ? `<p class="email-muted" style="margin:14px 0 0;font-size:14px;line-height:26px;color:#4b5565">إذا لم يعمل الزر، <a class="email-link" href="{{ .ConfirmationURL }}" style="color:#7133ad;text-decoration:underline">${item.name === "recovery" ? "افتح رابط الاستعادة" : "افتح رابط التحقق"}</a>.</p>` : ""}
</td></tr>
<tr><td class="email-footer" align="center" bgcolor="#f9fafc" style="padding:14px 20px;border-top:1px solid #e9ebf1;background-color:#f9fafc;text-align:center;${baseStyle}"><p class="email-muted" style="margin:0 0 4px;font-size:13px;line-height:23px;color:#4b5565">رسالة من منصة سايبر تمساح · للمساعدة</p><a class="email-link" dir="ltr" href="mailto:cybertmsah@gmail.com" style="display:inline-block;font-size:14px;line-height:26px;color:#7133ad;text-decoration:underline">cybertmsah@gmail.com</a></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "supabase/templates");
await mkdir(target, { recursive: true });
for (const item of definitions) {
  await writeFile(
    path.join(target, `${item.name}.html`),
    await format(render(item), { parser: "html" }),
  );
}
console.log(
  `Generated six auth email templates; verified recovery expiration: ${expiryMinutes} minutes.`,
);
