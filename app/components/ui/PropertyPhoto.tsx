'use client'

import { useState } from 'react'

type PropertyPhotoProps = {
  src?: string | null
  size: 'thumbnail' | 'card' | 'expanded' | 'detail'
  loading?: 'eager' | 'lazy'
  onFailure?: () => void
}

const sizeClasses = {
  thumbnail: { container: 'w-20 rounded-[var(--radius-control)]', viewport: 'h-16', missing: 'min-h-[89px]' },
  card: { container: 'w-full rounded-[var(--radius-control)]', viewport: 'h-28 sm:h-32', missing: 'min-h-[137px] sm:min-h-[153px]' },
  expanded: { container: 'w-full rounded-[var(--radius-card)]', viewport: 'h-40', missing: 'min-h-[185px]' },
  detail: { container: 'w-full rounded-[var(--radius-card)]', viewport: 'h-[200px] min-[680px]:h-[280px]', missing: 'min-h-[225px] min-[680px]:min-h-[305px]' },
} as const

export function PropertyPhoto({ src, size, loading = 'lazy', onFailure }: PropertyPhotoProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const classes = sizeClasses[size]

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center border border-[color:var(--border)] bg-[color:var(--bg-muted)] px-4 text-center ${classes.container} ${classes.missing}`}
        {...(failed ? { role: 'status' as const } : {})}
      >
        <p className="text-caption font-medium leading-5 text-[color:var(--text-3)]">Photo unavailable</p>
      </div>
    )
  }

  return (
    <figure
      className={`overflow-hidden border border-[color:var(--border)] bg-[color:var(--bg-muted)] ${classes.container}`}
      aria-busy={!loaded}
    >
      <div className={`relative overflow-hidden bg-[color:var(--bg-muted)] ${classes.viewport}`}>
        {!loaded ? <div className="skeleton absolute inset-0 motion-reduce:animate-none" aria-hidden="true" /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
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
      <figcaption className="border-t border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-caption font-medium leading-4 text-[color:var(--text-2)]">
        Property photo
      </figcaption>
    </figure>
  )
}
