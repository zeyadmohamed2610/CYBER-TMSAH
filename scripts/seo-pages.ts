import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { pageMetadata, siteStructuredData, SITE_OVERVIEW } from "../src/shared/lib/siteMetadata.ts";
const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Entry pages have accurate metadata before JavaScript runs. */
export function seoPages(): Plugin {
  let output = "";
  return {
    name: "public-page-metadata",
    apply: "build",
    configResolved(config) {
      output = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { type: "application/ld+json" },
          children: JSON.stringify(siteStructuredData),
          injectTo: "head",
        },
      ];
    },
    async closeBundle() {
      const source = await readFile(path.join(output, "index.html"), "utf8");
      for (const route of ["login", "join", "reset-password", "about", "404"]) {
        const page = pageMetadata("/" + route);
        if (route === "404") {
          page.title = "الصفحة غير موجودة | CYBER TMSAH";
          page.description = "الرابط المطلوب غير موجود. يمكنك العودة إلى منصة CYBER TMSAH.";
        }
        let html = source.replace(
          /<title[^>]*>.*?<\/title>/,
          `<title data-rh="true">${escape(page.title)}</title>`,
        );
        for (const [key, value] of Object.entries({
          description: page.description,
          robots: page.indexable ? "index, follow, max-image-preview:large" : "noindex, follow",
          "og:title": page.title,
          "og:description": page.description,
          "og:url": page.url,
          "twitter:title": page.title,
          "twitter:description": page.description,
        })) {
          html = html.replace(
            new RegExp(`(<meta[^>]+(?:name|property)="${key}"[^>]+content=")[^"]*("[^>]*>)`),
            `$1${escape(value)}$2`,
          );
        }
        html = html.replace(
          /(<link[^>]+rel="canonical"[^>]+href=")[^"]*("[^>]*>)/,
          `$1${page.url}$2`,
        );
        if (route === "about") {
          const content = `<main style="max-width:768px;margin:48px auto;padding:24px;font-family:Arial,sans-serif;line-height:2">
            <img src="/brand/icon-192.png" width="72" height="72" alt="شعار CYBER TMSAH" />
            <h1>${escape(SITE_OVERVIEW.heading)}</h1><p>${escape(SITE_OVERVIEW.introduction)}</p><p>${escape(SITE_OVERVIEW.audience)}</p>
            ${SITE_OVERVIEW.sections.map((section) => `<section><h2>${escape(section.title)}</h2><p>${escape(section.description)}</p></section>`).join("")}
            <h2>كيفية الانضمام</h2><p>${escape(SITE_OVERVIEW.access)}</p>
            <p><a href="/join">طلب الانضمام</a> · <a href="/login">تسجيل الدخول</a></p></main>`;
          html = html.replace(/(<div id="root">)[\s\S]*?(<\/main><\/div>)/, `$1${content}</div>`);
        }
        if (route === "404") {
          html = html.replace(
            /(<div id="root">)[\s\S]*?(<\/main><\/div>)/,
            '$1<main><h1>الصفحة غير موجودة</h1><p>الرابط المطلوب غير موجود.</p><a href="/">العودة إلى CYBER TMSAH</a></main></div>',
          );
          await writeFile(path.join(output, "404.html"), html);
          continue;
        }
        const folder = path.join(output, route);
        await mkdir(folder, { recursive: true });
        await writeFile(path.join(folder, "index.html"), html);
      }
    },
  };
}
