import type { ReactElement } from 'react'

// The search-intent picker (Hotels / Flight + hotel / Flights) has been
// removed from the UI -- the flight provider isn't reliable enough to
// surface, so the panel is hotels-only now. searchIntent still exists as
// a real value threaded into the submit payload (locked to 'hotels') so
// the rest of the search pipeline is untouched and the picker can come
// back later just by restoring it in SearchPanel.tsx.

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

  it('does not render a search-intent picker -- Hotels, Flight + hotel, and Flights are not selectable', async () => {
    await render()

    const bodyText = container.textContent ?? ''
    expect(bodyText).not.toContain('Flight + hotel')
    expect(bodyText).not.toContain('Rank fares')
    expect(container.querySelector('legend')?.textContent).not.toBe('Search intent')
  })

  it('defaults the submit button to "Search hotels"', async () => {
    await render()

    const submit = container.querySelector('button[type="submit"]')
    expect(submit?.textContent).toBe('Search hotels')
  })

  it('always submits with searchIntent locked to hotels', async () => {
    const onSubmit = jest.fn()
    await render({ onSubmit })
    const form = container.querySelector('form') as HTMLFormElement
    const { act } = require('react') as typeof import('react')

    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ searchIntent: 'hotels' }))
  })
})
