import type { ReactElement } from 'react';
import type { BookingFareContext, BookingHotelContext } from '@/lib/booking/config';
import type { HotelPartnerIdentity } from '../BookingFlow';
import type { HotelStayStub } from '@/lib/booking/hotelStayStore';

type TestElement = ReactElement<Record<string, unknown>>;
const trackMock = jest.fn();

jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

const getStayStubSnapshotMock = jest.fn();
const subscribeToStayStoreChangesMock = jest.fn().mockReturnValue(() => {});
const writeStayStubMock = jest.fn();
const isStayStorageAvailableMock = jest.fn();

jest.mock('@/lib/booking/hotelStayStore', () => ({
  getStayStubSnapshot: (...args: unknown[]) => getStayStubSnapshotMock(...args),
  subscribeToStayStoreChanges: (...args: unknown[]) => subscribeToStayStoreChangesMock(...args),
  writeStayStub: (...args: unknown[]) => writeStayStubMock(...args),
  isStayStorageAvailable: (...args: unknown[]) => isStayStorageAvailableMock(...args),
}));

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');

  return {
    ...actual,
    useEffect: jest.fn((effect: () => void) => effect()),
    useMemo: jest.fn((factory: () => unknown) => factory()),
    useRef: jest.fn((initialValue: unknown) => ({ current: initialValue === null ? { focus: jest.fn() } : initialValue })),
    useState: jest.fn((initialValue: unknown) => [initialValue, jest.fn()]),
    // Mirrors real `useSyncExternalStore`'s first render: read the snapshot
    // synchronously. `subscribe` is irrelevant in this call-the-function-
    // once test harness (there is no real commit/subscribe phase).
    useSyncExternalStore: jest.fn((_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot()),
  };
});

const {
  default: BookingFlow,
  beginHotelDocumentReadinessCheck,
  focusHotelDocumentRetryStatus,
  HotelReturnStatePanel,
} = jest.requireActual('../BookingFlow') as typeof import('../BookingFlow');

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children;
  return Array.isArray(children) ? children : [children].filter(Boolean);
}

function resolveFunctionElement(node: TestElement): unknown {
  let current: unknown = node;

  while (current && typeof current === 'object' && typeof (current as TestElement).type === 'function') {
    const element = current as TestElement;
    current = (element.type as (props: Record<string, unknown>) => unknown)(element.props);
  }

  return current;
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join('');
  if (typeof node === 'object') {
    const resolved = resolveFunctionElement(node as TestElement);
    if (!resolved || typeof resolved !== 'object') return collectText(resolved);
    return childrenOf(resolved as TestElement).map(collectText).join('');
  }
  return '';
}

function findElements(node: unknown, predicate: (element: TestElement) => boolean): TestElement[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => findElements(child, predicate));

  const resolved = resolveFunctionElement(node as TestElement);
  if (!resolved || typeof resolved !== 'object') return [];
  const element = resolved as TestElement;
  return [
    ...(predicate(element) ? [element] : []),
    ...childrenOf(element).flatMap(child => findElements(child, predicate)),
  ];
}

const fareContext: BookingFareContext = {
  offerId: 'off_123',
  provider: 'duffel',
  origin: 'JFK',
  destination: 'LAX',
  depart: '2026-09-22T08:00:00.000Z',
  return: '2026-09-29T17:30:00.000Z',
  carrier: 'American Airlines',
  stops: 1,
  priceCents: 45001,
  currency: 'USD',
  passengerCount: 3,
  priceScope: 'party_total',
};

const oneAdultFareContext: BookingFareContext = {
  ...fareContext,
  passengerCount: 1,
  priceScope: 'per_person',
};

