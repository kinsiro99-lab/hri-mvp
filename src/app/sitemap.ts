import type { MetadataRoute } from "next";

// Matches layout.tsx's metadataBase — kept as a literal here rather
// than a new environment variable, since none is configured for it.
const BASE_URL = "https://human-rhythm.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
