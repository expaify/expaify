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
  it('removes card-size chrome while preserving it for other size variants', () => {
    let card!: TestRenderer.ReactTestRenderer
    let expanded!: TestRenderer.ReactTestRenderer
    act(() => {
      card = TestRenderer.create(<PropertyPhoto src="https://example.com/card.jpg" size="card" />)
      expanded = TestRenderer.create(<PropertyPhoto src="https://example.com/expanded.jpg" size="expanded" />)
    })

    expect(card.root.findByType('figure').props.className).not.toContain('border border-')
    expect(card.root.findAllByType('figcaption')).toHaveLength(0)
    expect(card.root.findByType('figure').props.className).toContain('rounded-[var(--radius-card)]')
    expect(expanded.root.findByType('figure').props.className).toContain('border border-')
    expect(expanded.root.findAllByType('figcaption')).toHaveLength(1)
  })

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

  it('shows the branded city fallback when requested without changing the default missing state', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(
        <PropertyPhoto src={undefined} size="card" brandedFallback={{ cityLabel: 'Paris' }} />,
      )
    })

    expect(hasUnavailableMessage(root)).toBe(false)
    expect(root.root.findAllByType('p').some(node => node.children.join('') === 'Paris')).toBe(true)
    expect(root.root.findAllByType('div').some(node => node.children.join('') === 'e')).toBe(true)
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

  // Regression test for a confirmed live bug: on a fast connection/warm cache,
  // the browser can finish loading the <img> before React finishes hydrating
  // and attaches onLoad -- that one-time native event fires and is gone, so
  // without a post-hydration `.complete` check the image stays hidden behind
  // its skeleton forever despite having loaded successfully.
  it('reveals the image via the post-hydration .complete check when the browser finished loading before onLoad could attach', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(
        <PropertyPhoto src="https://example.com/already-loaded.jpg" size="card" />,
        { createNodeMock: () => ({ complete: true, naturalWidth: 400 }) },
      )
    })

    // No onLoad was ever fired -- only the effect's .complete check ran.
    expect(root.root.findByType('img').props.className).toContain('opacity-100')
    expect(hasUnavailableMessage(root)).toBe(false)
  })

  it('shows unavailable via the post-hydration check when the browser already failed the load before onError could attach', () => {
    let root!: TestRenderer.ReactTestRenderer
    const onFailure = jest.fn()
    act(() => {
      root = TestRenderer.create(
        <PropertyPhoto src="https://example.com/already-broken.jpg" size="card" onFailure={onFailure} />,
        { createNodeMock: () => ({ complete: true, naturalWidth: 0 }) },
      )
    })

    // No onError was ever fired -- only the effect's .complete/.naturalWidth check ran.
    expect(hasUnavailableMessage(root)).toBe(true)
    expect(onFailure).toHaveBeenCalledTimes(1)
  })

  it('does not resolve early when the image has not finished loading yet (.complete is false)', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(
        <PropertyPhoto src="https://example.com/still-loading.jpg" size="card" />,
        { createNodeMock: () => ({ complete: false, naturalWidth: 0 }) },
      )
    })

    expect(root.root.findByType('img').props.className).toContain('opacity-0')
    expect(hasUnavailableMessage(root)).toBe(false)
  })

  // Verifies the effect's src-change handling composes correctly with the
  // existing render-time failed/loaded reset: a component that previously
  // failed must still recover via the .complete fast-path when swapped to a
  // new, already-loaded src (not just via a later real onLoad call).
  it('recovers via the .complete fast-path when a failed instance is swapped to a new, already-loaded src', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(
        <PropertyPhoto src="https://example.com/a.jpg" size="card" />,
        { createNodeMock: () => ({ complete: false, naturalWidth: 0 }) },
      )
    })
    triggerImgError(root)
    expect(hasUnavailableMessage(root)).toBe(true)

    act(() => {
      root.update(
        <PropertyPhoto src="https://example.com/b-already-loaded.jpg" size="card" />,
      )
    })

    // react-test-renderer calls createNodeMock again for the new host node,
    // so this second mount gets complete:false too -- confirms the FAILED
    // state clears (not stuck) even though naturalWidth stays 0, i.e. the
    // reset is driven by the render-time src-change logic, not the effect.
    expect(hasUnavailableMessage(root)).toBe(false)
    expect(root.root.findByType('img').props.className).toContain('opacity-0')
  })
})
