import type { ReactElement } from 'react'

// The homepage hero widget used to default to "Flight + hotel" and present
// Flights/Hotels/Flight+hotel as three equal-weight, equally-ordered tabs --
// inconsistent with the top-nav demotion already shipped tonight (5-model
// research: hotel-deal judgment is the actual differentiator, not flight
// search breadth). These tests lock in the fix: Hotels leads and is the
// default selection.

jest.mock('@/app/components/AirportInput', () => ({
  __esModule: true,
  default: (props: { id: string; placeholder: string }) => {
    const React = require('react') as typeof import('react')
    return React.createElement('div', { 'data-testid': `airport-input-${props.id}` }, props.placeholder)
  },
}))

describe('SearchPanel', () => {
  let container: HTMLDivElement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any

  beforeAll(() => {
    const { parseHTML } = require('linkedom') as { parseHTML: (html: string) => { window: Window } }
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
      DOMException: domWindow.DOMException,
      IS_REACT_ACT_ENVIRONMENT: true,
    })
  })

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    container = document.querySelector('#root') as HTMLDivElement
    const { createRoot } = require('react-dom/client') as typeof import('react-dom/client')
    root = createRoot(container)
  })

  afterEach(async () => {
    const { act } = require('react') as typeof import('react')
    await act(async () => root.unmount())
  })

  async function render(props: { onSubmit?: (payload: unknown) => void } = {}) {
    const { act } = require('react') as typeof import('react')
    const { SearchPanel } = require('../SearchPanel') as typeof import('../SearchPanel')
    const React = require('react') as typeof import('react')
    await act(async () => {
      root.render(React.createElement(SearchPanel, props) as ReactElement)
    })
  }

  function intentButtons(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll('button[aria-pressed]')).filter(
      b => ['Hotels', 'Flight + hotel', 'Flights'].includes(b.querySelector('span')?.textContent ?? ''),
    ) as HTMLButtonElement[]
  }

  it('shows Hotels first among the search-intent tabs, not Flights or Flight + hotel', async () => {
    await render()

    const labels = intentButtons().map(b => b.querySelector('span')?.textContent)
    expect(labels).toEqual(['Hotels', 'Flight + hotel', 'Flights'])
  })

  it('defaults to the Hotels intent selected, not Flight + hotel', async () => {
    await render()

    const buttons = intentButtons()
    const hotels = buttons.find(b => b.querySelector('span')?.textContent === 'Hotels')
    const trip = buttons.find(b => b.querySelector('span')?.textContent === 'Flight + hotel')
    const flights = buttons.find(b => b.querySelector('span')?.textContent === 'Flights')

    expect(hotels?.getAttribute('aria-pressed')).toBe('true')
    expect(trip?.getAttribute('aria-pressed')).toBe('false')
    expect(flights?.getAttribute('aria-pressed')).toBe('false')
  })

  it('defaults the submit button to "Search hotels", matching the default Hotels intent', async () => {
    await render()

    const submit = container.querySelector('button[type="submit"]')
    expect(submit?.textContent).toBe('Search hotels')
  })

  it('threads the selected search intent into the submit payload', async () => {
    const onSubmit = jest.fn()
    await render({ onSubmit })
    const trip = intentButtons().find(button => button.querySelector('span')?.textContent === 'Flight + hotel')
    const form = container.querySelector('form') as HTMLFormElement
    const { act } = require('react') as typeof import('react')

    await act(async () => trip?.click())
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ searchIntent: 'trip' }))
  })
})
