import { ImageResponse } from "next/og";

/**
 * Link preview for WhatsApp/Telegram/social, in the NOMAD NIGHT palette.
 * Text stays with the font bundled into next/og (covers Cyrillic), so nothing
 * has to be fetched at build time.
 */
export const alt = "OQU — образовательная платформа с AI-наставником";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 88px",
          backgroundColor: "#111218",
          backgroundImage:
            "radial-gradient(110% 80% at 88% -12%, rgba(245, 165, 36, 0.30), rgba(17, 18, 24, 0) 62%)",
          color: "#f4f2ec",
        }}
      >
        {/* Brand mark + wordmark, same geometry as components/layout/brand.tsx */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="76" height="76" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z"
              stroke="#f5a524"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" fill="#f5a524" />
          </svg>
          <div style={{ display: "flex", fontSize: 84, letterSpacing: 8, color: "#f4f2ec" }}>
            OQU
          </div>
        </div>

        {/* Split by hand: satori would otherwise wrap on the "AI-" hyphen. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 40,
            fontSize: 54,
            lineHeight: 1.2,
          }}
        >
          <div style={{ display: "flex" }}>Образовательная платформа</div>
          <div style={{ display: "flex" }}>с AI-наставником</div>
        </div>

        <div style={{ display: "flex", marginTop: 22, fontSize: 30, color: "#9a9aa6" }}>
          Курсы по AI, реальные проекты и геймификация обучения
        </div>

        <div style={{ display: "flex", marginTop: 54, alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", width: 72, height: 4, background: "#f5a524" }} />
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, color: "#f5a524" }}>
            КАЗАХСТАН
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
