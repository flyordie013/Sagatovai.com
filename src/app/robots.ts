import type { MetadataRoute } from "next";

// Public origin — same source as metadataBase in layout.tsx.
const SITE_URL = (process.env.APP_URL || "https://sagatovai.com").replace(/\/$/, "");

// APP_URL is only correct at request time on the server, not at build time.
export const dynamic = "force-dynamic";

/**
 * Only the storefront is indexable. Everything behind auth (кабинет, уроки,
 * профиль, админка) and the API surface stays out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/dashboard", "/profile", "/lesson", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
