import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseHTML } from 'linkedom'
import { HotelBookingModificationCue } from '../HotelBookingModificationCue'
import { HotelBookingOwnershipDisclosure } from '../HotelBookingOwnership'

describe('Hotel booking modification guidance', () => {
  it('renders the complete Tier 1 cue for a verified partner without interactive or live-region semantics', () => {
    const html = renderToStaticMarkup(
      <HotelBookingModificationCue partner={{ label: 'Booking.com', named: true }} />,
    )

    expect(html).toContain('data-hotel-modification-policy="tier_1_unknown"')
    expect(html).toContain('<h3 id="hotel-booking-modification-title"')
    expect(html).toContain('Before payment, check the selected rate and room terms for date, guest, and room changes.')
    expect(html).toContain('A change may depend on availability and may change the price, taxes, or fees, or require cancellation and rebooking.')
    expect(html).toContain('After booking, use your Booking.com confirmation for the booking reference and change or support instructions. expaify cannot change the reservation.')
    expect(html.match(/Booking\.com/g)).toHaveLength(1)
    expect(html).not.toMatch(/role=|aria-live|aria-busy|<button|<a /)
  })

  it.each([
    { label: 'booking partner', named: false },
    { label: 'untrusted-partner.example', named: false },
    { label: '   ', named: true },
  ])('degrades unresolved or blank identity to booking-partner copy', partner => {
    const html = renderToStaticMarkup(<HotelBookingModificationCue partner={partner} />)

    expect(html).toContain('use your booking partner’s confirmation')
    expect(html).not.toContain('untrusted-partner.example')
  })

  it('keeps prohibited capability and servicing claims out of Tier 1 and ownership help', () => {
    const html = `${renderToStaticMarkup(
      <HotelBookingModificationCue partner={{ label: 'booking partner', named: false }} />,
    )}${renderToStaticMarkup(
      <HotelBookingOwnershipDisclosure partner={{ label: 'booking partner', named: false }} />,
    )}`.toLowerCase()

    for (const claim of [
      'changeable', 'changes allowed', 'free changes', 'flexible', 'guaranteed change',
      'modify here', 'manage booking', 'contact the property to change', 'change fee',
      'change by', 'usually', 'most bookings', 'should be able to',
    ]) {
      expect(html).not.toContain(claim)
    }
  })
})

describe('Hotel booking ownership disclosure interaction', () => {
  let root: Root
  let container: HTMLDivElement

  beforeAll(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
    const domWindow = window as unknown as typeof globalThis
    Object.assign(globalThis, {
      window,
      document: window.document,
      navigator: window.navigator,
      HTMLElement: domWindow.HTMLElement,
      Node: domWindow.Node,
      Event: domWindow.Event,
      MouseEvent: domWindow.MouseEvent,
      KeyboardEvent: domWindow.KeyboardEvent,
      IS_REACT_ACT_ENVIRONMENT: true,
    })
  })

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    container = document.querySelector('#root') as HTMLDivElement
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
  })

  it('mounts all three change distinctions on expand, retains focus, and unmounts on collapse', async () => {
    const onOpen = jest.fn()
    const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus')
    await act(async () => root.render(
      <HotelBookingOwnershipDisclosure
        partner={{ label: 'booking partner', named: false }}
        onOpen={onOpen}
      />,
    ))
    const trigger = document.querySelector('button') as HTMLButtonElement

    trigger.focus()
    await act(async () => trigger.click())

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(focusSpy.mock.instances[0]).toBe(trigger)
    expect(Array.from(document.querySelectorAll('dt')).map(node => node.textContent)).toEqual([
      'Dates', 'Guest details', 'Room and rate',
    ])
    expect(document.body.textContent).toContain('Correcting a spelling or contact detail is different from replacing the lead guest or changing occupancy.')
    expect(document.body.textContent).toContain('Changing the booked room or rate is different from asking the property for a bed, view, or floor preference.')
    expect(document.body.textContent).toContain('If the confirmation gives no usable route, use the official support for the site where checkout was completed or for the company that issued the confirmation.')
    expect(onOpen).toHaveBeenCalledTimes(1)

    await act(async () => trigger.click())
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll('dt')).toHaveLength(0)
    focusSpy.mockRestore()
  })
})