const hotelContext: BookingHotelContext = {
  kind: 'hotel',
  offerId: 'hotel_123',
  provider: 'hotellook',
  name: 'The Example Hotel',
  area: 'Midtown',
  priceCents: 18900,
  currency: 'USD',
  priceBasis: 'per_night_before_taxes_fees',
  providerUrl: 'https://tp.media/r?marker=hotel-marker',
  documentReadiness: {
    status: 'not_provided', scope: 'rate', documentTypes: [], issuerByDocument: {},
    billingDetailsStep: 'unknown',
    taxIdentifierEligibility: { state: 'not_provided', entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Hotellook', scope: 'rate' } },
    documentNameEligibility: { state: 'not_provided', allowedAddresseeTypes: [], relationships: { guest: 'not_provided', booker: 'not_provided', cardholder: 'not_provided' }, entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Hotellook', scope: 'rate' } },
    source: { label: 'Hotellook' },
  },
  fundsPolicy: { state: 'not_returned', obligations: [], sourceLabel: 'Hotellook', scope: 'not_returned' },
};

describe('BookingFlow fare context review', () => {
  beforeEach(() => {
    trackMock.mockClear();
  });

  it('starts and records only one retry while a document check is pending', () => {
    const pendingRef = { current: false };
    const retryStarted = jest.fn();

    expect(beginHotelDocumentReadinessCheck(pendingRef, retryStarted)).toBe(true);
    expect(beginHotelDocumentReadinessCheck(pendingRef, retryStarted)).toBe(false);
    expect(retryStarted).toHaveBeenCalledTimes(1);
  });

  it('moves focus once to the loading status that replaces an activated retry', () => {
    const focusPendingRef = { current: true };
    const statusRegion = { focus: jest.fn() };

    expect(focusHotelDocumentRetryStatus(focusPendingRef, statusRegion)).toBe(true);
    expect(focusHotelDocumentRetryStatus(focusPendingRef, statusRegion)).toBe(false);
    expect(statusRegion.focus).toHaveBeenCalledTimes(1);
  });

  it('blocks review when selected fare context is missing', () => {
    const text = collectText(BookingFlow({
      bookingEnabled: true,
      duffelSandbox: true,
      fareContext: null,
    }));

    expect(text).toContain("We can't identify this fare");
    expect(text).toContain('Selection details are missing');
    expect(text).toContain('Return to search and choose a current result before reviewing booking options.');
    expect(text).toContain('Back to search');
    expect(text).not.toContain('Confirm booking');
    expect(text).not.toContain('Current fare');
    expect(text).not.toContain('Traveler details');
    expect(text).not.toContain('No fare details were supplied');
  });

  it('shows the selected fare route, provider, passengers, and integer-cent price context', () => {
    const text = collectText(BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext,
    }));

    expect(text).toContain('JFK to LAX');
    expect(text).toContain('JFK → LAX');
    expect(text).toContain('American Airlines');
    expect(text).toContain('Duffel sandbox');
    expect(text).toContain('$450.01');
    expect(text).toContain('3 adults');
    expect(text).toContain('total for 3 adults');
  });

  it('explains the one-adult traveler burden before collecting provider-required details', () => {
    const text = collectText(BookingFlow({
      bookingEnabled: true,
      duffelSandbox: false,
      fareContext: oneAdultFareContext,
    }));

    expect(text).toContain('Verify this fare for 1 adult traveler');
    expect(text).toContain('Before you enter details');
    expect(text).toContain('Required by Duffel for this booking request');
    expect(text).toContain('Sent only when you choose verify');
    expect(text).toContain('No payment details are collected on this page');
    expect(text).toContain('Provider verification pending');
    expect(text).toContain('1 adult traveler');
    expect(text).toContain('Traveler identity');
    expect(text).toContain('Provider contact');
    expect(text).toContain('Verify fare with Duffel');
    expect(text).not.toContain('Confirm booking');
  });

  it('uses the normalized offer provider for fee copy when the destination partner is unresolved', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext,
    });
    const text = collectText(tree);

    expect(text).toContain('Hotel review');
    expect(text).toContain('The Example Hotel');
    expect(text).toContain('Area');
    expect(text).toContain('Midtown');
    expect(text).toContain('Provider supplied an area, not a street address.');
    expect(text).toContain('Stay dates not provided');
    expect(text).toContain('Price and Deal Score');
    expect(text).toContain('Observed nightly rate');
    expect(text).toContain('Hotellook');
    expect(text).toContain('$189.00');
    expect(text).toContain('$189.00per night');
    expect(text).toContain('Last-checked time not provided.');
    expect(text).toContain('Deal Score unavailable');
    expect(text).toContain('Hotel fit');
    expect(text).toContain('Check rooms with provider');
    expect(text).toContain('Check rooms at provider');
    expect(text).toContain('The provider shows room options, live availability, its final price, cancellation policy, and terms. Compare its tax and mandatory-charge details with the expaify summary before you continue.');
    expect(text).toContain('Room view');
    expect(text).toContain('View not confirmed');
    expect(text).toContain('View not confirmed for the room you choose. Photos may show the property or other room categories. Confirm the room’s view with the provider before booking.');
    expect(text).toContain('Airport-transfer details were not confirmed. Check directly with the property before arrival.');
    expect(text).toContain('Supporting evidence');
    expect(text).toContain('Rate restrictions');
    expect(text).toContain('Restrictions not provided');
    expect(text).toContain('Hotellook did not provide complete rate restrictions. Check membership, residency, age, and refund terms before paying.');
    expect(text).toContain('Source: Hotellook. Rate-detail freshness not available.');
    expect(text).toContain('Airport transfer details could not be checked. Confirm directly with the property before arrival.');
    expect(text).toContain('I need an invoice or receipt for this stay');
    expect(text).toContain('We’ll show what the provider supplied before you continue.');
    expect(text).not.toContain('Hotellook did not provide invoice or receipt information for this rate.');
    expect(text).toContain('What you may need');
    expect(text).toContain('Have the lead guest’s full name, a confirmation email, and a reachable phone number ready. The booking partner will show what it needs to create the booking.');
    expect(text).toContain('Booking for someone else? Use the name of the person checking in as the lead guest. This does not confirm whose ID or payment card the property will accept; review the ID and cardholder rules before paying.');
    expect(text).toContain('Special requests');
    expect(text).toContain('Deposits and card holds');
    expect(text).toContain('Policy not provided');
    expect(text).toContain('Source checked: Hotellook · Scope not provided');
    expect(text).toContain('Confirm policy with booking partner');
    expect(text).toContain('Need a quiet room, high floor, preferred bed setup, or early check-in?');
    expect(text).toContain('Add your request on the booking partner’s site while booking. Nothing is selected or sent by expaify.');
    expect(text).toContain('A request is a preference, not a change to your booked room or rate. Requests depend on availability and are not guaranteed. After booking, follow your confirmation’s instructions for contacting the property about fulfillment.');
    expect(text).toContain('Changes after booking');
    expect(text).toContain('Before payment, check the selected rate and room terms for date, guest, and room changes.');
    expect(text).toContain('After booking, use your booking partner’s confirmation for the booking reference and change or support instructions. expaify cannot change the reservation.');
    expect(text).toContain('Opens the booking partner’s site in a new tab. Your expaify search stays open here.');
    expect(text).toContain('Taxes and mandatory charges');
    expect(text).toContain('TaxesNot confirmed for this selected offer.No provider total is available to confirm inclusion.Payment timing not confirmed.');
    expect(text).toContain('Mandatory property chargesNot confirmed for this selected offer.No provider total is available to confirm inclusion.Payment timing not confirmed.');
    expect(text).toContain('The booking partner confirms the final total before you pay.');
    expect(text).not.toContain('Provider confirmation required');
    expect(text).not.toContain('Before you continue');
    expect(text).not.toContain('tp.media takes payment');
    expect(text).not.toContain('Add your request on tp.media');
    expect(text).not.toContain('rooms near each other');
    expect(text).not.toContain('connecting rooms');
    expect(text).not.toContain('Traveler details');
    expect(text).not.toContain('What you’ll need');
    expect(text).not.toContain('Confirm booking');

    const outbound = findElements(tree, element => element.type === 'a' && typeof element.props['aria-label'] === 'string' && element.props['aria-label'].startsWith('Check rooms at'))[0];
    expect(outbound.props.href).toBe(hotelContext.providerUrl);
    expect(outbound.props.rel).toBe('noopener noreferrer sponsored');
    expect(outbound.props['aria-label']).toBe("Check rooms at provider for The Example Hotel. Opens the booking partner’s site in a new tab. The selected nightly rate is $189.00 per night. Taxes: not confirmed. Mandatory property charges: not confirmed. The booking partner confirms the final total before you pay. Airport-transfer details were not confirmed. Check directly with the property before arrival. Confirm cooling for the room and rate you choose. Confirm heating for the room and rate you choose. Confirm whether you can adjust the room temperature yourself. Confirm the room's smoking status and the property's current smoking rules on the booking partner. ID and cardholder rules were not provided; check them before paying.");
  });

  it('uses booking-partner fee copy only when the normalized offer provider is missing', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext: { ...hotelContext, provider: '   ' },
    });
    const text = collectText(tree);
    const outbound = findElements(tree, element => element.type === 'a' && typeof element.props['aria-label'] === 'string' && element.props['aria-label'].startsWith('Check rooms at'))[0];

    expect(text).toContain('Taxes and mandatory charges');
    expect(text).toContain('The booking partner confirms the final total before you pay.');
    expect(outbound.props['aria-label']).toContain('Taxes: not confirmed. Mandatory property charges: not confirmed. The booking partner confirms the final total before you pay.');
    expect(outbound.props['aria-label']).not.toContain('Provider unavailable');
  });

  it('keeps provider incapability neutral at the booking handoff when DEV supplies capability', () => {
    const text = collectText(BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext,
      hotelFundsPolicyCapability: { policy: false },
    }));

    expect(text).toContain('Deposit and hold details unavailable from this provider');
    expect(text).toContain('This provider does not supply deposit or incidental-hold details.');
    expect(text).toContain('The property may still require additional available funds.');
    expect(text).not.toContain('Policy not provided for this offer');
  });

  it('carries a hotel Deal Score through to the booking review when present', () => {
    const scoredHotelContext: BookingHotelContext = {
      ...hotelContext,
      dealScore: {
        percentile: 8,
        pctVsMedian: -34,
        medianCents: 28600,
        currency: 'USD',
        verdict: 'Great',
        confidence: 'high',
        explanation: '$189.00 — about 34% below the usual $286.00 for this hotel over the last 90 days.',
        sampleSize: 43,
      },
    };
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext: scoredHotelContext,
    });
    const text = collectText(tree);

    expect(text).toContain('Great');
    expect(text).toContain(scoredHotelContext.dealScore!.explanation);
    expect(text).not.toContain('Deal Score unavailable');
  });

  it('names a resolved destination without changing its affiliate URL', () => {
    const providerUrl = 'https://www.booking.com/hotel/x?aid=123&label=a%2Bb';
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext: { ...hotelContext, providerUrl },
    });
    const text = collectText(tree);
    const outbound = findElements(tree, element => element.type === 'a' && typeof element.props['aria-label'] === 'string' && element.props['aria-label'].startsWith('Check rooms at'))[0];

    expect(text).toContain('Check rooms at Booking.com');
    expect(text).toContain('Taxes and mandatory charges');
    expect(text).toContain('Booking.com confirms the final total before you pay.');
    expect(text).toContain('Opens Booking.com in a new tab. Your expaify search stays open here.');
    expect(text).toContain('Add your request on Booking.com while booking. Nothing is selected or sent by expaify.');
    expect(text).toContain('The booking partner will show what it needs to create the booking.');
    expect(text).not.toContain('Booking.com requires');
    expect(text).not.toContain('What you’ll need');
    expect(outbound.props.href).toBe(providerUrl);
    expect(outbound.props.target).toBe('_blank');
    expect(outbound.props.rel).toBe('noopener noreferrer sponsored');
    expect(outbound.props['aria-label']).toContain('Taxes: not confirmed. Mandatory property charges: not confirmed. Booking.com confirms the final total before you pay.');
    expect(outbound.props['aria-label']).not.toContain('amount due at the property on Booking.com');
  });

  it('wraps a maximal derived partner label without a sticky desktop handoff rail', () => {
    const providerUrl = 'https://abcdefghijklmnopqrstuvwxyzabcdefghi.com/hotel/x?affiliate=123';
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext: { ...hotelContext, providerUrl },
    });
    const partnerLabel = 'Abcdefghijklmnopqrstuvwxyzabcdefghi.com';
    const labelSurfaces = findElements(tree, element => (
      collectText(element).includes(partnerLabel)
      && element.type === 'span'
    ));

    expect(findElements(tree, element => String(element.props.className).includes('lg:sticky'))).toHaveLength(0);
    expect(labelSurfaces.length).toBeGreaterThanOrEqual(1);
    expect(labelSurfaces.every(element => (
      String(element.props.className).includes('[overflow-wrap:anywhere]')
    ))).toBe(true);

    const outbound = findElements(tree, element => element.type === 'a' && element.props.target === '_blank')[0];
    expect(outbound.props.href).toBe(providerUrl);
    expect(outbound.props.rel).toBe('noopener noreferrer sponsored');
  });

  it('uses a native, initially collapsed disclosure with exact evidence-state semantics', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext: { ...hotelContext, providerUrl: 'https://www.booking.com/hotel/x?aid=123' },
    });
    const details = findElements(tree, element => element.type === 'details')[0];
    const summary = findElements(details, element => element.type === 'summary')[0];
    const list = findElements(details, element => element.type === 'ul')[0];
    const items = findElements(list, element => element.type === 'li');

    expect(details.props.open).toBeUndefined();
    expect(typeof details.props.onToggle).toBe('function');
    expect(collectText(summary)).toBe('How requests work');
    expect(items.map(collectText)).toEqual([
      'Selected: You have chosen a preference. expaify does not offer this step.',
      'Sent: The booking service says it submitted the request. Continuing from expaify does not send one.',
      'Acknowledged: The property has replied about the request.',
      'Guaranteed: The property explicitly confirms it for this stay. Until then, treat it as a preference.',
    ]);
    expect(findElements(details, element => element.type === 'button')).toHaveLength(0);
    expect(summary.props.className).toContain('min-h-11');
  });

  it('keeps the provider action before supporting invoice, readiness, and funds evidence', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const sections = findElements(tree, element => element.type === 'section');
    const providerIndex = sections.findIndex(section => section.props['aria-labelledby'] === 'hotel-provider-title');
    const supportingIndex = sections.findIndex(section => section.props['aria-labelledby'] === 'hotel-supporting-title');
    const providerText = collectText(sections[providerIndex]);
    const supportingText = collectText(sections[supportingIndex]);

    expect(providerIndex).toBeGreaterThanOrEqual(0);
    expect(supportingIndex).toBeGreaterThan(providerIndex);
    expect(providerText).toContain('Check rooms at provider');
    expect(providerText).not.toContain('Deposits and card holds');
    expect(providerText).toContain('Taxes and mandatory charges');
    expect(providerText).toContain('Mandatory property chargesNot confirmed for this selected offer.');
    expect(supportingText).toContain('I need an invoice or receipt for this stay');
    expect(supportingText).toContain('What you may need');
    expect(supportingText).toContain('Deposits and card holds');
  });

  it('orders cancellation, Tier 1 modification guidance, and the unchanged outbound handoff', () => {
    const providerUrl = 'https://www.booking.com/hotel/x?aid=123';
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext: { ...hotelContext, providerUrl },
    });
    const providerSection = findElements(tree, element => (
      element.type === 'section'
      && element.props['aria-labelledby'] === 'hotel-provider-title'
    ))[0];
    const children = childrenOf(providerSection).map(child => resolveFunctionElement(child as TestElement)) as TestElement[];
    const cancellationIndex = children.findIndex(child => collectText(child).includes('Cancellation choices unavailable'));
    const modificationIndex = children.findIndex(child => (
      findElements(child, element => element.props['data-hotel-modification-policy'] === 'tier_1_unknown').length > 0
    ));
    const actionIndex = children.findIndex(child => (
      findElements(child, element => element.type === 'a' && element.props.href === providerUrl).length > 0
    ));

    expect(cancellationIndex).toBeGreaterThan(-1);
    expect(modificationIndex).toBeGreaterThan(cancellationIndex);
    expect(actionIndex).toBeGreaterThan(modificationIndex);

    const outbound = findElements(children[actionIndex], element => element.type === 'a')[0];
    expect(outbound.props.href).toBe(providerUrl);
    expect(outbound.props.target).toBe('_blank');
    expect(outbound.props.rel).toBe('noopener noreferrer sponsored');
  });

  it('places static room-view confidence after disclosures and immediately before the provider action', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const providerSection = findElements(tree, element => (
      element.type === 'section'
      && element.props['aria-labelledby'] === 'hotel-provider-title'
    ))[0];
    const roomViewSection = findElements(providerSection, element => (
      element.type === 'section'
      && element.props['aria-labelledby'] === 'hotel-room-view-title'
    ))[0];
    const providerAction = findElements(providerSection, element => element.type === 'a' && element.props.target === '_blank')[0];
    const text = collectText(roomViewSection);

    expect(roomViewSection).toBeDefined();
    expect(text).toContain('View not confirmed');
    expect(roomViewSection.props.role).toBeUndefined();
    expect(roomViewSection.props['aria-live']).toBeUndefined();
    expect(findElements(roomViewSection, element => ['a', 'button', 'input', 'details'].includes(String(element.type)))).toHaveLength(0);
    expect(collectText(providerSection).indexOf(text)).toBeLessThan(collectText(providerSection).indexOf(collectText(providerAction)));
  });

  it('renders traveler readiness as static, neutrally styled supporting guidance', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const readiness = findElements(tree, element => (
      element.type === 'section'
      && element.props['aria-labelledby'] === 'hotel-traveler-readiness-title'
    ))[0];
    const headings = findElements(readiness, element => element.type === 'h3');

    expect(readiness).toBeDefined();
    expect(readiness.props.className).toContain('bg-[color:var(--bg-raised)]');
    expect(readiness.props.className).toContain('sm:px-4');
    expect(readiness.props.className).toContain('sm:py-4');
    expect(readiness.props.role).toBeUndefined();
    expect(readiness.props['aria-live']).toBeUndefined();
    expect(readiness.props.tabIndex).toBeUndefined();
    expect(headings).toHaveLength(1);
    expect(headings[0].props.id).toBe('hotel-traveler-readiness-title');
    expect(findElements(readiness, element => ['input', 'button', 'a', 'details'].includes(String(element.type)))).toHaveLength(0);
  });

  it('places traveler readiness after rate, transport, and parking evidence and before invoice intent', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const supportingSection = findElements(tree, element => (
      element.type === 'section'
      && element.props['aria-labelledby'] === 'hotel-supporting-title'
    ))[0];
    const container = childrenOf(supportingSection)[1] as TestElement;
    const items = (childrenOf(container) as TestElement[]).map(item => resolveFunctionElement(item)) as TestElement[];
    const labelledBy = items.map(item => (
      item && typeof item === 'object' ? (item as TestElement).props?.['aria-labelledby'] : undefined
    ));

    const readinessIndex = labelledBy.indexOf('hotel-traveler-readiness-title');
    const transportIndex = labelledBy.indexOf(`hotel-transport-title-${hotelContext.offerId}-review`);
    const specialRequestsIndex = labelledBy.indexOf('hotel-special-requests-title');
    const invoiceControlIndex = items.findIndex(item => collectText(item).includes('I need an invoice or receipt for this stay'));

    expect(readinessIndex).toBeGreaterThan(-1);
    expect(transportIndex).toBe(1);
    expect(invoiceControlIndex).toBeGreaterThan(-1);
    expect(specialRequestsIndex).toBeGreaterThan(-1);
    expect(readinessIndex).toBe(3);
    expect(invoiceControlIndex).toBeGreaterThan(readinessIndex);
    expect(specialRequestsIndex).toBeGreaterThan(invoiceControlIndex);
  });

  it.each([
    ['search_area', 'Only the searched destination is available. Confirm the property location with the provider.'],
    ['missing', 'No property location details were returned.'],
  ] as const)('preserves the %s location warning without disabling handoff', (precision, warning) => {
    const contextualHotel: BookingHotelContext = {
      ...hotelContext,
      area: undefined,
      location: precision === 'search_area'
        ? { precision, label: 'New York', source: 'search_fallback' }
        : { precision, source: 'unavailable' },
    };
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext: contextualHotel,
    });

    expect(collectText(tree)).toContain(warning);
    const outboundLinks = findElements(tree, element => element.type === 'a' && element.props.target === '_blank');
    expect(outboundLinks).toHaveLength(2);
    expect(outboundLinks.some(element => typeof element.props.onClick === 'function')).toBe(true);
  });

  it('emits the viewed and guarded back analytics events with hostname-only props', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const anchors = findElements(tree, element => element.type === 'a');
    const backLink = anchors.find(element => element.props.href === '/' && typeof element.props.onClick === 'function');

    expect(trackMock).toHaveBeenCalledWith('hotel_handoff_viewed', {
      handoffAttemptId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      priceDisclosureState: 'incomplete',
      stayCostState: 'nightly_only',
      taxState: 'not_returned',
      mandatoryChargeState: 'not_returned',
      source: 'hotellook',
    });

    (backLink?.props.onClick as (() => void))();
    expect(trackMock).toHaveBeenCalledWith('hotel_handoff_back_clicked', expect.objectContaining({
      handoffAttemptId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      priceDisclosureState: 'incomplete',
    }));
  });

  it('emits continue and one bucketed return after a hidden-visible cycle', () => {
    let visibilityState: 'visible' | 'hidden' = 'visible';
    let visibilityListener: (() => void) | undefined;
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        get visibilityState() { return visibilityState; },
        addEventListener: jest.fn((event: string, listener: () => void) => {
          if (event === 'visibilitychange') visibilityListener = listener;
        }),
        removeEventListener: jest.fn(),
      },
    });
    const nowSpy = jest.spyOn(performance, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(9_000);

    try {
      const tree = BookingFlow({
        bookingEnabled: false,
        duffelSandbox: false,
        fareContext: null,
        hotelContext: { ...hotelContext, providerUrl: 'https://www.booking.com/hotel/x?aid=123' },
      });
      const anchors = findElements(tree, element => element.type === 'a');
      const outbound = anchors.find(element => typeof element.props['aria-label'] === 'string' && element.props['aria-label'].startsWith('Check rooms at'));
      const backLink = anchors.find(element => element.props.href === '/' && typeof element.props.onClick === 'function');

      (outbound?.props.onClick as (() => void))();
      expect(trackMock).toHaveBeenCalledWith('hotel_handoff_continue_clicked', expect.objectContaining({
        source: 'hotellook',
        partnerNamed: true,
        priceDisclosureState: 'incomplete',
      }));

      visibilityState = 'hidden';
      visibilityListener?.();
      visibilityState = 'visible';
      visibilityListener?.();
      visibilityListener?.();

      expect(trackMock).toHaveBeenCalledWith('hotel_handoff_returned', expect.objectContaining({
        handoffAttemptId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        priceDisclosureState: 'incomplete',
        awayDurationBucket: '5–30s',
      }));
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_handoff_returned')).toHaveLength(1);
      const lifecycleAttemptIds = trackMock.mock.calls
        .filter(([event]) => ['hotel_handoff_viewed', 'hotel_handoff_continue_clicked', 'hotel_handoff_returned'].includes(event))
        .map(([, props]) => (props as { handoffAttemptId: string }).handoffAttemptId);
      expect(new Set(lifecycleAttemptIds).size).toBe(1);

      (backLink?.props.onClick as (() => void))();
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_handoff_back_clicked')).toHaveLength(0);
    } finally {
      nowSpy.mockRestore();
      if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
      else delete (globalThis as { document?: unknown }).document;
    }
  });

  it('keeps view, back, continue, and return analytics failures isolated from the handoff', () => {
    let visibilityState: 'visible' | 'hidden' = 'visible';
    let visibilityListener: (() => void) | undefined;
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        get visibilityState() { return visibilityState; },
        addEventListener: jest.fn((event: string, listener: () => void) => {
          if (event === 'visibilitychange') visibilityListener = listener;
        }),
        removeEventListener: jest.fn(),
      },
    });
    const nowSpy = jest.spyOn(performance, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(9_000);
    trackMock.mockImplementation(() => { throw new Error('analytics unavailable'); });

    try {
      let tree: ReactElement;
      expect(() => {
        tree = BookingFlow({
          bookingEnabled: false,
          duffelSandbox: false,
          fareContext: null,
          hotelContext: { ...hotelContext, providerUrl: 'https://www.booking.com/hotel/x?aid=123' },
        }) as ReactElement;
      }).not.toThrow();

      const anchors = findElements(tree!, element => element.type === 'a');
      const outbound = anchors.find(element =>
        element.props.target === '_blank' &&
        element.props.href === 'https://www.booking.com/hotel/x?aid=123'
      ) as TestElement;
      const backLink = anchors.find(element => element.props.href === '/' && typeof element.props.onClick === 'function') as TestElement;

      expect(() => (backLink.props.onClick as (() => void))()).not.toThrow();
      expect(() => (outbound.props.onClick as (() => void))()).not.toThrow();
      visibilityState = 'hidden';
      expect(() => visibilityListener?.()).not.toThrow();
      visibilityState = 'visible';
      expect(() => visibilityListener?.()).not.toThrow();

      expect(trackMock.mock.calls.map(([event]) => event)).toEqual(expect.arrayContaining([
        'hotel_handoff_viewed',
        'hotel_handoff_back_clicked',
        'hotel_handoff_continue_clicked',
        'hotel_handoff_returned',
      ]));
      expect(outbound.props.href).toBe('https://www.booking.com/hotel/x?aid=123');
      expect(outbound.props.target).toBe('_blank');
      expect(outbound.props.rel).toBe('noopener noreferrer sponsored');
    } finally {
      trackMock.mockReset();
      nowSpy.mockRestore();
      if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
      else delete (globalThis as { document?: unknown }).document;
    }
  });

  it('emits one coarse invoice-need event and starts one provider-backed check for a rapid duplicate change', async () => {
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ ok: true, data: hotelContext.documentReadiness }),
    });
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true });

    try {
      const tree = BookingFlow({
        bookingEnabled: false,
        duffelSandbox: false,
        fareContext: null,
        hotelContext,
      });
      const checkbox = findElements(tree, element => element.type === 'input' && element.props.type === 'checkbox')[0];
      const change = checkbox.props.onChange as (event: unknown) => void;

      change({ currentTarget: { checked: true } });
      change({ currentTarget: { checked: true } });
      await Promise.resolve();
      await Promise.resolve();

      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_invoice_need_changed')).toEqual([
        ['hotel_invoice_need_changed', { needed: true, source: 'hotellook', partnerNamed: false }],
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const request = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(String(request.body))).toEqual({ hotelContext });
      expect(String(request.body)).toContain('marker=hotel-marker');
      expect(String(request.body)).not.toContain('email');
    } finally {
      if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
      else delete (globalThis as { fetch?: unknown }).fetch;
    }
  });

  it('normalizes unrecognized provider values before emitting invoice analytics', () => {
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    Object.defineProperty(globalThis, 'fetch', {
      value: jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ ok: true, data: hotelContext.documentReadiness }),
      }),
      configurable: true,
    });
    const contextualHotel: BookingHotelContext = {
      ...hotelContext,
      provider: 'property-name-must-not-leak',
    };
    try {
      const tree = BookingFlow({
        bookingEnabled: false,
        duffelSandbox: false,
        fareContext: null,
        hotelContext: contextualHotel,
      });
      const checkbox = findElements(tree, element => element.type === 'input' && element.props.type === 'checkbox')[0];

      (checkbox.props.onChange as (event: unknown) => void)({ currentTarget: { checked: true } });

      expect(trackMock).toHaveBeenCalledWith('hotel_invoice_need_changed', {
        needed: true,
        source: 'other',
        partnerNamed: false,
      });
    } finally {
      if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
      else delete (globalThis as { fetch?: unknown }).fetch;
    }
  });

  it('guards request analytics behind sustained guidance exposure and uses non-sensitive properties', () => {
    jest.useFakeTimers();
    let intersectionCallback: IntersectionObserverCallback | undefined;
    let observedTarget: Element | undefined;
    const disconnect = jest.fn();
    const originalObserver = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver');
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: jest.fn((callback: IntersectionObserverCallback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn((target: Element) => { observedTarget = target; }),
          disconnect,
        };
      }),
    });

    try {
      const providerUrl = 'https://www.booking.com/hotel/private-name?aid=secret-marker';
      const tree = BookingFlow({
        bookingEnabled: false,
        duffelSandbox: false,
        fareContext: null,
        hotelContext: { ...hotelContext, providerUrl },
      });
      const rendered = resolveFunctionElement(tree as TestElement);
      const outbound = findElements(rendered, element => element.type === 'a' && typeof element.props['aria-label'] === 'string' && element.props['aria-label'].startsWith('Check rooms at'))[0];
      const details = findElements(rendered, element => element.type === 'details')[0];

      (outbound.props.onClick as (() => void))();
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_request_handoff_continued')).toHaveLength(0);

      intersectionCallback?.([{
        target: observedTarget,
        isIntersecting: true,
        intersectionRatio: 0.5,
      } as IntersectionObserverEntry], {} as IntersectionObserver);
      jest.advanceTimersByTime(999);
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_request_guidance_viewed')).toHaveLength(0);

      intersectionCallback?.([{
        target: observedTarget,
        isIntersecting: false,
        intersectionRatio: 0,
      } as IntersectionObserverEntry], {} as IntersectionObserver);
      jest.advanceTimersByTime(1);
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_request_guidance_viewed')).toHaveLength(0);

      intersectionCallback?.([{
        target: observedTarget,
        isIntersecting: true,
        intersectionRatio: 0.75,
      } as IntersectionObserverEntry], {} as IntersectionObserver);
      jest.advanceTimersByTime(1_000);
      expect(trackMock).toHaveBeenCalledWith('hotel_request_guidance_viewed', {
        source: 'hotellook',
        partnerHost: 'www.booking.com',
        capabilityState: 'provider_directed_only',
        eligibleRequestCount: 4,
      });

      intersectionCallback?.([{
        target: observedTarget,
        isIntersecting: true,
        intersectionRatio: 1,
      } as IntersectionObserverEntry], {} as IntersectionObserver);
      jest.advanceTimersByTime(1_000);
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_request_guidance_viewed')).toHaveLength(1);

      (details.props.onToggle as (event: unknown) => void)({ currentTarget: { open: true } });
      (details.props.onToggle as (event: unknown) => void)({ currentTarget: { open: true } });
      (details.props.onToggle as (event: unknown) => void)({ currentTarget: { open: false } });
      (details.props.onToggle as (event: unknown) => void)({ currentTarget: { open: true } });
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_request_help_opened')).toEqual([
        ['hotel_request_help_opened', {
          source: 'hotellook',
          partnerHost: 'www.booking.com',
          capabilityState: 'provider_directed_only',
        }],
        ['hotel_request_help_opened', {
          source: 'hotellook',
          partnerHost: 'www.booking.com',
          capabilityState: 'provider_directed_only',
        }],
      ]);

      (outbound.props.onClick as (() => void))();
      expect(trackMock).toHaveBeenCalledWith('hotel_request_handoff_continued', {
        source: 'hotellook',
        partnerHost: 'www.booking.com',
        capabilityState: 'provider_directed_only',
        eligibleRequestCount: 4,
        selectedRequestCount: 0,
        guidanceSeen: true,
      });
      const requestPayloads = trackMock.mock.calls
        .filter(([event]) => String(event).startsWith('hotel_request_'))
        .map(([, props]) => JSON.stringify(props));
      expect(requestPayloads.join(' ')).not.toContain('private-name');
      expect(requestPayloads.join(' ')).not.toContain('secret-marker');
      expect(requestPayloads.join(' ')).not.toContain('The Example Hotel');
      expect(requestPayloads.join(' ')).not.toContain('hotel_123');
    } finally {
      jest.useRealTimers();
      if (originalObserver) Object.defineProperty(globalThis, 'IntersectionObserver', originalObserver);
      else delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    }
  });

  it('does not let analytics failures block request help or provider handoff', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const rendered = resolveFunctionElement(tree as TestElement);
    const details = findElements(rendered, element => element.type === 'details')[0];
    const outbound = findElements(rendered, element => element.type === 'a' && typeof element.props['aria-label'] === 'string' && element.props['aria-label'].startsWith('Check rooms at'))[0];
    trackMock.mockImplementation(() => { throw new Error('analytics unavailable'); });

    expect(() => (details.props.onToggle as (event: unknown) => void)({ currentTarget: { open: true } })).not.toThrow();
    expect(() => (outbound.props.onClick as (() => void))()).not.toThrow();

    trackMock.mockReset();
  });

  it('shows a recoverable hotel-specific error for malformed hotel handoff links', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext: null,
      invalidHotelSelection: true,
    });
    const text = collectText(tree);

    expect(text).toContain("We can't identify this hotel");
    expect(text).toContain('integer-cent price, currency, price basis, and provider handoff URL');
    expect(text).toContain('Back to search');
    expect(text).not.toContain("We can't identify this fare");
    expect(text).not.toContain('What you may need');
    expect(text).not.toContain('Special requests');
    expect(findElements(tree, element => element.type === 'details')).toHaveLength(0);
    expect(findElements(tree, element => element.type === 'a' && element.props.target === '_blank')).toHaveLength(0);
    expect(trackMock.mock.calls.some(([event]) => String(event).startsWith('hotel_request_'))).toBe(false);
  });

  it('relocates the offer-reference helper text so it can never be read as a reservation number', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const text = collectText(tree);

    expect(text).toContain('expaify offer reference');
    expect(text).toContain('Save this with your confirmation. It tells expaify support exactly which rate you were shown — it is not your reservation number.');
    expect(text).not.toContain('Use this reference if you contact expaify support.');
  });

  it('no longer renders the price-mismatch prompt as the first thing a returning traveler sees', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const text = collectText(tree);

    expect(text).not.toContain('Did the partner details match?');
  });
});

