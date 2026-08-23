export default function BrandMark({ size = 32, className = "brand-mark" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" fill="#B1FF8C" />
      <path
        d="M20 32h20M32.5 22.5 43 32l-10.5 9.5"
        fill="none"
        stroke="#111827"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
