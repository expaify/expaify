import { renderToStaticMarkup } from 'react-dom/server'
import { parseHTML } from 'linkedom'
import { AppShell } from '../AppShell'

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signOut: jest.fn(),
}))
jest.mock('next/navigation', () => ({ usePathname: () => '/deals' }))

it('names every mobile icon link and keeps the home control visible', () => {
  const { document } = parseHTML(renderToStaticMarkup(<AppShell><main>Content</main></AppShell>))
  for (const [href, name] of [['/deals', 'Deals'], ['/destinations', 'Destinations'], ['/account#alerts', 'Alerts'], ['/account', 'Account']]) {
    expect(document.querySelector(`a[href="${href}"]`)?.getAttribute('aria-label')).toBe(name)
  }
  const home = document.querySelector('a[href="/"]')!
  expect(home.getAttribute('aria-label')).toBe('expaify home')
  expect(home.classList.contains('hidden')).toBe(false)
  expect(home.classList.contains('flex')).toBe(true)
})
