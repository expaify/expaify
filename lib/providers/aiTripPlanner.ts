import { Result } from '../types';
import { fetchWithProviderTimeout } from './timeout';

const HOST = 'ai-trip-planner.p.rapidapi.com';
const BASE_URL = `https://${HOST}`;

export interface AiDayPlanActivity {
  time: string;
  description: string;
}

export interface AiDayPlan {
  destination: string;
  day: number;
  activities: AiDayPlanActivity[];
}

interface AiTripPlannerResponse {
  plan?: {
    day?: unknown;
    activities?: unknown;
  };
}

function isAiTripPlannerResponse(value: unknown): value is AiTripPlannerResponse {
  return typeof value === 'object' && value !== null && 'plan' in value;
}

function isAiDayPlanActivity(value: unknown): value is AiDayPlanActivity {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { time?: unknown }).time === 'string' &&
    typeof (value as { description?: unknown }).description === 'string'
  );
}

// This RapidAPI account's key is deployed as RAPIDAPI_KEY_PRICELINE (same
// account/subscription bundle that also includes this AI Trip Planner
// listing -- see AUDIT-RAPIDAPI-NEW-SUBSCRIPTIONS-01). Reusing it here
// avoids provisioning a redundant secret for the same underlying key.
function apiKey(): string {
  return process.env.RAPIDAPI_KEY_PRICELINE ?? '';
}

/**
 * Fetches an AI-generated day plan for a destination.
 *
 * Confirmed live (this session) that this API always returns exactly one
 * day's worth of activities no matter what `days` value is requested --
 * there is no real multi-day itinerary behind this endpoint. Callers must
 * not present this as more than a single-day suggestion.
 */
export async function getAiDayPlan(destination: string): Promise<Result<AiDayPlan>> {
  const trimmedDestination = destination.trim();
  if (!trimmedDestination) return { ok: true, data: { destination: trimmedDestination, day: 1, activities: [] } };

  const key = apiKey();
  if (!key) return { ok: false, reason: 'AI Trip Planner not configured' };

  try {
    const url = `${BASE_URL}/?days=1&destination=${encodeURIComponent(trimmedDestination)}`;
    const res = await fetchWithProviderTimeout('AiTripPlanner', url, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': HOST,
      },
    });

    if (!res.ok) {
      return { ok: false, reason: `AI Trip Planner HTTP ${res.status}` };
    }

    const json = await res.json();
    if (!isAiTripPlannerResponse(json)) {
      return { ok: false, reason: 'AI Trip Planner returned a malformed response' };
    }

    const activitiesRaw = json.plan?.activities;
    if (!Array.isArray(activitiesRaw) || !activitiesRaw.every(isAiDayPlanActivity)) {
      return { ok: false, reason: 'AI Trip Planner returned a malformed response' };
    }

    const day = typeof json.plan?.day === 'number' ? json.plan.day : 1;

    return {
      ok: true,
      data: {
        destination: trimmedDestination,
        day,
        activities: activitiesRaw,
      },
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
