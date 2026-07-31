import type { HotelFundsPolicyBridge } from '../types';
import { normalizeHotelFundsPolicyBridge } from './fundsPolicy';

/**
 * Legacy deal rows have no trustworthy provider capability. Keep the bridge
 * absent so consumers make no set-level or offer-level policy claim.
 */
export function normalizePersistedDealFundsPolicyBridge(input: unknown): HotelFundsPolicyBridge | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined;
  return normalizeHotelFundsPolicyBridge(input);
}
