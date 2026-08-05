import {
  deriveHotelPaymentAcceptancePresentation,
  HOTEL_PAYMENT_ACCEPTANCE_UNSUPPORTED,
} from '../paymentAcceptance'
import type { HotelPaymentAcceptanceEvidence } from '../../types'

const FULL_CAPABILITY = {
  cardRequiredAtProperty: true,
  instrumentClasses: true,
  bookingGateDivergence: true,
}

const baseEvidence: HotelPaymentAcceptanceEvidence = {
  scope: 'property',
  propertyId: 'hotel-1',
  supplier: 'hotellook',
  loadState: 'ready',
  fetchedAt: '2026-07-22T10:00:00Z',
  cardRequiredAtProperty: 'required',
  instruments: {
    credit_card: 'accepted',
    debit_card: 'not_accepted',
    prepaid_card: 'not_accepted',
    cash: 'accepted',
  },
  bookingGateDivergence: 'differs',
  sourceLabel: 'Hotellook',
}

function derive(overrides: Partial<Parameters<typeof deriveHotelPaymentAcceptancePresentation>[0]> = {}) {
  return deriveHotelPaymentAcceptancePresentation({
    propertyId: 'hotel-1',
    supplier: 'hotellook',
    providerName: 'Hotellook',
    evidence: baseEvidence,
    capability: FULL_CAPABILITY,
    ...overrides,
  })
}

