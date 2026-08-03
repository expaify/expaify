import { renderToStaticMarkup } from 'react-dom/server'
import {
  deriveGuestIdentityPresentation,
  HotelGuestIdentityRules,
  type GuestIdentityPresentation,
} from '../HotelGuestIdentityRules'

const base: GuestIdentityPresentation = {
  state: 'ready',
  scope: 'property',
  affectedParty: { value: 'lead_guest', state: 'confirmed' },
  identityDocument: { state: 'confirmed' },
  paymentNameMatch: { state: 'not_established' },
  statements: [{
    id: 'id-1',
    sourceLabel: 'Acme Hotels',
    sourceText: 'Government-issued photo identification is required at check-in.',
    observedAt: '2026-07-30T12:00:00.000Z',
  }],
  sourceLabel: 'Acme Hotels',
  fetchedAt: '2026-07-30T12:00:00.000Z',
}

function render(presentation: GuestIdentityPresentation) {
  return renderToStaticMarkup(<HotelGuestIdentityRules presentation={presentation} />)
}

describe('HotelGuestIdentityRules', () => {
  it('renders the production Hotellook omission as explicit unknowns without a permissive claim', () => {
    const presentation = deriveGuestIdentityPresentation({ state: 'not_provided' }, 'Hotellook')
    const html = render(presentation)

    expect(html).toContain('ID and cardholder rules not provided')
    expect(html).toContain('Hotellook did not tell us whether the lead guest, cardholder, or all occupants need ID')
    expect(html).toContain('Not established by the provider.')
    expect(html).toContain('Whether it must match the lead guest’s name is not established.')
    expect(html).toContain('Source: Hotellook. ID and cardholder rules not returned.')
    expect(html).not.toMatch(/no ID required|you.re all set/i)
    expect(html).not.toMatch(/<input|<textarea|type="file"/)
  })

  it('keeps confirmed identification independent from an unknown cardholder-name rule', () => {
    const html = render(base)

    expect(html).toContain('Lead guest')
    expect(html).toContain('Required at check-in')
    expect(html).toContain('Whether it must match the lead guest’s name is not established.')
    expect(html).toContain('Make sure the lead guest can meet these rules at check-in.')
  })

  it('does not infer a role or normalized requirement from prose-only evidence', () => {
    const presentation = deriveGuestIdentityPresentation({
      state: 'reported',
      rows: [{
        family: 'checkin_identity',
        rowState: 'restricted',
        label: 'ID and payment at check-in',
        sentence: 'Supplier rule reported.',
        statements: base.statements,
        omittedStatementCount: 0,
      }],
      coverageIncomplete: true,
      hasRestriction: true,
    }, 'Acme Hotels')
    const html = render(presentation)

    expect(html).toContain('Provider rule reported; who it applies to is not specified')
    expect(html).toContain('Not specified by the provider')
    expect(html).toContain('Not established by the provider.')
    expect(html).not.toContain('<dd class="mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]">Lead guest</dd>')
    expect(html).not.toContain('Must match the lead guest’s name.')
  })

  it('uses conditional copy and preserves attributed provider wording', () => {
    const html = render({
      ...base,
      identityDocument: { state: 'conditional' },
    })

    expect(html).toContain('Conditions apply')
    expect(html).toContain('May be required at check-in. See the provider wording below.')
    expect(html).toContain('This requirement depends on the provider’s conditions.')
    expect(html).toContain('Government-issued photo identification is required at check-in.')
  })

  it('keeps an exact negative separate from an unresolved cardholder-name dimension', () => {
    const html = render({
      ...base,
      affectedParty: { value: 'not_established', state: 'not_established' },
      identityDocument: { state: 'not_required' },
      statements: [],
    })

    expect(html).toContain('Acme Hotels reports identification is not required at check-in.')
    expect(html).toContain('Whether it must match the lead guest’s name is not established.')
    expect(html).not.toContain('No ID required')
    expect(html).not.toContain('success-soft')
  })

  it('renders conflict evidence without selecting a winner', () => {
    const html = render({
      ...base,
      affectedParty: { value: 'not_established', state: 'conflicting' },
      identityDocument: { state: 'conflicting' },
      statements: [
        { id: 'one', sourceLabel: 'Rate terms', sourceText: 'Lead guest ID is required.' },
        { id: 'two', sourceLabel: 'Property policy', sourceText: 'Identification is not required.' },
      ],
    })

    expect(html).toContain('ID or cardholder details conflict')
    expect(html).toContain('Lead guest ID is required.')
    expect(html).toContain('Identification is not required.')
    expect(html).toContain('These details conflict. Check with the booking partner or property before paying.')
  })

  it('renders labelled loading facts and a polite status without an animated skeleton', () => {
    const html = render({
      ...base,
      state: 'loading',
      affectedParty: { value: 'not_established', state: 'not_established' },
      identityDocument: { state: 'not_established' },
      paymentNameMatch: { state: 'not_established' },
      statements: [],
    })

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Checking ID and cardholder rules…')
    expect(html.match(/Checking…/g)).toHaveLength(3)
    expect(html).not.toMatch(/animate-|shimmer/)
  })

  it('renders error retry as a 44px native button and retains prior evidence after refresh failure', () => {
    const withoutPrior = renderToStaticMarkup(
      <HotelGuestIdentityRules
        presentation={{ ...base, state: 'error', statements: [] }}
        retryAvailable
        onRetry={jest.fn()}
      />,
    )
    const withPrior = render({ ...base, state: 'error', refreshFailed: true })

    expect(withoutPrior).toContain('ID and cardholder rules could not be checked')
    expect(withoutPrior).toContain('<button')
    expect(withoutPrior).toContain('min-h-11')
    expect(withoutPrior).toContain('Try again')
    expect(withPrior).toContain('Updated rules could not be checked')
    expect(withPrior).toContain('Required at check-in')
    expect(withPrior).toContain('previously reported details remain below')
  })

  it('uses a one-column mobile grid and wraps bounded long wording without truncation', () => {
    const html = render({
      ...base,
      statements: [{ id: 'long', sourceLabel: 'Supplier', sourceText: 'x'.repeat(300) }],
    })

    expect(html).toContain('grid-cols-1')
    expect(html).toContain('sm:grid-cols-2')
    expect(html).toContain('[overflow-wrap:anywhere]')
    expect(html).toContain('whitespace-pre-wrap')
    expect(html).not.toMatch(/truncate|line-clamp/)
  })
})
