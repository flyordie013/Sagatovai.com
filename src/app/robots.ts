import type { MetadataRoute } from "next";

// Public origin — same source as metadataBase in layout.tsx.
const SITE_URL = (process.env.APP_URL || "https://sagatovai.com").replace(/\/$/, "");

// APP_URL is only correct at request time on the server, not at build time.
export const dynamic = "force-dynamic";

/**
 * Only the storefront is indexable. Everything behind auth (кабинет, уроки,
 * профиль, админка) and the API surface stays out of search results.
 *
 * The list mirrors what src/proxy.ts refuses to serve without a session: every
 * path there answers with a redirect to /login for a crawler, so indexing it
 * can only ever produce a login page in the results. Public storefront routes
 * (/, /courses, /courses/*, /contacts, /offer, /refund, /privacy) stay open.
 * /login and /register are reachable without a session and are kept out with
 * `robots: { index: false }` on the pages themselves instead.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/dashboard",
        // Trailing slash on purpose: robots.txt matches by prefix, so a bare
        // "/course" would also close the public catalogue at /courses.
        "/course/",
        "/lesson",
        "/achievements",
        "/leaderboard",
        "/store",
        "/profile",
        "/logout",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
