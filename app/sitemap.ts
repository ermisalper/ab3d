import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://ab3d-swiss-design.berk-ermis.chatgpt.site";
  const legalRoutes = ["recht", "recht/impressum", "recht/datenschutz", "recht/agb", "recht/versand-rueckgabe", "recht/ki-produktsicherheit"];
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/cappatex`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    ...legalRoutes.map((route) => ({ url: `${baseUrl}/${route}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: route === "recht" ? 0.5 : 0.4 })),
  ];
}
