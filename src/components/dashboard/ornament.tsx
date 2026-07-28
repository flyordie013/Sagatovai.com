/** Stylised šańyraq (yurt crown) radial motif — restrained Kazakh accent. */
const SPOKES = Array.from({ length: 12 }, (_, i) => i * 30);

export function Ornament({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.1" fill="none">
        <circle cx="100" cy="100" r="82" />
        <circle cx="100" cy="100" r="58" />
        <circle cx="100" cy="100" r="30" />
        {SPOKES.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={100 + 30 * Math.cos(rad)}
              y1={100 + 30 * Math.sin(rad)}
              x2={100 + 82 * Math.cos(rad)}
              y2={100 + 82 * Math.sin(rad)}
            />
          );
        })}
      </g>
    </svg>
  );
}
