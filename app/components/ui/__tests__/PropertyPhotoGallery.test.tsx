import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PropertyPhotoGallery } from '../PropertyPhotoGallery'

describe('PropertyPhotoGallery', () => {
  it('renders exactly one PropertyPhoto and no thumbnail strip when there are 0 real photos', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(<PropertyPhotoGallery photoUrls={null} fallbackSrc={null} />)
    })
    expect(root.root.findAllByType('img')).toHaveLength(0) // no src -> PropertyPhoto's "unavailable" state, no <img>
    expect(root.root.findAllByProps({ role: 'tablist' })).toHaveLength(0)
  })

  it('degrades to a single PropertyPhoto with no thumbnail strip when there is exactly 1 real photo', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(<PropertyPhotoGallery photoUrls={['https://example.com/a.jpg']} fallbackSrc={null} />)
    })
    const imgs = root.root.findAllByType('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0].props.src).toBe('https://example.com/a.jpg')
    expect(root.root.findAllByProps({ role: 'tablist' })).toHaveLength(0)
  })

  it('falls back to fallbackSrc as a single photo when photoUrls is empty but fallbackSrc exists', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(<PropertyPhotoGallery photoUrls={[]} fallbackSrc="https://example.com/legacy.jpg" />)
    })
    const imgs = root.root.findAllByType('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0].props.src).toBe('https://example.com/legacy.jpg')
  })

  it('prefers photoUrls over fallbackSrc when both are present', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(
        <PropertyPhotoGallery photoUrls={['https://example.com/real-1.jpg']} fallbackSrc="https://example.com/stale.jpg" />
      )
    })
    expect(root.root.findAllByType('img')[0].props.src).toBe('https://example.com/real-1.jpg')
  })

  it('renders a primary photo plus a thumbnail strip when there are 2+ real photos, and switches on click', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(
        <PropertyPhotoGallery photoUrls={['https://example.com/a.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg']} fallbackSrc={null} />
      )
    })
    const tablist = root.root.findAllByProps({ role: 'tablist' })
    expect(tablist).toHaveLength(1)
    const tabs = root.root.findAllByProps({ role: 'tab' })
    expect(tabs).toHaveLength(3)

    // Primary photo starts on the first real photo.
    const primaryImgBefore = root.root.findAllByType('img').find(img => img.props.alt === '')
    expect(primaryImgBefore?.props.src).toBe('https://example.com/a.jpg')
    expect(tabs[0].props['aria-selected']).toBe(true)

    act(() => {
      tabs[2].props.onClick()
    })

    expect(tabs[2].props['aria-selected']).toBe(true)
    expect(tabs[0].props['aria-selected']).toBe(false)
  })

  it('never fabricates extra photos -- the thumbnail count always matches the real array length', () => {
    let root!: TestRenderer.ReactTestRenderer
    act(() => {
      root = TestRenderer.create(
        <PropertyPhotoGallery photoUrls={['https://example.com/a.jpg', 'https://example.com/b.jpg']} fallbackSrc={null} />
      )
    })
    expect(root.root.findAllByProps({ role: 'tab' })).toHaveLength(2)
  })
})
