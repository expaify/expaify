import type { ReactElement } from 'react'

const useSessionMock = jest.fn()

jest.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
  signOut: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

describe('LandingNav', () => {
  let container: HTMLDivElement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any

  beforeAll(() => {
    const { parseHTML } = require('linkedom') as {
      parseHTML: (html: string) => { window: Window }
    }
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
    const domWindow = window as unknown as typeof globalThis
    const location = new URL('https://expaify.test/')
    Object.defineProperty(window, 'location', { configurable: true, value: location })
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { replaceState: jest.fn(), pushState: jest.fn() },
    })
    Object.assign(globalThis, {
      window,
      document: window.document,
      navigator: window.navigator,
      HTMLElement: domWindow.HTMLElement,
      Node: domWindow.Node,
      Event: domWindow.Event,
      IS_REACT_ACT_ENVIRONMENT: true,
    })
  })

  beforeEach(() => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' })
    document.body.innerHTML = '<div id="root"></div>'
    container = document.querySelector('#root') as HTMLDivElement
    const { createRoot } = require('react-dom/client') as typeof import('react-dom/client')
    root = createRoot(container)
  })

  afterEach(async () => {
    const { act } = require('react') as typeof import('react')
    await act(async () => root.unmount())
  })

  async function renderNav() {
    const { act } = require('react') as typeof import('react')
    const { LandingNav } = require('../LandingNav') as typeof import('../LandingNav')
    await act(async () => {
      root.render((require('react') as typeof import('react')).createElement(LandingNav) as ReactElement)
    })
  }

  it('does not render a standalone Flights nav link -- flight search is contextual to hotel deals, not a peer nav destination', async () => {
    await renderNav()

    const flightsLink = Array.from(document.querySelectorAll('a')).find(
      a => a.textContent?.trim() === 'Flights'
    )

    expect(flightsLink).toBeUndefined()
  })

  it('still shows the Deals link for authenticated users, unaffected by removing the Flights link', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { email: 'traveler@example.com', name: 'Traveler' } },
      status: 'authenticated',
    })

    await renderNav()

    const flightsLink = Array.from(document.querySelectorAll('a')).find(
      a => a.textContent?.trim() === 'Flights'
    )
    expect(flightsLink).toBeUndefined()

    const dealsLink = Array.from(document.querySelectorAll('a')).find(a => a.textContent?.trim() === 'Deals')
    expect(dealsLink?.getAttribute('href')).toBe('/deals')
  })
})
