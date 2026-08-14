import type { MetadataRoute } from "next";

// Matches layout.tsx's metadataBase — kept as a literal here rather
// than a new environment variable, since none is configured for it.
const BASE_URL = "https://human-rhythm.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
