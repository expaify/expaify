'use client'

import { useEffect, useRef, useState } from 'react'

type PropertyPhotoProps = {
  src?: string | null
  size: 'thumbnail' | 'card' | 'expanded' | 'detail'
  loading?: 'eager' | 'lazy'
  onFailure?: () => void
  brandedFallback?: { cityLabel: string }
}

const sizeClasses = {
  thumbnail: { container: 'w-20 rounded-[var(--radius-control)]', viewport: 'h-16', missing: 'min-h-[89px]' },
  card: { container: 'w-full rounded-[var(--radius-card)]', viewport: 'h-28 sm:h-32', missing: 'min-h-[137px] sm:min-h-[153px]' },
  expanded: { container: 'w-full rounded-[var(--radius-card)]', viewport: 'h-40', missing: 'min-h-[185px]' },
  detail: { container: 'w-full rounded-[var(--radius-card)]', viewport: 'h-[200px] min-[680px]:h-[280px]', missing: 'min-h-[225px] min-[680px]:min-h-[305px]' },
} as const

export function PropertyPhoto({ src, size, loading = 'lazy', onFailure, brandedFallback }: PropertyPhotoProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  // `loaded`/`failed` describe one specific `src`, not this component instance
  // for its whole lifetime. A parent that keeps the same list position mounted
  // (same React key) while swapping in a different photo -- e.g. after a
  // filter/sort/refresh replaces the data behind an unchanged card -- would
  // otherwise carry a PREVIOUS photo's failure into a brand-new, perfectly
  // valid src, permanently showing "Photo unavailable" for it. Resetting here,
  // synchronously during render when `src` changes (React's documented pattern
  // for "adjusting state when a prop changes"), avoids both the stale state
  // and the extra render/flash a useEffect-based reset would add.
  const [srcForState, setSrcForState] = useState(src)
  if (src !== srcForState) {
    setSrcForState(src)
    setLoaded(false)
    setFailed(false)
  }
  const classes = sizeClasses[size]
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Hydration race: on a fast connection/warm cache, the browser can finish
  // loading the <img> before React finishes hydrating and attaches the
  // onLoad/onError listeners below -- that one-time native load event fires
  // and is gone, so `loaded` would otherwise never become true and the image
  // stays hidden behind its skeleton forever despite having loaded correctly.
  // `.complete` (true once the browser is done, one way or another) plus
  // `.naturalWidth` (0 only for a failed/broken load) let us detect and
  // recover from that missed event once this effect runs post-hydration.
  useEffect(() => {
    const img = imgRef.current
    if (!img || !img.complete) return
    if (img.naturalWidth > 0) {
      setLoaded(true)
    } else {
      setFailed(true)
      onFailure?.()
    }
    // Only re-check on a genuine src change -- `loaded`/`failed`/`onFailure`
    // are set by this same effect or by onLoad/onError, not inputs to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  if (!src || failed) {
    if (brandedFallback?.cityLabel) {
      return (
        <div
          className={`flex flex-col items-center justify-center gap-2 bg-[color:var(--bg-muted)] px-4 text-center ${size === 'card' ? '' : 'border border-[color:var(--border)]'} ${classes.container} ${classes.missing}`}
          {...(failed ? { role: 'status' as const } : {})}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[color:var(--accent)] font-display text-lg font-bold leading-none text-[color:var(--ink)]">
            e
          </div>
          <p className="text-caption font-medium leading-5 text-[color:var(--ink-soft)]">
            {brandedFallback.cityLabel}
          </p>
        </div>
      )
    }
    return (
      <div
        className={`flex items-center justify-center bg-[color:var(--bg-muted)] px-4 text-center ${size === 'card' ? '' : 'border border-[color:var(--border)]'} ${classes.container} ${classes.missing}`}
        {...(failed ? { role: 'status' as const } : {})}
      >
        <p className="text-caption font-medium leading-5 text-[color:var(--text-2)]">Photo unavailable</p>
      </div>
    )
  }

  return (
    <figure
      className={`overflow-hidden bg-[color:var(--bg-muted)] ${size === 'card' ? '' : 'border border-[color:var(--border)]'} ${classes.container}`}
      aria-busy={!loaded}
    >
      <div className={`relative overflow-hidden bg-[color:var(--bg-muted)] ${classes.viewport}`}>
        {!loaded ? <div className="skeleton absolute inset-0 motion-reduce:animate-none" aria-hidden="true" /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          loading={loading}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true)
            onFailure?.()
          }}
          className={`block h-full w-full object-cover transition-opacity duration-150 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      {size === 'card' ? null : (
        <figcaption className="border-t border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-caption font-medium leading-4 text-[color:var(--text-2)]">
          Property photo
        </figcaption>
      )}
    </figure>
  )
}
