import type { ConflictBannerData } from '@/lib/admin/uiPresentation'

const TONE_CLASSES: Record<ConflictBannerData['tone'], string> = {
  error:
    'rounded-[var(--radius-control)] border border-[var(--error)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--text-1)]',
  warning:
    'rounded-[var(--radius-control)] border border-[var(--gold)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--text-1)]',
  info: 'rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-sm text-[var(--text-2)]',
}

export function ConflictBannerList({ banners }: { banners: ConflictBannerData[] }) {
  if (banners.length === 0) return null
  return (
    <div className="mb-6 flex flex-col gap-2">
      {banners.map((banner, i) => (
        <div
          key={`${banner.tone}-${i}`}
          role={banner.tone === 'error' ? 'alert' : 'status'}
          className={TONE_CLASSES[banner.tone]}
        >
          {banner.text}
        </div>
      ))}
    </div>
  )
}