describe('BookingFlow return-to-search continuity (REPAIR-BOOKING-RETURN-CONTEXT-01)', () => {
  beforeEach(() => {
    trackMock.mockClear();
  });

  function backToSearchLink(tree: TestElement) {
    return findElements(tree, element => (
      element.type === 'a' && collectText(element).includes('Back to search')
    ))[0];
  }

  it('uses fareContext.returnTo for the initial review "Back to search" link when present', () => {
    const tree = BookingFlow({
      bookingEnabled: true,
      duffelSandbox: false,
      fareContext: { ...oneAdultFareContext, returnTo: '/deals?city=Lisbon&min_discount=30' },
    });

    expect(backToSearchLink(tree).props.href).toBe('/deals?city=Lisbon&min_discount=30');
  });

  it('falls back to / for the initial review "Back to search" link when returnTo is absent', () => {
    const tree = BookingFlow({
      bookingEnabled: true,
      duffelSandbox: false,
      fareContext: oneAdultFareContext,
    });

    expect(backToSearchLink(tree).props.href).toBe('/');
  });

  it('uses fareContext.returnTo for the "booking is paused" recovery action', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: { ...fareContext, returnTo: '/destinations/paris?date_from=2026-10-01' },
    });
    const action = findElements(tree, element => (
      element.type === 'a' && collectText(element) === 'Back to search'
    ))[0];

    expect(action.props.href).toBe('/destinations/paris?date_from=2026-10-01');
  });

  it('falls back to / for the "booking is paused" recovery action when returnTo is absent', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext,
    });
    const action = findElements(tree, element => (
      element.type === 'a' && collectText(element) === 'Back to search'
    ))[0];

    expect(action.props.href).toBe('/');
  });

  it('uses fareContext.returnTo for the multi-passenger recovery action', () => {
    const tree = BookingFlow({
      bookingEnabled: true,
      duffelSandbox: true,
      fareContext: { ...fareContext, returnTo: '/deals?city=Lisbon' },
    });
    const text = collectText(tree);
    const action = findElements(tree, element => (
      element.type === 'a' && collectText(element) === 'Search one passenger'
    ))[0];

    expect(text).toContain('Multi-passenger review is paused');
    expect(action.props.href).toBe('/deals?city=Lisbon');
  });

  it('uses the page-level returnTo prop for the missing-fare recovery link, and falls back to / without it', () => {
    const withReturnTo = BookingFlow({
      bookingEnabled: true,
      duffelSandbox: true,
      fareContext: null,
      returnTo: '/deals?city=Lisbon',
    });
    expect(backToSearchLink(withReturnTo).props.href).toBe('/deals?city=Lisbon');

    const withoutReturnTo = BookingFlow({
      bookingEnabled: true,
      duffelSandbox: true,
      fareContext: null,
    });
    expect(backToSearchLink(withoutReturnTo).props.href).toBe('/');
  });

  it('never uses a page-level returnTo for the hotel-review "Back to results" link (out of scope for this repair)', () => {
    // The hotel handoff review has its own separate `hotelContext.returnUrl`
    // field/validator (`validateHotelReturnUrl`) that this repair does not
    // wire up — see the audit's P2 finding that hotel booking review is a
    // different, not-yet-built product surface in this worktree. Guards
    // against silently expanding scope to the hotel link later.
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext,
      returnTo: '/deals?city=Lisbon',
    });
    const backToResults = findElements(tree, element => (
      element.type === 'a' && collectText(element).includes('Back to results')
    ))[0];

    expect(backToResults.props.href).toBe('/');
  });
});

