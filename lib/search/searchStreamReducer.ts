import type {
  HotelOffer,
  HotelSearchCoverage,
  NormalizedFare,
  ProviderNotice,
} from '@/lib/types';

/**
 * Client-side accumulator for the NDJSON stream emitted by GET /api/search
 * (see app/api/search/route.ts's doc comment for the wire contract). Only
 * the result event types used by the flights page are accumulated here.
 * Hotel inventory retains the route's availability message and pagination
 * coverage separately from its offers; access and smoking-policy checks keep
 * their independent stream lifecycles so a failed sub-check never erases a
 * usable hotel. `flight-date-coverage` remains intentionally unhandled until
 * this page has a consumer for it.
 */
export type HotelInventoryStatus = {
  status: 'available' | 'empty' | 'unavailable' | 'skipped';
  message?: string;
};

export type HotelSubCheckStatus = {
  status: 'loading' | 'ready' | 'error' | 'skipped';
  message?: string;
};

export type SearchStreamState = {
  flights: NormalizedFare[];
  hotels: HotelOffer[];
  hotelCoverage: HotelSearchCoverage | null;
  hotelStatus: HotelInventoryStatus | null;
  hotelAccessStatus: HotelSubCheckStatus | null;
  hotelSmokingPolicyStatus: HotelSubCheckStatus | null;
  providerNotices: ProviderNotice[];
  suggestion: string | null;
  done: boolean;
};

export const initialSearchStreamState: SearchStreamState = {
  flights: [],
  hotels: [],
  hotelCoverage: null,
  hotelStatus: null,
  hotelAccessStatus: null,
  hotelSmokingPolicyStatus: null,
  providerNotices: [],
  suggestion: null,
  done: false,
};

const PROVIDER_NOTICE_STATUSES = new Set<ProviderNotice['status']>([
  'unavailable',
  'no_supply',
  'malformed_response',
]);

function isProviderNoticeStatus(value: unknown): value is ProviderNotice['status'] {
  return typeof value === 'string' && PROVIDER_NOTICE_STATUSES.has(value as ProviderNotice['status']);
}

const HOTEL_COVERAGE = new Set<HotelSearchCoverage>([
  'more_available',
  'confirmed_end',
  'unconfirmed',
]);
const HOTEL_INVENTORY_STATUSES = new Set<HotelInventoryStatus['status']>([
  'available',
  'empty',
  'unavailable',
  'skipped',
]);
const HOTEL_SUB_CHECK_STATUSES = new Set<HotelSubCheckStatus['status']>([
  'loading',
  'ready',
  'error',
  'skipped',
]);

function optionalMessage(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function applySearchStreamEvent(state: SearchStreamState, event: unknown): SearchStreamState {
  if (!event || typeof event !== 'object' || !('type' in event)) return state;
  const type = (event as { type: unknown }).type;

  if (type === 'flights') {
    const data = (event as { data?: unknown }).data;
    if (!Array.isArray(data)) return state;
    return { ...state, flights: [...state.flights, ...(data as NormalizedFare[])] };
  }

  if (type === 'hotels') {
    const hotelEvent = event as { data?: unknown; page?: { coverage?: unknown } };
    if (!Array.isArray(hotelEvent.data)) return state;
    const coverage = hotelEvent.page?.coverage;
    return {
      ...state,
      hotels: [...state.hotels, ...(hotelEvent.data as HotelOffer[])],
      hotelCoverage: HOTEL_COVERAGE.has(coverage as HotelSearchCoverage)
        ? coverage as HotelSearchCoverage
        : state.hotelCoverage,
    };
  }

  if (type === 'hotel-status') {
    const hotelEvent = event as { status?: unknown; coverage?: unknown; message?: unknown };
    if (!HOTEL_INVENTORY_STATUSES.has(hotelEvent.status as HotelInventoryStatus['status'])) return state;
    return {
      ...state,
      hotelStatus: {
        status: hotelEvent.status as HotelInventoryStatus['status'],
        message: optionalMessage(hotelEvent.message),
      },
      hotelCoverage: HOTEL_COVERAGE.has(hotelEvent.coverage as HotelSearchCoverage)
        ? hotelEvent.coverage as HotelSearchCoverage
        : state.hotelCoverage,
    };
  }

  if (type === 'hotel-access-status' || type === 'hotel-smoking-policy-status') {
    const statusEvent = event as { status?: unknown; message?: unknown };
    if (!HOTEL_SUB_CHECK_STATUSES.has(statusEvent.status as HotelSubCheckStatus['status'])) return state;
    const status = {
      status: statusEvent.status as HotelSubCheckStatus['status'],
      message: optionalMessage(statusEvent.message),
    };
    return type === 'hotel-access-status'
      ? { ...state, hotelAccessStatus: status }
      : { ...state, hotelSmokingPolicyStatus: status };
  }

  if (type === 'notice') {
    const notice = event as { provider?: unknown; status?: unknown; message?: unknown };
    if (
      typeof notice.provider !== 'string' ||
      typeof notice.message !== 'string' ||
      !isProviderNoticeStatus(notice.status)
    ) {
      return state;
    }
    return {
      ...state,
      providerNotices: [
        ...state.providerNotices,
        { provider: notice.provider, status: notice.status, message: notice.message },
      ],
    };
  }

  if (type === 'suggestion') {
    const message = (event as { message?: unknown }).message;
    if (typeof message !== 'string') return state;
    return { ...state, suggestion: message };
  }

  if (type === 'done') {
    return { ...state, done: true };
  }

  return state;
}
