'use client'

export type CoverageState =
  | 'initial_loading'
  | 'more_available'
  | 'continuation_loading'
  | 'coverage_unconfirmed'
  | 'confirmed_end'
  | 'filtered_nonempty'
  | 'confirmed_empty'
  | 'unavailable'
  | 'continuation_failed'
  | 'zero_new_unconfirmed'

export type CoverageFilter = {
  key: string
  label: string
  onRemove: () => void
}

type ResultCoverageBoundaryProps = {
  surface: 'deals' | 'date_search'
  state: CoverageState
  visibleCount: number
  activeFilters: CoverageFilter[]
  recommendedFilterKey?: string
  requestOrigin?: 'manual' | 'automatic'
  onLoadMore?: () => void
  onRetryInitial?: () => void
  onRetryContinuation?: () => void
  onChangeDates?: () => void
  onEditSearch?: () => void
  onClearAll?: () => void
  statusMessageId: string
  controlRef?: React.Ref<HTMLButtonElement>
  boundaryRef?: React.Ref<HTMLElement>
  showFilterActions?: boolean
}

function FilterActions({
  activeFilters,
  recommendedFilterKey,
  onClearAll,
}: Pick<ResultCoverageBoundaryProps, 'activeFilters' | 'recommendedFilterKey' | 'onClearAll'>) {
  const recommended = activeFilters.find(filter => filter.key === recommendedFilterKey) ?? activeFilters[0]
  if (!recommended) return null

  return (
    <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
      <button type="button" onClick={recommended.onRemove} className="btn btn-primary min-h-[44px] w-full whitespace-normal px-6 sm:w-auto">
        Remove &ldquo;{recommended.label}&rdquo;
      </button>
      {activeFilters.length > 1 && onClearAll ? (
        <button type="button" onClick={onClearAll} className="btn btn-outline min-h-[44px] w-full px-6 sm:w-auto">
          Clear all filters
        </button>
      ) : null}
    </div>
  )
}

