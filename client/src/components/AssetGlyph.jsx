export default function AssetGlyph({ tint, size = 28 }) {
  const common = { width: size, height: size, viewBox: "0 0 32 32", className: "asset-glyph", "aria-hidden": true };
  if (tint === "sol") {
    return (
      <svg {...common}>
        <rect x="5" y="7" width="22" height="4.2" rx="2.1" fill="#22d3ee" />
        <rect x="5" y="14" width="22" height="4.2" rx="2.1" fill="#67e8f9" opacity="0.75" />
        <rect x="5" y="21" width="22" height="4.2" rx="2.1" fill="#22d3ee" opacity="0.5" />
      </svg>
    );
  }
  if (tint === "btc") {
    return (
      <svg {...common}>
        <path
          d="M16 3.2 27.4 9.8v12.4L16 28.8 4.6 22.2V9.8Z"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1.8"
        />
        <circle cx="16" cy="16" r="4.2" fill="#fbbf24" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M16 4 26 16 16 28 6 16Z" fill="none" stroke="#94a3b8" strokeWidth="1.8" />
      <path d="M16 10 21 16 16 22 11 16Z" fill="#94a3b8" />
    </svg>
  );
}
