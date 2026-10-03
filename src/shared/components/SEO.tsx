import { pageMetadata, SITE_NAME, SITE_ORIGIN } from "@/shared/lib/siteMetadata";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  keywords?: string;
  additionalKeywords?: string[];
}
export const SEO = ({
  title,
  description,
  image = "/og-image.png",
  url,
  type = "website",
}: SEOProps) => {
  const { pathname } = useLocation();
  const page = pageMetadata(pathname);
  const fullTitle = title
    ? title.includes(SITE_NAME)
      ? title
      : `${title} | ${SITE_NAME}`
    : page.title;
  const canonical = url ?? page.url,
    summary = description ?? page.description,
    picture = new URL(image, SITE_ORIGIN).href;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={summary} />
      <meta
        name="robots"
        content={page.indexable ? "index, follow, max-image-preview:large" : "noindex, follow"}
      />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={summary} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={picture} />
      <meta property="og:image:alt" content="CYBER TMSAH — سايبر تمساح، المنصة الأكاديمية" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={summary} />
      <meta name="twitter:image" content={picture} />
    </Helmet>
  );
};
export default SEO;