export function ResultCoverageBoundary({
  surface,
  state,
  visibleCount,
  activeFilters,
  recommendedFilterKey,
  requestOrigin,
  onLoadMore,
  onRetryInitial,
  onRetryContinuation,
  onChangeDates,
  onEditSearch,
  onClearAll,
  statusMessageId,
  controlRef,
  boundaryRef,
  showFilterActions = true,
}: ResultCoverageBoundaryProps) {
  const filtered = activeFilters.length > 0
  const isDeals = surface === 'deals'
  const filterActions = (
    <FilterActions
      activeFilters={activeFilters}
      recommendedFilterKey={recommendedFilterKey}
      onClearAll={onClearAll}
    />
  )

  let title: string | null = null
  let body: string
  let actions: React.ReactNode = null

  switch (state) {
    case 'initial_loading':
      body = isDeals ? 'Finding current expaify hotel deals…' : 'Finding current expaify hotel results…'
      break
    case 'more_available':
      body = isDeals
        ? `${visibleCount} ${visibleCount === 1 ? 'deal' : 'deals'} shown. More ${filtered ? 'matching ' : ''}expaify deals are available.`
        : `${visibleCount} ${visibleCount === 1 ? 'result' : 'results'} shown. More expaify hotel results are available for these dates.`
      actions = onLoadMore ? (
        <button ref={controlRef} type="button" onClick={onLoadMore} className="btn btn-primary min-h-[44px] w-full px-6 sm:w-auto">
          {isDeals ? 'Load more deals' : 'Load more hotels'}
        </button>
      ) : null
      break
    case 'continuation_loading':
      body = isDeals ? 'Loading more deals…' : 'Loading more hotels…'
      actions = (
        <button ref={controlRef} type="button" disabled className="btn btn-primary min-h-[44px] w-full px-6 sm:w-auto">
          {isDeals ? 'Loading more deals…' : 'Loading more hotels…'}
        </button>
      )
      break
    case 'coverage_unconfirmed':
    case 'filtered_nonempty':
      body = isDeals
        ? `${visibleCount} ${visibleCount === 1 ? 'deal' : 'deals'} shown. expaify can’t confirm whether this is the full ${filtered ? 'matching ' : 'current '}set.`
        : `${visibleCount} ${visibleCount === 1 ? 'result' : 'results'} shown. expaify can’t confirm whether this is the full set for these dates.`
      actions = isDeals
        ? showFilterActions ? filterActions : null
        : (
          <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
            {onChangeDates ? <button type="button" onClick={onChangeDates} className="btn btn-primary min-h-[44px] w-full px-6 sm:w-auto">Change dates</button> : null}
            {onEditSearch ? <button type="button" onClick={onEditSearch} className="btn btn-outline min-h-[44px] w-full px-6 sm:w-auto">Edit search</button> : null}
          </div>
        )
      break
    case 'confirmed_end':
      body = isDeals
        ? `You’ve reached the end of current expaify deals${filtered ? ' matching these filters' : ''}.`
        : 'You’ve reached the end of expaify hotel results returned for these dates.'
      actions = isDeals
        ? showFilterActions ? filterActions : null
        : onChangeDates ? <button type="button" onClick={onChangeDates} className="btn btn-outline min-h-[44px] w-full px-6 sm:w-auto">Change dates</button> : null
      break
    case 'confirmed_empty':
      title = isDeals
        ? filtered ? 'No current expaify deals match your filters' : 'No current expaify hotel deals were returned'
        : 'No expaify hotel results were returned for these dates'
      body = isDeals
        ? filtered ? 'Remove one filter to expand this expaify result set.' : 'There are no current matches in expaify’s tracked deal set. Check again after the next daily update.'
        : 'Try different stay dates while keeping your destination and traveler details.'
      actions = isDeals ? showFilterActions ? filterActions : null : (
        <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
          {onChangeDates ? <button type="button" onClick={onChangeDates} className="btn btn-primary min-h-[44px] w-full px-6 sm:w-auto">Change dates</button> : null}
          {onEditSearch ? <button type="button" onClick={onEditSearch} className="btn btn-outline min-h-[44px] w-full px-6 sm:w-auto">Edit search</button> : null}
        </div>
      )
      break
    case 'unavailable':
      title = isDeals ? 'We couldn’t confirm current hotel deals' : 'We couldn’t confirm hotel coverage'
      body = isDeals
        ? 'The deal feed didn’t load. Your filters are unchanged.'
        : 'Hotel results weren’t confirmed for this search. Your destination, dates, and traveler details are unchanged.'
      actions = (
        <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
          {onRetryInitial ? <button ref={controlRef} type="button" onClick={onRetryInitial} className="btn btn-primary min-h-[44px] w-full px-6 sm:w-auto">{isDeals ? 'Retry loading deals' : 'Retry hotel search'}</button> : null}
          {!isDeals && onEditSearch ? <button type="button" onClick={onEditSearch} className="btn btn-outline min-h-[44px] w-full px-6 sm:w-auto">Edit search</button> : null}
        </div>
      )
      break
    case 'continuation_failed':
      title = isDeals ? 'We couldn’t load more deals' : 'We couldn’t load more hotel results'
      body = isDeals ? 'The deals already shown are still available to compare.' : 'The results already shown are still available to compare.'
      actions = onRetryContinuation ? (
        <button ref={controlRef} type="button" onClick={onRetryContinuation} className="btn btn-primary min-h-[44px] w-full px-6 sm:w-auto">
          Try loading more again
        </button>
      ) : null
      break
    case 'zero_new_unconfirmed':
      body = isDeals
        ? 'No additional unique deals were returned. Coverage is still unconfirmed.'
        : 'No additional unique hotel results were returned. Coverage is still unconfirmed.'
      actions = onRetryContinuation ? (
        <button ref={controlRef} type="button" onClick={onRetryContinuation} className="btn btn-primary min-h-[44px] w-full px-6 sm:w-auto">
          Try loading more again
        </button>
      ) : null
      break
  }

  const panel = title !== null

  return (
    <section
      ref={boundaryRef}
      tabIndex={-1}
      aria-labelledby={title ? `${statusMessageId}-title` : undefined}
      aria-describedby={title ? statusMessageId : undefined}
      role={state === 'continuation_failed' ? 'status' : state === 'unavailable' ? 'alert' : undefined}
      data-request-origin={requestOrigin}
      className={`${panel ? 'rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-5 py-6 sm:px-8 sm:py-8' : 'mt-8 border-t border-[color:var(--border)] pt-6'} w-full focus:outline-none`}
    >
      <div className="mx-auto flex max-w-[720px] flex-col items-stretch gap-3 text-left sm:items-center sm:text-center">
        {title ? <h3 id={`${statusMessageId}-title`} className="font-display text-[20px] font-bold leading-[1.2] text-[color:var(--text-1)]">{title}</h3> : null}
        <p id={statusMessageId} className="text-[14px] leading-6 text-[color:var(--text-2)]">{body}</p>
        {actions}
      </div>
    </section>
  )
}
