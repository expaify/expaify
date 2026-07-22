const trackMock = jest.fn();
let effectCleanup: (() => void) | undefined;
const observedElement = {} as HTMLElement;

jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => trackMock(...args) }));
jest.mock('react', () => ({
  useRef: jest.fn(() => ({ current: observedElement })),
  useEffect: jest.fn((effect: () => void | (() => void)) => { effectCleanup = effect() ?? undefined; }),
}));

const analytics = jest.requireActual('../hotelFundsPolicyAnalytics') as typeof import('../hotelFundsPolicyAnalytics');

describe('hotel funds policy analytics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    trackMock.mockClear();
    analytics.resetHotelFundsPolicyAnalyticsForTests();
    effectCleanup = undefined;
  });

  afterEach(() => {
    effectCleanup?.();
    jest.useRealTimers();
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  });

  it('fires one exposure after 50% visibility is sustained for one second', () => {
    let callback: IntersectionObserverCallback | undefined;
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: jest.fn((next: IntersectionObserverCallback) => {
        callback = next;
        return { observe: jest.fn(), disconnect: jest.fn() };
      }),
    });

    analytics.useHotelFundsPolicyExposure({
      evidence: undefined,
      loadState: 'ready',
      offerId: 'offer-1',
      provider: 'hotellook',
      surface: 'hotel_card',
    });
    callback?.([{ target: observedElement, isIntersecting: true, intersectionRatio: 0.5 } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    jest.advanceTimersByTime(999);
    expect(trackMock).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    callback?.([{ target: observedElement, isIntersecting: true, intersectionRatio: 1 } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    jest.advanceTimersByTime(1_000);

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('hotel_funds_policy_summary_viewed', {
      policyState: 'not_returned', obligationTypes: 'unknown', scope: 'not_returned',
      provider: 'hotellook', surface: 'hotel_card',
    });
  });

  it('deduplicates detail-open and emits confirmation only from the explicit action', () => {
    const input = { evidence: undefined, loadState: 'ready' as const, offerId: 'offer-2', provider: 'hotellook' };
    analytics.trackHotelFundsPolicyDetailsOpened(input);
    analytics.trackHotelFundsPolicyDetailsOpened(input);
    analytics.trackHotelFundsPolicyConfirmation({ ...input, partnerNamed: true });

    expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_funds_policy_details_opened')).toHaveLength(1);
    expect(trackMock).toHaveBeenCalledWith('hotel_funds_policy_confirm_clicked', {
      policyState: 'not_returned', obligationTypes: 'unknown', scope: 'not_returned',
      provider: 'hotellook', surface: 'book_handoff', partnerNamed: true,
    });
  });

  it('bounds the detail-open dedupe cache while keeping analytics payloads free of offer ids', () => {
    for (let index = 0; index <= 1_000; index += 1) {
      analytics.trackHotelFundsPolicyDetailsOpened({
        evidence: undefined,
        loadState: 'ready',
        offerId: `offer-${index}-${'x'.repeat(3_000)}`,
        provider: 'hotellook',
      });
    }

    analytics.trackHotelFundsPolicyDetailsOpened({
      evidence: undefined,
      loadState: 'ready',
      offerId: `offer-0-${'x'.repeat(3_000)}`,
      provider: 'hotellook',
    });

    expect(trackMock).toHaveBeenCalledTimes(1_002);
    expect(trackMock.mock.calls.every(([, props]) => !Object.prototype.hasOwnProperty.call(props, 'offerId'))).toBe(true);
  });
});
