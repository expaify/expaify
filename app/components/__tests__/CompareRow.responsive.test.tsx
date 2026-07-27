import type { ReactElement } from 'react'
import { CompareRow } from '../ui/CompareRow'

type TestElement = ReactElement<Record<string, unknown>>

function childrenOf(node: unknown): unknown[] {
  if (!node || typeof node !== 'object') return []
  const children = (node as TestElement).props?.children
  return Array.isArray(children) ? children : [children].filter((child) => child !== null && child !== undefined)
}

describe('CompareRow primary provider action layout', () => {
  it('renders a single-column grid below the sm breakpoint so provider actions stack on 375px screens', () => {
    const tree = CompareRow({
      links: {
        expedia: 'https://www.expedia.com/hotel?affcid=marker',
        booking: 'https://www.booking.com/search?aid=marker',
      },
      size: 'primary',
    })

    const gridWrapper = childrenOf(tree)[1] as TestElement
    const className = gridWrapper.props.className as string

    expect(className).toContain('grid-cols-1')
    expect(className).not.toMatch(/(?<!sm:)grid-cols-2/)
  })
})
