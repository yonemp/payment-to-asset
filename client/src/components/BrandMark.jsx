export default function BrandMark({ size = 34, className = "brand-mark" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" fill="#0a0a0a" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="#a3e635" strokeWidth="1.4" opacity="0.28" />
      <circle cx="32" cy="32" r="13" fill="none" stroke="#a3e635" strokeWidth="1.5" opacity="0.55" />
      <circle cx="32" cy="32" r="3.4" fill="#a3e635" />
      <path
        d="M24 32h16M34.5 25.5 41 32l-6.5 6.5"
        fill="none"
        stroke="#a3e635"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
