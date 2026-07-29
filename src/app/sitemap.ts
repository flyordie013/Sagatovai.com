import type { MetadataRoute } from "next";
import { listPublicCourses } from "@/data/public";

// Public origin — same source as metadataBase in layout.tsx.
const SITE_URL = (process.env.APP_URL || "https://sagatovai.com").replace(/\/$/, "");

// Course list comes from the DB — never freeze it into the build output.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/courses`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // A sitemap must never 500: on an empty or unreachable DB the static pages
  // are still worth serving to crawlers.
  try {
    const courses = await listPublicCourses();
    for (const c of courses) {
      pages.push({
        url: `${SITE_URL}/courses/${c.slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch {
    // Storefront pages only.
  }
  return pages;
}
