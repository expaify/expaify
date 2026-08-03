export {};

const trackMock = jest.fn();
const effectCleanups: Array<() => void> = [];

jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => trackMock(...args) }));
jest.mock('react', () => ({
  useRef: jest.fn(() => ({ current: new Set<string>() })),
  useEffect: jest.fn((effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) effectCleanups.push(cleanup);
  }),
}));

const { HotelDecisionAnalytics } = jest.requireActual('../HotelDecisionAnalytics') as typeof import('../HotelDecisionAnalytics');

type FakeElement = {
  attrs: Record<string, string>
  getAttribute(name: string): string | null
  matches?: (selector: string) => boolean
}

function makeSection(name: string, position: number): FakeElement {
  return {
    attrs: { 'data-hotel-decision-section': name, 'data-hotel-decision-position': String(position) },
    getAttribute(attr: string) {
      return this.attrs[attr] ?? null
    },
  }
}

function makeClickTarget(attr: string, value: string | null): { target: unknown } {
  const element = {
    getAttribute: (name: string) => (name === attr ? value ?? '' : null),
    closest: (selector: string) => (selector === `[${attr}]` ? element : null),
  }
  return { target: element }
}

describe('HotelDecisionAnalytics', () => {
  let observeMock: jest.Mock;
  let unobserveMock: jest.Mock;
  let intersectionCallback: IntersectionObserverCallback | undefined;
  let clickHandler: ((event: unknown) => void) | undefined;
  const sections: FakeElement[] = [];

  beforeEach(() => {
    jest.useFakeTimers();
    trackMock.mockClear();
    effectCleanups.length = 0;
    sections.length = 0;
    observeMock = jest.fn();
    unobserveMock = jest.fn();
    clickHandler = undefined;

    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: jest.fn((next: IntersectionObserverCallback) => {
        intersectionCallback = next;
        return { observe: observeMock, unobserve: unobserveMock, disconnect: jest.fn() };
      }),
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { innerWidth: 375, innerHeight: 667 },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        querySelectorAll: jest.fn(() => sections),
        addEventListener: jest.fn((type: string, handler: (event: unknown) => void) => {
          if (type === 'click') clickHandler = handler;
        }),
        removeEventListener: jest.fn(),
      },
    });
  });

  afterEach(() => {
    effectCleanups.forEach(cleanup => cleanup());
    jest.useRealTimers();
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
  });

  it('emits hotel_detail_viewed on mount with merged criteria and decision properties', () => {
    HotelDecisionAnalytics({
      hotelId: 'hotel-1',
      entrySource: 'saved',
      hasDates: true,
      hasVerifiedGuestRating: false,
      scoreState: 'confident',
      priceFreshnessState: 'fresh',
      viewedProps: { deal_id: 'deal-1', context_status: 'matched' },
    });

    expect(trackMock).toHaveBeenCalledWith('hotel_detail_viewed', {
      deal_id: 'deal-1',
      context_status: 'matched',
      hotel_id: 'hotel-1',
      entry_source: 'saved',
      viewport_group: 'mobile',
      has_dates: true,
      has_verified_guest_rating: false,
      score_state: 'confident',
      price_freshness_state: 'fresh',
    });
  });

  it('emits a section-reach event for a section taller than the viewport once it fills half the viewport for 1 second', () => {
    const section = makeSection('supporting_evidence', 5);
    sections.push(section);

    HotelDecisionAnalytics({
      hotelId: 'hotel-1',
      entrySource: 'saved',
      hasDates: true,
      hasVerifiedGuestRating: false,
      scoreState: 'confident',
      priceFreshnessState: 'fresh',
    });

    expect(observeMock).toHaveBeenCalledWith(section);

    // A section taller than 2x the viewport never reaches 0.5 intersectionRatio,
    // but it can still fill >=50% of the viewport area.
    intersectionCallback?.([
      {
        target: section,
        intersectionRatio: 0.3,
        intersectionRect: { width: 375, height: 400 },
      } as unknown as IntersectionObserverEntry,
    ], {} as IntersectionObserver);

    jest.advanceTimersByTime(999);
    expect(trackMock).not.toHaveBeenCalledWith('hotel_decision_section_reached', expect.anything());
    jest.advanceTimersByTime(1);

    expect(trackMock).toHaveBeenCalledWith('hotel_decision_section_reached', {
      hotel_id: 'hotel-1',
      entry_source: 'saved',
      section: 'supporting_evidence',
      position: '5',
      viewport_group: 'mobile',
    });
    expect(unobserveMock).toHaveBeenCalledWith(section);
  });

  it('emits each section-reach event at most once', () => {
    const section = makeSection('hotel_fit', 3);
    sections.push(section);

    HotelDecisionAnalytics({
      hotelId: 'hotel-1',
      entrySource: 'saved',
      hasDates: true,
      hasVerifiedGuestRating: false,
      scoreState: 'confident',
      priceFreshnessState: 'fresh',
    });

    const entry = { target: section, intersectionRatio: 1, intersectionRect: { width: 375, height: 300 } } as unknown as IntersectionObserverEntry;
    intersectionCallback?.([entry], {} as IntersectionObserver);
    jest.advanceTimersByTime(1000);
    intersectionCallback?.([entry], {} as IntersectionObserver);
    jest.advanceTimersByTime(1000);

    expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_decision_section_reached')).toHaveLength(1);
  });

  it('leaves sessionized handoff starts to the provider component and emits back-to-results clicks', () => {
    HotelDecisionAnalytics({
      hotelId: 'hotel-1',
      entrySource: 'search',
      hasDates: true,
      hasVerifiedGuestRating: false,
      scoreState: 'confident',
      priceFreshnessState: 'fresh',
    });

    clickHandler?.(makeClickTarget('data-hotel-provider', 'booking'));
    expect(trackMock).not.toHaveBeenCalledWith('hotel_room_handoff_started', expect.anything());

    clickHandler?.(makeClickTarget('data-hotel-back', ''));
    expect(trackMock).toHaveBeenCalledWith('hotel_detail_back_to_results', {
      hotel_id: 'hotel-1',
      entry_source: 'search',
    });
  });
});