describe('BookingFlow hotel return-state wiring (D5 recognized-on-mount)', () => {
  beforeEach(() => {
    trackMock.mockClear();
    getStayStubSnapshotMock.mockReset().mockReturnValue(null);
    writeStayStubMock.mockReset().mockReturnValue({ ok: true });
    isStayStorageAvailableMock.mockReset().mockReturnValue(true);
  });

  it('renders the pre-handoff review unchanged when no stub exists for this offer', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const text = collectText(tree);

    expect(getStayStubSnapshotMock).toHaveBeenCalledWith(hotelContext.offerId);
    expect(text).toContain('Check rooms at provider');
    expect(text).not.toContain('You told us you booked this stay');
    expect(text).not.toContain('Book this again');
  });

  it('attaches a ref to the handoff CTA so focus can be redirected there after "I didn\'t book" (S3)', () => {
    // React 19 no longer surfaces `ref` on a separate `element.ref` field —
    // it is a regular prop. This guards the mechanism the design spec
    // requires: after the return-state panel unmounts on "I didn't book",
    // focus must land on the restored handoff CTA, never on <body>.
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const outbound = findElements(tree, element => (
      element.type === 'a' && element.props.target === '_blank' && element.props.href === hotelContext.providerUrl
    ))[0];

    expect(outbound.props.ref).toBeDefined();
    expect('current' in (outbound.props.ref as { current: unknown })).toBe(true);
  });

  it('recognises a prior handoff on mount, demotes the CTA to "Book this again", and warns about a second reservation', () => {
    getStayStubSnapshotMock.mockReturnValue({
      v: 1,
      offerId: hotelContext.offerId,
      provider: 'hotellook',
      partnerHost: 'tp.media',
      partnerLabel: '',
      name: hotelContext.name,
      areaLabel: 'Midtown',
      priceCents: hotelContext.priceCents,
      currency: hotelContext.currency,
      priceBasis: 'per_night_before_taxes_fees',
      providerUrl: hotelContext.providerUrl,
      declaredBookedAt: '2026-08-03T14:14:00.000Z',
      handoffAttemptId: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    });

    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const text = collectText(tree);

    expect(text).toContain('You told us you booked this stay');
    expect(text).toContain('Book this again');
    expect(text).toContain('Booking again creates a second reservation');
    expect(text).not.toContain('Check rooms at provider');

    expect(trackMock).toHaveBeenCalledWith('hotel_return_state_viewed', expect.objectContaining({ stubPresent: true }));
    expect(trackMock).toHaveBeenCalledWith('hotel_repeat_offer_recognized', {
      offerId: hotelContext.offerId,
      entryPath: 'inline',
      rebooked: false,
    });
  });

  it('never re-recognises a stub belonging to a different offer', () => {
    getStayStubSnapshotMock.mockImplementation((offerId: string) => (offerId === 'some-other-offer' ? { v: 1 } : null));

    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });

    expect(collectText(tree)).not.toContain('You told us you booked this stay');
  });
});

