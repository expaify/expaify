import { renderToStaticMarkup } from 'react-dom/server'
import { ResultCoverageBoundary } from '../ResultCoverageBoundary'

const filters = [
  { key: 'maxPrice', label: 'Under $150', onRemove: jest.fn() },
  { key: 'minStars', label: '4★ & up', onRemove: jest.fn() },
]

describe('ResultCoverageBoundary', () => {
  it('uses the honest unconfirmed boundary and named recovery without pagination metadata', () => {
    const markup = renderToStaticMarkup(
      <ResultCoverageBoundary
        surface="deals"
        state="coverage_unconfirmed"
        visibleCount={12}
        activeFilters={filters}
        recommendedFilterKey="maxPrice"
        onLoadMore={jest.fn()}
        onClearAll={jest.fn()}
        statusMessageId="coverage"
      />,
    )

    expect(markup).toContain('12 deals shown.')
    expect(markup).not.toContain('can’t confirm')
    expect(markup).toContain('Remove “Under $150”')
    expect(markup).toContain('Clear all filters')
    expect(markup).not.toContain('Load more deals')
    expect(markup).not.toContain('reached the end')
  })

  it('renders a native manual continuation button only for explicit more coverage', () => {
    const markup = renderToStaticMarkup(
      <ResultCoverageBoundary
        surface="deals"
        state="more_available"
        visibleCount={8}
        activeFilters={[]}
        onLoadMore={jest.fn()}
        statusMessageId="coverage"
      />,
    )

    expect(markup).toContain('More expaify deals are available.')
    expect(markup).toMatch(/<button[^>]*type="button"[^>]*>Load more deals<\/button>/)
  })

  it('keeps request failures distinct from a filtered empty result', () => {
    const markup = renderToStaticMarkup(
      <ResultCoverageBoundary
        surface="deals"
        state="unavailable"
        visibleCount={0}
        activeFilters={filters}
        recommendedFilterKey="maxPrice"
        onRetryInitial={jest.fn()}
        onClearAll={jest.fn()}
        statusMessageId="unavailable"
      />,
    )

    expect(markup).toContain('We couldn’t confirm current hotel deals')
    expect(markup).toContain('The deal feed didn’t load. Your filters are unchanged.')
    expect(markup).toContain('Retry loading deals')
    expect(markup).not.toContain('Remove “Under $150”')
  })

  it('renders one causal primary and a secondary clear-all action for a filtered empty result', () => {
    const markup = renderToStaticMarkup(
      <ResultCoverageBoundary
        surface="deals"
        state="confirmed_empty"
        visibleCount={0}
        activeFilters={filters}
        recommendedFilterKey="minStars"
        onClearAll={jest.fn()}
        statusMessageId="filtered-empty"
      />,
    )

    expect(markup).toContain('role="status"')
    expect(markup).toContain('No current expaify deals match your filters')
    expect(markup).toContain('Remove one filter to expand this expaify result set.')
    expect(markup).toContain('Remove “4★ &amp; up”')
    expect(markup).not.toContain('Remove “Under $150”')
    expect(markup.match(/btn btn-primary/g)).toHaveLength(1)
    expect(markup).toMatch(/class="btn btn-primary[^"]*"[^>]*>Remove “4★ &amp; up”<\/button>/)
    expect(markup).toMatch(/class="btn btn-outline[^"]*"[^>]*>Clear all filters<\/button>/)
  })

  it('keeps clear-all available when only one filter is active', () => {
    const markup = renderToStaticMarkup(
      <ResultCoverageBoundary
        surface="deals"
        state="confirmed_empty"
        visibleCount={0}
        activeFilters={[filters[0]]}
        onClearAll={jest.fn()}
        statusMessageId="filtered-empty"
      />,
    )

    expect(markup).toContain('Clear all filters')
  })

  it('does not infer date-search completion from a provider-sized result count', () => {
    const markup = renderToStaticMarkup(
      <ResultCoverageBoundary
        surface="date_search"
        state="coverage_unconfirmed"
        visibleCount={20}
        activeFilters={[]}
        statusMessageId="hotel-search-coverage"
      />,
    )

    expect(markup).toContain('20 results shown.')
    expect(markup).not.toContain('can’t confirm')
    expect(markup).not.toContain('Load more hotels')
    expect(markup).not.toContain('reached the end')
  })
})
