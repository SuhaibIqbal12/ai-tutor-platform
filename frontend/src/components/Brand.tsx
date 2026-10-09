import Link from "next/link";
export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Personalized Tutor home">
      <span className="brand-mark" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 5h6l3 3h5v11h-6l-3-3H5V5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M11 5v11m3-8v11" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      </span>
      {!compact && (
        <span>
          Tutor<span className="brand-dot">.</span>
          <small>YOUR LEARNING WORKSPACE</small>
        </span>
      )}
    </Link>
  );
}