describe('HotelSelectionUnavailable / recovery (D5, S5)', () => {
  beforeEach(() => {
    trackMock.mockClear();
    getStayStubSnapshotMock.mockReset().mockReturnValue(null);
  });

  it('falls back to InvalidHotelState, with the added recovery-guidance line, when no offer id is available to recover', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext: null,
      invalidHotelSelection: true,
    });
    const text = collectText(tree);

    expect(text).toContain("We can't identify this hotel");
    expect(text).toContain('If you booked a hotel from this page, your reservation is with the booking partner. Check your email for its confirmation.');
    expect(getStayStubSnapshotMock).not.toHaveBeenCalled();
  });

  it('falls back to InvalidHotelState with the added line when a recoveryOfferId is present but no stub matches it', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext: null,
      invalidHotelSelection: true,
      recoveryOfferId: 'expired-offer',
    });
    const text = collectText(tree);

    expect(getStayStubSnapshotMock).toHaveBeenCalledWith('expired-offer');
    expect(text).toContain("We can't identify this hotel");
    expect(text).toContain('If you booked a hotel from this page, your reservation is with the booking partner.');
  });

  it('renders the stub-only recovery state instead of the dead end when a stub matches the expired reference', () => {
    getStayStubSnapshotMock.mockReturnValue({
      v: 1,
      offerId: 'expired-offer',
      provider: 'hotellook',
      partnerHost: 'www.booking.com',
      partnerLabel: 'Booking.com',
      name: 'The Example Hotel',
      areaLabel: 'Midtown',
      priceCents: 18_900,
      currency: 'USD',
      priceBasis: 'per_night_before_taxes_fees',
      providerUrl: 'https://www.booking.com/hotel/x?aid=123',
      declaredBookedAt: '2026-08-03T14:14:00.000Z',
      handoffAttemptId: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    });

    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext: null,
      invalidHotelSelection: true,
      recoveryOfferId: 'expired-offer',
    });
    const text = collectText(tree);

    expect(text).not.toContain("We can't identify this hotel");
    expect(text).toContain('You told us you booked this stay');
    expect(text).toContain('The Example Hotel');
    expect(text).toContain('expaify keeps offer pages for 30 minutes');
    expect(text).toContain('expaify offer reference');
    expect(text).toContain('expired-offer');

    const outbound = findElements(tree, element => element.type === 'a' && element.props.target === '_blank')[0];
    expect(outbound.props.href).toBe('https://www.booking.com/hotel/x?aid=123');
    expect(outbound.props.rel).toBe('noopener noreferrer sponsored');

    expect(trackMock).toHaveBeenCalledWith('hotel_repeat_offer_recognized', {
      offerId: 'expired-offer',
      entryPath: 'reference_expired',
      rebooked: false,
    });
  });
});

