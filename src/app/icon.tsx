import { ImageResponse } from "next/og";

/** Favicon: gold “O” on the NOMAD NIGHT ink square. */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
          background: "#111218",
          border: "2px solid rgba(245, 165, 36, 0.45)",
          color: "#f5a524",
          fontSize: 40,
          letterSpacing: -1,
        }}
      >
        O
      </div>
    ),
    { ...size },
  );
}
