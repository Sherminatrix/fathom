export function FathomMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M16 4v15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      <path d="M11 10h10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      <circle cx="16" cy="23.5" r="4.4" fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}
