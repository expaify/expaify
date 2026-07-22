import { query } from '../db/client';

export type AnalyticsValue = string | number | boolean;
export type AnalyticsEvent = { event: string; props: Record<string, AnalyticsValue> };

const EVENT_PATTERN = /^[a-z][a-z0-9_]{1,79}$/;
const PROPERTY_PATTERN = /^[a-z][A-Za-z0-9]{0,63}$/;
const MAX_PROPERTIES = 40;

function isAnalyticsValue(value: unknown): value is AnalyticsValue {
  return typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' && value.length <= 200);
}

export function validateAnalyticsEvent(value: unknown): AnalyticsEvent | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { event?: unknown; props?: unknown };
  if (typeof candidate.event !== 'string' || !EVENT_PATTERN.test(candidate.event)) return null;
  if (!candidate.props || typeof candidate.props !== 'object' || Array.isArray(candidate.props)) return null;
  const entries = Object.entries(candidate.props as Record<string, unknown>);
  if (entries.length > MAX_PROPERTIES) return null;
  if (entries.some(([key, propertyValue]) => !PROPERTY_PATTERN.test(key) || !isAnalyticsValue(propertyValue))) return null;

  return { event: candidate.event, props: Object.fromEntries(entries) as Record<string, AnalyticsValue> };
}

export async function writeAnalyticsEvent(value: AnalyticsEvent): Promise<void> {
  await query(
    'INSERT INTO analytics_events (event_name, properties) VALUES ($1, $2::jsonb)',
    [value.event, JSON.stringify(value.props)],
  );
}
