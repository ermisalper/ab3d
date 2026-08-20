import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/cappatex", "/recht/"],
      disallow: ["/api/", "/konto"],
    },
    sitemap: "https://ab3d-swiss-design.berk-ermis.chatgpt.site/sitemap.xml",
  };
}
