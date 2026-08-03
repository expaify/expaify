import type { HotelFundsPolicyBridge } from '../types';
import { normalizeHotelFundsPolicyBridge } from './fundsPolicy';

/**
 * Legacy deal rows have no trustworthy provider capability. Keep the bridge
 * absent so consumers make no set-level or offer-level policy claim.
 */
export function normalizePersistedDealFundsPolicyBridge(input: unknown): HotelFundsPolicyBridge | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined;
  const record = input as Record<string, unknown>;
  const capability = record.capability;
  if (
    typeof record.provider !== 'string'
    || record.provider.trim().length === 0
    || record.provider.trim().length > 120
    || typeof capability !== 'object'
    || capability === null
    || Array.isArray(capability)
    || typeof (capability as Record<string, unknown>).policy !== 'boolean'
    || typeof record.evidence !== 'object'
    || record.evidence === null
    || Array.isArray(record.evidence)
    || (record.loadState !== 'loading' && record.loadState !== 'ready' && record.loadState !== 'error')
  ) return undefined;
  return normalizeHotelFundsPolicyBridge(input);
}
