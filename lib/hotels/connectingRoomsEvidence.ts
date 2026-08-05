import type { HotelAmenityEvidence } from '../types';

/**
 * Connecting-room confidence, derived from the EXISTING, shipped
 * `room_pref_connecting` fact inside `HotelAmenityEvidence` (added by
 * `DEV-HOTEL-ACCESS-REQUIREMENTS-01`; normalized in
 * `lib/providers/hotelAmenityEvidence.ts`; first rendered in
 * `app/components/HotelCard.tsx`'s `AccessEvidencePanel`).
 *
 * `hotel-adjoining-rooms` does not define a new evidence type. Its job is to
 * put this one, already-tested fact in front of a real user: `HotelCard` is
 * never mounted anywhere live (see
 * `docs/pipeline/hotel-adjoining-rooms/02-research.md`'s STOP banner), so the
 * fact has shipped code and shipped tests but zero live readers. This module
 * re-derives the same guaranteed / requestable / unavailable / unknown /
 * not_returned resolution HotelCard's private `normalizeAccessEvidence`
 * already applies to `room_pref_connecting`, narrowed to this one fact id, so
 * a second mount point (the deal detail page) can render it without forking
 * the underlying contract. Copy strings below are reproduced verbatim from
 * `docs/pipeline/hotel-access-requirements/03-design.md` §3.2–§3.4 and
 * `HotelCard.tsx`'s `getConfirmedCopy`/`getUnavailableCopy` — the ratified,
 * shipped copy for this fact — not new wording invented for this ticket.
 */

export const CONNECTING_ROOMS_FACT_ID = 'room_pref_connecting' as const;
export const CONNECTING_ROOMS_LABEL = 'Connecting rooms';

/** Shipped verbatim in HotelCard.tsx; reproduced here so a second mount point
 * uses the exact same non-guarantee clause rather than a paraphrase. */
export const NON_GUARANTEE_CLAUSE = 'Request only — not guaranteed until the provider confirms.';

/** Static disclaimer, distinguishing this fact from occupancy/bed-config
 * facts owned by hotel-room-occupancy / hotel-bed-configuration. */
export const CONNECTING_ROOMS_SCOPE_CAVEAT =
  'This is separate from how many guests a room fits and what beds it has.';

export type ConnectingRoomsResolvedStatus = 'confirmed' | 'unavailable' | 'not_returned' | 'unknown';

export interface ResolvedConnectingRoomsEvidence {
  status: ConnectingRoomsResolvedStatus;
  /** Present only when status is 'confirmed'. */
  certainty?: 'guaranteed' | 'requestable';
  sourceLabel: string;
  fetchedAt?: string;
}

function hasEvidenceSource(sourceLabel: unknown): sourceLabel is string {
  return typeof sourceLabel === 'string' && sourceLabel.trim().length > 0;
}

const RESOLVED_STATUS_PRECEDENCE: Record<ConnectingRoomsResolvedStatus, number> = {
  unavailable: 0,
  unknown: 1,
  not_returned: 2,
  confirmed: 3,
};

/** Applies the same guaranteed/requestable/unavailable/unknown downgrade rules
 * HotelCard's `normalizeAccessEvidence` applies to `room_pref_connecting`, to
 * exactly one candidate item. Must run before precedence comparison across
 * candidates — comparing raw statuses first (and only normalizing the winner)
 * would let a `confirmed`-but-invalid item beat a plain `not_returned` item
 * even though HotelCard would have downgraded it to `unknown` and lost that
 * comparison. */
function resolveOneCandidate(item: HotelAmenityEvidence): ResolvedConnectingRoomsEvidence {
  const hasValidScope = item.scope === 'room' || item.scope === 'selected_stay';

  if (item.status !== 'confirmed') {
    if (item.status === 'unavailable' && (!hasEvidenceSource(item.sourceLabel) || !hasValidScope)) {
      return { status: 'unknown', sourceLabel: item.sourceLabel ?? 'Hotel provider', fetchedAt: item.fetchedAt };
    }
    return {
      status: item.status,
      sourceLabel: item.sourceLabel ?? 'Hotel provider',
      fetchedAt: item.fetchedAt,
    };
  }

  const hasValidSource = hasEvidenceSource(item.sourceLabel);
  const isGuaranteed = item.scope === 'selected_stay' && item.certainty === 'guaranteed';
  const isRequestable = hasValidScope && item.certainty === 'requestable';

  if (!hasValidSource || (!isGuaranteed && !isRequestable)) {
    return { status: 'unknown', sourceLabel: item.sourceLabel ?? 'Hotel provider', fetchedAt: item.fetchedAt };
  }

  return {
    status: 'confirmed',
    certainty: isGuaranteed ? 'guaranteed' : 'requestable',
    sourceLabel: item.sourceLabel!.trim(),
    fetchedAt: item.fetchedAt,
  };
}

