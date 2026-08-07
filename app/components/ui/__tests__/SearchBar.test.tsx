import type { ReactElement } from 'react'

// The premium-gated search field used to be a native `disabled` input/button,
// which drops out of tab order and is often skipped entirely by screen
// readers -- an assistive-tech user could never learn the feature exists at
// all, not just that it's paywalled. These tests lock in the fix: the
// controls stay interactive, and a real, discoverable upgrade path replaces
// the bare disabled state.

jest.mock('next/link', () => ({
  __esModule: true,
  default: (props: { href: string; children: React.ReactNode; className?: string }) => {
    const React = require('react') as typeof import('react')
    return React.createElement('a', { href: props.href, className: props.className }, props.children)
  },
}))

describe('SearchBar', () => {
  let container: HTMLDivElement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any

  beforeAll(() => {
    const { parseHTML } = require('linkedom') as { parseHTML: (html: string) => { window: Window } }
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
    const domWindow = window as unknown as typeof globalThis
    const location = new URL('https://expaify.test/deals')
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
    document.body.innerHTML = '<div id="root"></div>'
    container = document.querySelector('#root') as HTMLDivElement
    const { createRoot } = require('react-dom/client') as typeof import('react-dom/client')
    root = createRoot(container)
  })

  afterEach(async () => {
    const { act } = require('react') as typeof import('react')
    await act(async () => root.unmount())
  })

  async function render(premium: boolean) {
    const { act } = require('react') as typeof import('react')
    const { SearchBar } = require('../SearchBar') as typeof import('../SearchBar')
    const React = require('react') as typeof import('react')
    await act(async () => {
      root.render(React.createElement(SearchBar, {
        premium,
        onResult: jest.fn(),
        onClear: jest.fn(),
      }) as ReactElement)
    })
  }

  function getInput(): HTMLInputElement {
    return container.querySelector('input') as HTMLInputElement
  }

  function getSearchButton(): HTMLButtonElement {
    return container.querySelector('button[aria-label="Search deals"]') as HTMLButtonElement
  }

  it('keeps the input and search button in tab order (not disabled) when the user is not premium', async () => {
    await render(false)

    expect(getInput().disabled).toBe(false)
    expect(getSearchButton().disabled).toBe(false)
  })

  it('shows a real, discoverable Upgrade link (not just static text) when a non-premium user focuses the field', async () => {
    const { act } = require('react') as typeof import('react')
    await render(false)

    await act(async () => {
      getInput().dispatchEvent(new Event('focus', { bubbles: true }))
    })

    const link = container.querySelector('a[href="/account"]')
    expect(link).not.toBeNull()
    expect(link?.textContent).toContain('Upgrade')
    expect(container.textContent).toContain('Natural-language search is included with Premium.')
  })

  it('connects the input to the upgrade message via aria-describedby so assistive tech announces it', async () => {
    await render(false)

    const describedBy = getInput().getAttribute('aria-describedby')
    expect(describedBy).toBe('search-bar-premium-message')
    const message = container.querySelector(`#${describedBy}`)
    expect(message).not.toBeNull()
  })

  it('does not gate the controls or show an upgrade message for a premium user', async () => {
    await render(true)

    expect(getInput().disabled).toBe(false)
    expect(getInput().getAttribute('aria-describedby')).toBeNull()
    expect(container.querySelector('a[href="/account"]')).toBeNull()
    expect(container.textContent).not.toContain('included with Premium')
  })

  it('clicking the (now-enabled) search button as a non-premium user surfaces the upgrade message rather than silently doing nothing', async () => {
    const { act } = require('react') as typeof import('react')
    await render(false)

    await act(async () => {
      getSearchButton().click()
    })

    expect(container.textContent).toContain('Natural-language search is included with Premium.')
    expect(container.querySelector('a[href="/account"]')).not.toBeNull()
  })
})
