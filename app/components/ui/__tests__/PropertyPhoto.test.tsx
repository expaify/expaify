import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PropertyPhoto } from '../PropertyPhoto'

function hasUnavailableMessage(root: TestRenderer.ReactTestRenderer): boolean {
  return root.root.findAllByType('p').some(node => node.children.join('') === 'Photo unavailable')
}

function triggerImgError(root: TestRenderer.ReactTestRenderer): void {
  const img = root.root.findByType('img')
  act(() => {
    ;(img.props.onError as () => void)()
  })
}

describe('PropertyPhoto', () => {
  it('shows the image (not the unavailable state) for a valid src', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(<PropertyPhoto src="https://example.com/a.jpg" size="card" />)
    })
    expect(hasUnavailableMessage(root)).toBe(false)
    expect(root.root.findByType('img').props.src).toBe('https://example.com/a.jpg')
  })

  it('shows the unavailable state once the image errors', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(<PropertyPhoto src="https://example.com/a.jpg" size="card" />)
    })
    triggerImgError(root)
    expect(hasUnavailableMessage(root)).toBe(true)
  })

  // Regression test for the reported "photo unavailable" bug: a DealCard kept
  // mounted at the same list position (same React key) while its data is
  // replaced -- e.g. after a filter/sort/refresh -- must not carry a PREVIOUS
  // photo's failure into a new, different, perfectly valid photo.
  it('recovers when a failed src is replaced by a different one on the same instance', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(<PropertyPhoto src="https://example.com/a.jpg" size="card" />)
    })
    triggerImgError(root)
    expect(hasUnavailableMessage(root)).toBe(true)

    act(() => {
      root.update(<PropertyPhoto src="https://example.com/b.jpg" size="card" />)
    })

    expect(hasUnavailableMessage(root)).toBe(false)
    expect(root.root.findByType('img').props.src).toBe('https://example.com/b.jpg')
  })

  it('keeps showing unavailable across a re-render with the SAME src (does not mask a real failure)', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(<PropertyPhoto src="https://example.com/a.jpg" size="card" />)
    })
    triggerImgError(root)
    expect(hasUnavailableMessage(root)).toBe(true)

    act(() => {
      root.update(<PropertyPhoto src="https://example.com/a.jpg" size="card" />)
    })

    expect(hasUnavailableMessage(root)).toBe(true)
  })

  it('shows unavailable immediately when src is missing, without needing an error', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(<PropertyPhoto src={undefined} size="card" />)
    })
    expect(hasUnavailableMessage(root)).toBe(true)
  })

  it('resets loading state too, so a new src does not inherit a stale loaded=true skeleton-hidden state', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(<PropertyPhoto src="https://example.com/a.jpg" size="card" />)
    })
    act(() => {
      const img = root.root.findByType('img')
      ;(img.props.onLoad as () => void)()
    })
    expect(root.root.findByType('img').props.className).toContain('opacity-100')

    act(() => {
      root.update(<PropertyPhoto src="https://example.com/b.jpg" size="card" />)
    })

    // A freshly-swapped src has not loaded yet -- must show the loading (opacity-0) state,
    // not the previous src's "already loaded" opacity, otherwise a new image could render
    // invisibly until some unrelated re-render happens to flip it.
    expect(root.root.findByType('img').props.className).toContain('opacity-0')
  })
})
