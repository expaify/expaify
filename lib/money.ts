import type { Money } from './types'

export function isValidMoney(value: Money | null | undefined): value is Money {
  return (
    value !== null &&
    value !== undefined &&
    Number.isInteger(value.priceCents) &&
    value.priceCents > 0 &&
    typeof value.currency === 'string' &&
    /^[A-Z]{3}$/i.test(value.currency.trim())
  )
}

export function formatMoney(money: Money): string {
  const priceCents = money.priceCents
  const currency = money.currency.trim().toUpperCase()
  const amount = priceCents / 100
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
  }).format(amount)

  return `${formatted} ${currency}`
}
