import { tripAdvisorBubbleRatingToReviewEvidence } from '../snapshot'

describe('tripAdvisorBubbleRatingToReviewEvidence', () => {
  it('maps a valid TripAdvisor score and strips formatting from the review count', () => {
    expect(tripAdvisorBubbleRatingToReviewEvidence({
      id: '123',
      title: 'Hotel',
      bubbleRating: { rating: 4.5, count: '(1,200)' },
    }, '123')).toEqual({
      schemaVersion: 1,
      state: 'ready',
      providerPropertyId: 'ta_123',
      providerId: 'tripadvisor16',
      provenance: 'provider_only',
      sourceLabel: 'TripAdvisor',
      coverage: { kind: 'none' },
      score: { value: 4.5, scaleMax: 5 },
      overallReviewCount: 1200,
    })
  })

  it('returns null when bubble rating data is absent', () => {
    expect(tripAdvisorBubbleRatingToReviewEvidence({ id: '123', title: 'Hotel' }, '123')).toBeNull()
  })

  it('preserves provenance but omits invalid score and count values', () => {
    expect(tripAdvisorBubbleRatingToReviewEvidence({
      id: '123',
      title: 'Hotel',
      bubbleRating: { rating: Number.NaN, count: '(0)' },
    }, '123')).toEqual({
      schemaVersion: 1,
      state: 'not_provided',
      providerPropertyId: 'ta_123',
      providerId: 'tripadvisor16',
      provenance: 'provider_only',
      sourceLabel: 'TripAdvisor',
      coverage: { kind: 'none' },
    })
  })
})