describe('HotelReturnStatePanel (D1, D2, D3, D4, D5, D5b)', () => {
  const namedPartner: HotelPartnerIdentity = {
    host: 'www.booking.com',
    label: 'Booking.com',
    named: true,
    allowlistVerified: true,
  };
  const unnamedPartner: HotelPartnerIdentity = {
    host: 'obscure-host.example',
    label: 'booking partner',
    named: false,
    allowlistVerified: false,
  };
  const declaredStub: HotelStayStub = {
    v: 1,
    offerId: 'hotel_123',
    provider: 'hotellook',
    partnerHost: 'www.booking.com',
    partnerLabel: 'Booking.com',
    name: 'The Example Hotel',
    areaLabel: 'Midtown',
    priceCents: 18_400,
    currency: 'USD',
    priceBasis: 'per_night_before_taxes_fees',
    providerUrl: 'https://www.booking.com/hotel/x?aid=123',
    declaredBookedAt: '2026-08-03T14:14:00.000Z',
    handoffAttemptId: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
  };
  const datedStub: HotelStayStub = {
    ...declaredStub,
    checkIn: '2026-08-14',
    checkOut: '2026-08-16',
    nightCount: 2,
  };
  const noop = () => {};
  const headingRef = { current: null };

  describe('S1 — asking (D1, D2)', () => {
    it('opens outcome-agnostic: never claims a reservation, offers only the two-way choice, and is byte-identical regardless of away-duration', () => {
      const tree = HotelReturnStatePanel({
        phase: 'asking',
        partner: namedPartner,
        stub: null,
        storageAvailable: true,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });
      const text = collectText(tree);

      expect(text).toContain('Back from Booking.com');
      expect(text).toContain('expaify does not receive your reservation from Booking.com');
      expect(text).toContain('I booked');
      expect(text).toContain('I didn’t book');
      expect(text).not.toMatch(/confirmed|booked successfully/i);

      const heading = findElements(tree, element => element.type === 'h2')[0];
      expect(heading.props.id).toBe('hotel-return-title');
      expect(heading.props.tabIndex).toBe(-1);

      const liveRegion = findElements(tree, element => element.props['aria-live'] === 'polite')[0];
      expect(liveRegion.props.role).toBe('status');
      expect(liveRegion.type).not.toBe('h2'); // separate sr-only node, not the heading itself

      const buttons = findElements(tree, element => element.type === 'button');
      expect(buttons.map(collectText)).toEqual(['I booked', 'I didn’t book']);
      buttons.forEach(button => expect(button.props.className).toContain('min-h-11'));
    });

    it('uses unnamed-partner copy when the partner cannot be confidently named', () => {
      const tree = HotelReturnStatePanel({
        phase: 'asking',
        partner: unnamedPartner,
        stub: null,
        storageAvailable: true,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });
      const text = collectText(tree);

      expect(text).toContain('Back from the booking partner');
      expect(text).toContain('expaify does not receive your reservation from the booking partner');
      expect(text).not.toContain('Booking.com');
    });

    it('wires the two choices to their declare handlers', () => {
      const onDeclareBooked = jest.fn();
      const onDeclareNotBooked = jest.fn();
      const tree = HotelReturnStatePanel({
        phase: 'asking',
        partner: namedPartner,
        stub: null,
        storageAvailable: true,
        headingRef,
        onDeclareBooked,
        onDeclareNotBooked,
      });
      const buttons = findElements(tree, element => element.type === 'button');

      (buttons[0].props.onClick as () => void)();
      (buttons[1].props.onClick as () => void)();

      expect(onDeclareBooked).toHaveBeenCalledTimes(1);
      expect(onDeclareNotBooked).toHaveBeenCalledTimes(1);
    });
  });

  describe('S2 — declared (D2, D3, D4, D5b)', () => {
    it('marks the reservation as traveler-declared, never as confirmed, adjacent to "You told us"', () => {
      const tree = HotelReturnStatePanel({
        phase: 'declared',
        partner: namedPartner,
        stub: declaredStub,
        storageAvailable: true,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });
      const text = collectText(tree);

      expect(text).toContain('You told us you booked this stay');
      expect(text).toContain('expaify has not confirmed this with Booking.com');
      expect(text).not.toMatch(/your booking is confirmed/i);
    });

    it('renders exactly four checklist items, framed as what to save, with no input controls', () => {
      const tree = HotelReturnStatePanel({
        phase: 'declared',
        partner: namedPartner,
        stub: declaredStub,
        storageAvailable: true,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });
      const terms = findElements(tree, element => element.type === 'dt').map(collectText);

      expect(terms).toEqual(['Confirmation number', 'Cancellation deadline', 'Property phone number', 'The email address you used']);
      expect(findElements(tree, element => ['input', 'select', 'textarea'].includes(String(element.type)))).toHaveLength(0);
      expect(collectText(tree)).toContain('Booking.com holds this reservation. expaify cannot look it up, change it, or cancel it.');
      expect(collectText(tree)).not.toMatch(/expaify (holds|has received|can retrieve)/i);
    });

    it('renders the stay-dates-absent line rather than a blank or inferred date', () => {
      const tree = HotelReturnStatePanel({
        phase: 'declared',
        partner: namedPartner,
        stub: declaredStub,
        storageAvailable: true,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });

      expect(collectText(tree)).toContain('Stay dates were not provided for this offer.');
    });

    it('renders the dated stay line once check-in/check-out/night-count are all present', () => {
      const tree = HotelReturnStatePanel({
        phase: 'declared',
        partner: namedPartner,
        stub: datedStub,
        storageAvailable: true,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });

      expect(collectText(tree)).toContain('2 nights');
      expect(collectText(tree)).not.toContain('Stay dates were not provided');
    });

    it('shows the offer reference uncollapsed, with a helper denying it is a reservation number', () => {
      const tree = HotelReturnStatePanel({
        phase: 'declared',
        partner: namedPartner,
        stub: declaredStub,
        storageAvailable: true,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });

      expect(findElements(tree, element => element.type === 'details')).toHaveLength(0);
      expect(collectText(tree)).toContain('hotel_123');
      expect(collectText(tree)).toContain('it is not your reservation number');
    });

    it('shows the storage-unavailable line, without error styling, only when storage failed', () => {
      const unavailable = HotelReturnStatePanel({
        phase: 'declared',
        partner: namedPartner,
        stub: declaredStub,
        storageAvailable: false,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });
      const available = HotelReturnStatePanel({
        phase: 'declared',
        partner: namedPartner,
        stub: declaredStub,
        storageAvailable: true,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });

      expect(collectText(unavailable)).toContain('This browser is not saving the stay. Copy the details above before you close this tab.');
      expect(collectText(available)).not.toContain('This browser is not saving the stay');
      expect(findElements(unavailable, element => element.props.role === 'alert')).toHaveLength(0);
    });

    it('reopens the partner only when the stored URL still carries a validated affiliate marker', () => {
      const withMarker = HotelReturnStatePanel({
        phase: 'declared',
        partner: namedPartner,
        stub: declaredStub,
        storageAvailable: true,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });
      const withoutMarker = HotelReturnStatePanel({
        phase: 'declared',
        partner: namedPartner,
        stub: { ...declaredStub, providerUrl: 'https://www.booking.com/hotel/x' },
        storageAvailable: true,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });

      const reopenWithMarker = findElements(withMarker, element => element.type === 'a' && element.props.target === '_blank');
      expect(reopenWithMarker).toHaveLength(1);
      expect(reopenWithMarker[0].props.href).toBe(declaredStub.providerUrl);
      expect(reopenWithMarker[0].props.rel).toBe('noopener noreferrer sponsored');
      expect(findElements(withoutMarker, element => element.type === 'a' && element.props.target === '_blank')).toHaveLength(0);
    });
  });

  describe('S4 — recognized (D5)', () => {
    it('does not repeat the capture checklist on a later, recognised visit', () => {
      const tree = HotelReturnStatePanel({
        phase: 'recognized',
        partner: namedPartner,
        stub: declaredStub,
        storageAvailable: true,
        headingRef,
        onDeclareBooked: noop,
        onDeclareNotBooked: noop,
      });
      const text = collectText(tree);

      expect(text).toContain('You told us you booked this stay');
      expect(text).toContain("Your confirmation is in Booking.com's email. expaify has no copy of it.");
      expect(findElements(tree, element => element.type === 'dt')).toHaveLength(0);
    });
  });

  it('returns null rather than an empty panel when no stub is available for declared/recognized', () => {
    expect(HotelReturnStatePanel({
      phase: 'declared',
      partner: namedPartner,
      stub: null,
      storageAvailable: true,
      headingRef,
      onDeclareBooked: noop,
      onDeclareNotBooked: noop,
    })).toBeNull();
    expect(HotelReturnStatePanel({
      phase: 'recognized',
      partner: namedPartner,
      stub: null,
      storageAvailable: true,
      headingRef,
      onDeclareBooked: noop,
      onDeclareNotBooked: noop,
    })).toBeNull();
  });
});
