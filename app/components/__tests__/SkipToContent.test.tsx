import { renderToStaticMarkup } from 'react-dom/server'
import { parseHTML } from 'linkedom'
import RootLayout from '../../layout'

jest.mock('next/font/google', () => ({
  Bricolage_Grotesque: () => ({ variable: 'font-display' }),
  Hanken_Grotesk: () => ({ variable: 'font-body' }),
}))
jest.mock('geist/font/mono', () => ({ GeistMono: { variable: 'font-mono' } }))
jest.mock('next/script', () => ({ __esModule: true, default: () => null }))
jest.mock('../../Providers', () => ({ Providers: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('../AttributionCapture', () => ({ AttributionCapture: () => null }))
jest.mock('../OpinlyIdentify', () => ({ OpinlyIdentify: () => null }))
jest.mock('../Footer', () => ({ Footer: () => <footer><a href="/terms">Terms</a></footer> }))
import { SkipToContent } from '../SkipToContent'

it('renders a focus-visible skip link before navigation and targets a focusable main', () => {
  const { document } = parseHTML(renderToStaticMarkup(<RootLayout><nav><a href="/">Home</a></nav><main id="main-content" tabIndex={-1}>Content</main></RootLayout>))
  const first = document.querySelector('a[href],button,input,select,textarea,[tabindex="0"]')!
  expect(first.textContent).toBe('Skip to main content')
  expect(first.getAttribute('href')).toBe('#main-content')
  expect(first.classList.contains('focus:not-sr-only')).toBe(true)
  expect(document.querySelector('main')?.getAttribute('tabindex')).toBe('-1')
})

it('moves keyboard focus to the main landmark, including legacy booking markup', () => {
  const main = { tabIndex: 0, focus: jest.fn(), scrollIntoView: jest.fn() }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: () => main } })
  try {
    const event = { preventDefault: jest.fn() }
    SkipToContent().props.onClick(event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(main.tabIndex).toBe(-1)
    expect(main.focus).toHaveBeenCalled()
    expect(main.scrollIntoView).toHaveBeenCalled()
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
