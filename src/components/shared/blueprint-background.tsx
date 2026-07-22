const INK = "23, 32, 51";

export function BlueprintBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Grid pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            `repeating-linear-gradient(0deg, rgba(${INK},0.04) 0px, rgba(${INK},0.04) 1px, transparent 1px, transparent 32px)`,
            `repeating-linear-gradient(90deg, rgba(${INK},0.04) 0px, rgba(${INK},0.04) 1px, transparent 1px, transparent 32px)`,
          ].join(", "),
          maskImage:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.04) 15%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,1) 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.04) 15%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,1) 100%)",
        }}
      />

      {/* Decorative SVG accents */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Quarter-circle arc — top-left */}
        <path
          d="M 0 240 A 240 240 0 0 0 240 0"
          stroke={`rgba(${INK},0.04)`}
          strokeWidth="0.5"
        />

        {/* Vertical construction line */}
        <line
          x1="480"
          y1="0"
          x2="480"
          y2="900"
          stroke={`rgba(${INK},0.025)`}
          strokeWidth="0.5"
          strokeDasharray="4 8"
        />

        {/* Partial circle arc — bottom-right */}
        <path
          d="M 1100 900 A 340 340 0 0 0 1440 560"
          stroke={`rgba(${INK},0.03)`}
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}
