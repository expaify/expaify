import type { HotelFundsPolicyBridge } from '../types';
import { createUnsupportedHotelFundsPolicyBridge } from './fundsPolicy';

/**
 * Historical deal rows predate provider-policy persistence and do not retain a
 * trustworthy policy-capable source. Treat that legacy boundary as unsupported
 * instead of inferring capability from OTA links or hotel identity.
 */
export function createDealFundsPolicyBridge(): HotelFundsPolicyBridge {
  return createUnsupportedHotelFundsPolicyBridge('other', 'Hotel provider');
}
