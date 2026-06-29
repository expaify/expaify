/**
 * Convert an amount (expressed in source-currency minor units / cents) to USD cents.
 *
 * Rates (MVP hardcoded):
 *   RUB → USD  1 RUB = 0.011 USD  →  1 RUB-cent * 0.011 = 0.011 USD-cents
 *
 * Any other currency is passed through unchanged (assumed to already be USD cents).
 */
export function convertToUSD(amountCents: number, fromCurrency: string): number {
  if (fromCurrency === 'RUB') {
    return Math.round(amountCents * 0.011);
  }
  return amountCents;
}
