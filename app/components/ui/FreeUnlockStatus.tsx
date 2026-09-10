type FreeUnlockStatusProps = {
  signedIn: boolean
  premium: boolean
  personalUnlocksRemaining: number
  freeUnlockLimit: number
}

export function FreeUnlockStatus({ signedIn, premium, personalUnlocksRemaining, freeUnlockLimit }: FreeUnlockStatusProps) {
  if (!signedIn || premium) return null

  const used = freeUnlockLimit - personalUnlocksRemaining
  const exhausted = personalUnlocksRemaining === 0

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[14px] border border-[color:color-mix(in_srgb,var(--primary)_22%,transparent)] bg-[color:var(--primary-soft)] px-[18px] py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="flex shrink-0 gap-1.5">
          {Array.from({ length: freeUnlockLimit }, (_, index) => (
            <span key={index} className={`h-2.5 w-2.5 rounded-full border border-[color:var(--primary)] ${index < used ? 'bg-[color:var(--primary)]' : 'bg-transparent'}`} />
          ))}
        </div>
        <div role="status" aria-live="polite" aria-atomic="true">
          <p className="text-small font-semibold text-[color:var(--text-1)]">{used} of {freeUnlockLimit} free unlocks used this week</p>
          <p className="mt-0.5 text-caption text-[color:var(--text-2)]">
            {exhausted ? 'Resets Monday' : 'Resets Monday — unlock any locked card below at no cost'}
          </p>
        </div>
      </div>
      <a href="/join" className={`inline-flex min-h-11 items-center self-end rounded-[var(--radius-control)] text-small text-[color:var(--primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] focus-visible:ring-offset-2 sm:shrink-0 ${exhausted ? 'font-bold underline' : 'font-medium'}`}>
        Want unlimited? See Premium <span aria-hidden="true" className="ml-1">→</span>
      </a>
    </div>
  )
}
