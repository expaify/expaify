type StarRowProps = {
  stars: number;
  ariaLabel?: string;
};

export function StarRow({ stars, ariaLabel }: StarRowProps) {
  const filledStars = Math.max(0, Math.min(5, Math.round(stars)));

  return (
    <div
      className="flex items-center gap-1"
      aria-label={ariaLabel ?? `${filledStars} star hotel`}
      role="img"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={index}
          viewBox="0 0 12 11"
          width="12"
          height="11"
          aria-hidden="true"
          focusable="false"
          className={index < filledStars ? "fill-[color:var(--gold)]" : "fill-[color:var(--line-ivory)]"}
        >
          <path d="M6 1l1.39 2.82 3.11.45-2.25 2.19.53 3.09L6 8 3.22 9.55l.53-3.09L1.5 4.27l3.11-.45L6 1z" />
        </svg>
      ))}
    </div>
  );
}