describe('deriveHotelPaymentAcceptancePresentation', () => {
  it('renders every row as not_confirmed when evidence is absent, matching capability-false (§4.4)', () => {
    const presentation = deriveHotelPaymentAcceptancePresentation({
      propertyId: 'hotel-1',
      supplier: 'hotellook',
      providerName: 'Hotellook',
    })
    if (presentation.state !== 'ready') throw new Error('expected ready state')
    expect(presentation.rows).toHaveLength(6)
    expect(presentation.rows.every(row => row.tone === 'not_confirmed')).toBe(true)
    expect(presentation.cardRequiredWarning).toBe(false)
    expect(presentation.provenance).toBe('Source: Hotellook · Scope not confirmed')
  })

  it('gates every fact to not_confirmed when capability is HOTEL_PAYMENT_ACCEPTANCE_UNSUPPORTED, even with full evidence present', () => {
    const presentation = derive({ capability: HOTEL_PAYMENT_ACCEPTANCE_UNSUPPORTED })
    if (presentation.state !== 'ready') throw new Error('expected ready state')
    expect(presentation.rows.every(row => row.tone === 'not_confirmed')).toBe(true)
    expect(presentation.cardRequiredWarning).toBe(false)
  })

  it('degrades every fact to not_confirmed on propertyId mismatch, never leaking mismatched evidence', () => {
    const presentation = derive({ propertyId: 'hotel-2' })
    if (presentation.state !== 'ready') throw new Error('expected ready state')
    expect(presentation.rows.every(row => row.tone === 'not_confirmed')).toBe(true)
  })

  it('degrades every fact to not_confirmed on supplier mismatch', () => {
    const presentation = derive({ supplier: 'hotelbeds' })
    if (presentation.state !== 'ready') throw new Error('expected ready state')
    expect(presentation.rows.every(row => row.tone === 'not_confirmed')).toBe(true)
  })

  it('renders confirmed facts with correct tone and copy when capability and evidence agree', () => {
    const presentation = derive()
    if (presentation.state !== 'ready') throw new Error('expected ready state')
    const byId = Object.fromEntries(presentation.rows.map(row => [row.id, row]))

    expect(byId.card_required_at_property.tone).toBe('confirmed_positive')
    expect(byId.card_required_at_property.sentence).toBe('Hotellook says this property requires a credit card at check-in.')
    expect(byId.credit_card.tone).toBe('confirmed_positive')
    expect(byId.credit_card.sentence).toBe('Hotellook says credit cards are accepted at this property.')
    expect(byId.debit_card.tone).toBe('confirmed_negative')
    expect(byId.debit_card.sentence).toBe('Hotellook says debit cards are not accepted at this property.')
    expect(byId.cash.tone).toBe('confirmed_positive')
    expect(byId.cash.sentence).toBe('Hotellook says cash is accepted at this property.')
    expect(byId.booking_gate_divergence.tone).toBe('confirmed_negative')
    expect(byId.booking_gate_divergence.sentence).toContain('may require different payment methods')
  })

  it('sets cardRequiredWarning only when card_required_at_property resolves to required', () => {
    const required = derive()
    if (required.state !== 'ready') throw new Error('expected ready state')
    expect(required.cardRequiredWarning).toBe(true)

    const notRequired = derive({ evidence: { ...baseEvidence, cardRequiredAtProperty: 'not_required' } })
    if (notRequired.state !== 'ready') throw new Error('expected ready state')
    expect(notRequired.cardRequiredWarning).toBe(false)
  })

  it('a populated conflict object forces that row to conflicting tone regardless of its top-level value', () => {
    const presentation = derive({
      evidence: {
        ...baseEvidence,
        cardRequiredConflict: {
          sourceLabelA: 'Hotellook',
          valueA: 'required',
          sourceLabelB: 'Hotelbeds',
          valueB: 'not_required',
        },
      },
    })
    if (presentation.state !== 'ready') throw new Error('expected ready state')
    const cardRow = presentation.rows.find(row => row.id === 'card_required_at_property')!
    expect(cardRow.tone).toBe('conflicting')
    expect(cardRow.sentence).toBe(
      'Providers disagree on this. Hotellook says required; Hotelbeds says not required. expaify cannot determine which applies — confirm with the property before you travel.'
    )
    // A row-scoped conflict must not force a warning banner that implies a confirmed requirement.
    expect(presentation.cardRequiredWarning).toBe(false)
  })

  it('suppresses a conflict when capability for that fact family is false', () => {
    const presentation = derive({
      capability: { ...FULL_CAPABILITY, cardRequiredAtProperty: false },
      evidence: {
        ...baseEvidence,
        cardRequiredConflict: {
          sourceLabelA: 'Hotellook',
          valueA: 'required',
          sourceLabelB: 'Hotelbeds',
          valueB: 'not_required',
        },
      },
    })
    if (presentation.state !== 'ready') throw new Error('expected ready state')
    const cardRow = presentation.rows.find(row => row.id === 'card_required_at_property')!
    expect(cardRow.tone).toBe('not_confirmed')
  })

  it('gates all four instrument classes together off one capability flag', () => {
    const presentation = derive({ capability: { ...FULL_CAPABILITY, instrumentClasses: false } })
    if (presentation.state !== 'ready') throw new Error('expected ready state')
    for (const id of ['credit_card', 'debit_card', 'prepaid_card', 'cash'] as const) {
      expect(presentation.rows.find(row => row.id === id)!.tone).toBe('not_confirmed')
    }
    // Independently-gated facts are unaffected.
    expect(presentation.rows.find(row => row.id === 'card_required_at_property')!.tone).toBe('confirmed_positive')
  })

  it('produces the correct status line for zero, partial, and full confirmation', () => {
    const zero = deriveHotelPaymentAcceptancePresentation({ propertyId: 'hotel-1', supplier: 'hotellook', providerName: 'Hotellook' })
    if (zero.state !== 'ready') throw new Error('expected ready state')
    expect(zero.statusLine).toContain('has not confirmed payment acceptance at the property for this stay')

    const partial = derive({ capability: { ...FULL_CAPABILITY, instrumentClasses: false, bookingGateDivergence: false } })
    if (partial.state !== 'ready') throw new Error('expected ready state')
    expect(partial.statusLine).toContain('confirmed some payment-acceptance facts')

    const complete = derive()
    if (complete.state !== 'ready') throw new Error('expected ready state')
    expect(complete.statusLine).toBe('Hotellook confirmed payment acceptance at the property for this stay.')
  })

  it('passes through loading and error load states without evaluating facts', () => {
    expect(deriveHotelPaymentAcceptancePresentation({
      propertyId: 'hotel-1', supplier: 'hotellook', providerName: 'Hotellook',
      evidence: { ...baseEvidence, loadState: 'loading' },
    })).toEqual({ state: 'loading' })
    expect(deriveHotelPaymentAcceptancePresentation({
      propertyId: 'hotel-1', supplier: 'hotellook', providerName: 'Hotellook',
      evidence: { ...baseEvidence, loadState: 'error' },
    })).toEqual({ state: 'error' })
  })

  it('renders scope and checked date in provenance when both are valid', () => {
    const presentation = derive()
    if (presentation.state !== 'ready') throw new Error('expected ready state')
    expect(presentation.provenance).toBe('Source: Hotellook · Property-level policy · Checked Jul 22, 2026')
  })

  it('falls back to a generic provider name when blank or oversized', () => {
    const blank = derive({ providerName: '' })
    if (blank.state !== 'ready') throw new Error('expected ready state')
    expect(blank.statusLine.startsWith('The booking provider')).toBe(true)

    const oversized = derive({ providerName: 'x'.repeat(200) })
    if (oversized.state !== 'ready') throw new Error('expected ready state')
    expect(oversized.statusLine.startsWith('The booking provider')).toBe(true)
  })

  it('HOTEL_PAYMENT_ACCEPTANCE_UNSUPPORTED declares every fact family unsupported', () => {
    expect(HOTEL_PAYMENT_ACCEPTANCE_UNSUPPORTED).toEqual({
      cardRequiredAtProperty: false,
      instrumentClasses: false,
      bookingGateDivergence: false,
    })
  })
})
