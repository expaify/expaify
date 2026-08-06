import type { NormalizedFare, ProviderNotice } from '@/lib/types';

/**
 * Client-side accumulator for the NDJSON stream emitted by GET /api/search
 * (see app/api/search/route.ts's doc comment for the wire contract). Only
 * the event types the flights page renders (`flights`, `notice`,
 * `suggestion`, `done`) are handled here — `flight-date-coverage` and the
 * `hotel-*`/`hotels` events are part of the same shared stream but are out
 * of scope for this page, so they're intentionally left unhandled rather
 * than guessed at.
 */
export type SearchStreamState = {
  flights: NormalizedFare[];
  providerNotices: ProviderNotice[];
  suggestion: string | null;
  done: boolean;
};

export const initialSearchStreamState: SearchStreamState = {
  flights: [],
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

export function applySearchStreamEvent(state: SearchStreamState, event: unknown): SearchStreamState {
  if (!event || typeof event !== 'object' || !('type' in event)) return state;
  const type = (event as { type: unknown }).type;

  if (type === 'flights') {
    const data = (event as { data?: unknown }).data;
    if (!Array.isArray(data)) return state;
    return { ...state, flights: [...state.flights, ...(data as NormalizedFare[])] };
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