/** Picks the `room_pref_connecting` item(s) out of a hotel's amenity evidence
 * collection and resolves them into the same guaranteed/requestable/
 * unavailable/unknown/not_returned model HotelCard already applies. If the
 * array carries duplicates (e.g. a future multi-provider merge), every
 * candidate is normalized first and the most conservative *normalized*
 * result wins — unavailable, then unknown, then not_returned, then confirmed
 * — mirroring `lib/providers/hotelAmenityEvidence.ts`'s own precedence.
 * Absence of the fact (undefined array, or the fact never present) resolves
 * to an explicit `not_returned` object — never `undefined` — so a missing
 * field is never silently indistinguishable from "checked and found
 * nothing." */
export function resolveConnectingRoomsEvidence(
  amenityEvidence?: readonly HotelAmenityEvidence[]
): ResolvedConnectingRoomsEvidence {
  const candidates = (amenityEvidence ?? []).filter(item => item.id === CONNECTING_ROOMS_FACT_ID);

  if (candidates.length === 0) {
    return { status: 'not_returned', sourceLabel: 'Hotel provider' };
  }

  let best: ResolvedConnectingRoomsEvidence | null = null;
  for (const item of candidates) {
    const resolved = resolveOneCandidate(item);
    if (!best || RESOLVED_STATUS_PRECEDENCE[resolved.status] < RESOLVED_STATUS_PRECEDENCE[best.status]) {
      best = resolved;
    }
  }
  return best!;
}

function formatUpdatedDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function getConnectingRoomsConfirmedCopy(
  evidence: ResolvedConnectingRoomsEvidence
): { visible: string; aria: string } {
  const provider = evidence.sourceLabel.trim();
  if (evidence.certainty === 'requestable') {
    return {
      visible: `You can request connecting rooms. ${NON_GUARANTEE_CLAUSE}`,
      aria: `Connecting rooms can be requested. ${NON_GUARANTEE_CLAUSE}`,
    };
  }
  return {
    visible: 'The provider guarantees connecting rooms for this selected stay.',
    aria: `Connecting rooms. Guaranteed for this selected stay by ${provider}.`,
  };
}

export const CONNECTING_ROOMS_UNAVAILABLE_COPY =
  'The provider states connecting rooms cannot be requested for this stay.';

export const CONNECTING_ROOMS_UNKNOWN_COPY =
  "Connecting rooms: the provider's information is unclear. Confirm directly before booking.";

export const CONNECTING_ROOMS_NOT_RETURNED_COPY =
  'Connecting-room details were not documented by this provider. Confirm directly with the property before booking.';

export const CONNECTING_ROOMS_LOADING_COPY = 'Checking connecting-room details…';

export const CONNECTING_ROOMS_ERROR_COPY =
  'Connecting-room details could not be checked. Confirm directly with the property before booking.';

/** Mirrors HotelCard's `getEvidenceMetadata`, narrowed to this one fact. */
export function getConnectingRoomsMetadata(evidence: ResolvedConnectingRoomsEvidence): string[] {
  const metadata: string[] = [];

  if (evidence.status === 'confirmed' && evidence.certainty === 'guaranteed') {
    metadata.push('Confirmed for this selected stay.');
  }

  if (evidence.status === 'confirmed' || evidence.status === 'unavailable') {
    const updated = evidence.fetchedAt ? formatUpdatedDate(evidence.fetchedAt) : null;
    if (hasEvidenceSource(evidence.sourceLabel)) {
      metadata.push(`Source: ${evidence.sourceLabel.trim()}.${updated ? ` Updated ${updated}.` : ''}`);
    }
  }

  return metadata;
}
