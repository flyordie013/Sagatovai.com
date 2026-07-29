import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500", "600"],
});

const TITLE = "OQU — образовательная платформа с AI-наставником";
const DESCRIPTION =
  "Изучай AI и собирай реальные проекты: курсы, персональный AI-наставник, геймификация обучения.";

/**
 * Absolute base for og:url / canonical / OG image links. Read from APP_URL
 * (baked in at build time by the Dockerfile); a malformed value must not take
 * the whole app down at import time, hence the fallback.
 */
function siteUrl(): URL {
  const fallback = "https://sagatovai.com";
  try {
    return new URL(process.env.APP_URL || fallback);
  } catch {
    return new URL(fallback);
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: TITLE,
    template: "%s · OQU",
  },
  description: DESCRIPTION,
  applicationName: "OQU",
  // Link previews in WhatsApp/Telegram. The image itself comes from
  // app/opengraph-image.tsx — Next.js appends it to both card types.
  openGraph: {
    type: "website",
    siteName: "OQU",
    locale: "ru_RU",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#111218",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${manrope.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
