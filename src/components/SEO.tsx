import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  keywords?: string;
  additionalKeywords?: string[];
}

/**
 * SEO Component for managing meta tags
 * Provides Open Graph, Twitter Cards, and standard meta tags
 */
export const SEO = ({
  title = "CYBER TMSAH | سايبر تمساح - منصة الأمن السيبراني",
  description = "منصة CYBER TMSAH (سايبر تمساح) - منصة أكاديمية متكاملة لطلاب الأمن السيبراني. مواد دراسية، جداول محاضرات، ومراجعات شاملة في مكان واحد.",
  image = "/og-image.png",
  url = "https://www.cyber-tmsah.site",
  type = "website",
  keywords = "CYBER TMSAH, cyber tmsah, سايبر تمساح, منصة سايبر, منصة سايبر تمساح, منصة تمساح, منصة الأمن السيبراني, جامعة العاصمة التكنولوجية, مواد دراسية, جدول محاضرات, cybersecurity",
  additionalKeywords = [],
}: SEOProps) => {
  const fullTitle = title.includes("CYBER TMSAH") || title.includes("سايبر تمساح") ? title : `${title} | CYBER TMSAH | سايبر تمساح`;
  
  // دمج الكلمات المفتاحية
  const allKeywords = additionalKeywords.length > 0 
    ? `${keywords}, ${additionalKeywords.join(", ")}`
    : keywords;
  
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#0a0a0f" />
      <meta name="color-scheme" content="dark" />
      
      {/* Favicon */}
      <link rel="icon" type="image/png" href="/favicon.png" />
      <link rel="apple-touch-icon" href="/favicon.png" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="ar_AR" />
      <meta property="og:site_name" content="CYBER TMSAH | سايبر تمساح" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />
      
      {/* Keywords */}
      <meta name="keywords" content={allKeywords} />
      
      {/* Additional Meta Tags */}
      <meta name="author" content="زياد محمد | CYBER TMSAH" />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <meta name="googlebot" content="index, follow" />
      <meta name="language" content="ar" />
      <meta name="revisit-after" content="1 days" />
      
      {/* Structured Data - Organization */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "CYBER TMSAH | سايبر تمساح",
          "alternateName": ["منصة سايبر تمساح", "منصة سايبر", "منصة تمساح", "cyber tmsah"],
          "description": description,
          "url": url,
          "logo": "https://www.cyber-tmsah.site/logo.png",
          "founder": {
            "@type": "Person",
            "name": "زياد محمد"
          },
          "sameAs": [
            "https://www.facebook.com/zeyad.eltmsah",
            "https://www.linkedin.com/in/zeyadmohamed26/",
            "https://github.com/zeyadmohamed2610"
          ]
        })}
      </script>
      
      {/* Structured Data - WebSite */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "CYBER TMSAH | سايبر تمساح",
          "alternateName": ["منصة سايبر تمساح", "منصة CYBER TMSAH"],
          "url": url,
          "potentialAction": {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": `${url}/search?q={search_term_string}`
            },
            "query-input": "required name=search_term_string"
          }
        })}
      </script>
      
      {/* Structured Data - Educational Organization */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          "name": "CYBER TMSAH",
          "alternateName": "سايبر تمساح",
          "description": "منصة تعليمية متخصصة في الأمن السيبراني",
          "url": url,
          "logo": "https://www.cyber-tmsah.site/logo.png"
        })}
      </script>
    </Helmet>
  );
};

export default SEO;
