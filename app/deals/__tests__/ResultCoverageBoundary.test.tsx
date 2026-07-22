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

    expect(markup).toContain('12 deals shown. expaify can’t confirm whether this is the full matching set.')
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

    expect(markup).toContain('20 results shown. expaify can’t confirm whether this is the full set for these dates.')
    expect(markup).not.toContain('Load more hotels')
    expect(markup).not.toContain('reached the end')
  })
})
