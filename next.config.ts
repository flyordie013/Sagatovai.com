import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Only effective over HTTPS; harmless otherwise. 180 days.
  { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Self-contained server build for Docker/VPS (copies only what's needed).
  output: "standalone",
  // Don't advertise the framework/version.
  poweredByHeader: false,
  // Hide the dev overlay indicator; compile/runtime errors are still surfaced.
  devIndicators: false,
  // PGlite ships WASM + worker assets — keep it external to the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
