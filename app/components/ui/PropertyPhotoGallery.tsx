'use client'

import { useState } from 'react'
import { PropertyPhoto } from './PropertyPhoto'

type PropertyPhotoGalleryProps = {
  // Real photos the provider actually returned (0, 1, or many). Never
  // padded/fabricated to reach a target count.
  photoUrls?: string[] | null
  // The existing singular field, used only when photoUrls is empty/missing
  // -- keeps every caller working unchanged for rows that predate this
  // column or came from a provider this hasn't been extended for yet.
  fallbackSrc?: string | null
  loading?: 'eager' | 'lazy'
  brandedFallback?: { cityLabel: string }
  imageClassName?: string
}

/**
 * Primary photo + thumbnail strip when a hotel has more than one real
 * photo; degrades to the exact same single-PropertyPhoto behavior that
 * existed before this component when there's only 0 or 1 real photo --
 * UXR-HOTEL-VIEW-RICHER-MEDIA-01 directive 4.
 */
export function PropertyPhotoGallery({
  photoUrls, fallbackSrc, loading = 'lazy', brandedFallback, imageClassName,
}: PropertyPhotoGalleryProps) {
  const realPhotos = (photoUrls ?? []).filter(Boolean)
  const effectivePhotos = realPhotos.length > 0 ? realPhotos : (fallbackSrc ? [fallbackSrc] : [])
  const [selectedIndex, setSelectedIndex] = useState(0)
  // A fresh set of photos (different hotel, different request) must not
  // keep a stale selected index pointed past the end of a shorter array.
  const safeIndex = selectedIndex < effectivePhotos.length ? selectedIndex : 0

  if (effectivePhotos.length <= 1) {
    return (
      <PropertyPhoto
        src={effectivePhotos[0] ?? null}
        size="detail"
        loading={loading}
        brandedFallback={brandedFallback}
        imageClassName={imageClassName}
      />
    )
  }

  return (
    <div>
      <PropertyPhoto
        src={effectivePhotos[safeIndex]}
        size="detail"
        loading={loading}
        brandedFallback={brandedFallback}
        imageClassName={imageClassName}
      />
      <div
        role="tablist"
        aria-label="Hotel photos"
        className="mt-2 flex gap-2 overflow-x-auto pb-1"
      >
        {effectivePhotos.map((url, index) => (
          <button
            key={url}
            type="button"
            role="tab"
            aria-selected={index === safeIndex}
            aria-label={`Photo ${index + 1} of ${effectivePhotos.length}`}
            onClick={() => setSelectedIndex(index)}
            className={`shrink-0 overflow-hidden rounded-[var(--radius-control)] transition-opacity motion-safe:duration-150 ${
              index === safeIndex
                ? 'opacity-100 ring-2 ring-[color:var(--primary)]'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-14 w-20 object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
