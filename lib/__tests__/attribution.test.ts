import {
  ATTRIBUTION_STORAGE_KEY,
  captureUtmAttribution,
  getStoredUtm,
} from '../attribution'

type BrowserWindow = {
  location: { search: string }
  localStorage: Pick<Storage, 'getItem' | 'setItem'>
}

describe('UTM attribution', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

  afterEach(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else delete (globalThis as { window?: unknown }).window
    jest.restoreAllMocks()
  })

  function installWindow(search: string, initialValue: string | null = null) {
    let stored = initialValue
    const localStorage = {
      getItem: jest.fn((key: string) => key === ATTRIBUTION_STORAGE_KEY ? stored : null),
      setItem: jest.fn((key: string, value: string) => {
        if (key === ATTRIBUTION_STORAGE_KEY) stored = value
      }),
    }
    const browserWindow: BrowserWindow = { location: { search }, localStorage }
    Object.defineProperty(globalThis, 'window', { value: browserWindow, configurable: true })
    return { localStorage, getStoredValue: () => stored, browserWindow }
  }

  it('captures and persists non-empty UTM parameters on the first attributed visit', () => {
    const { getStoredValue } = installWindow(
      '?utm_source=google&utm_medium=cpc&utm_campaign=summer&utm_content=hero&utm_term=beach+hotel',
    )

    expect(captureUtmAttribution()).toEqual({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'summer',
      utm_content: 'hero',
      utm_term: 'beach hotel',
    })
    expect(JSON.parse(getStoredValue() as string)).toEqual({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'summer',
      utm_content: 'hero',
      utm_term: 'beach hotel',
    })
  })

  it('does not overwrite first-touch attribution on later visits', () => {
    const firstTouch = JSON.stringify({ utm_source: 'newsletter', utm_campaign: 'launch' })
    const { localStorage, browserWindow } = installWindow('', firstTouch)

    expect(captureUtmAttribution()).toEqual({ utm_source: 'newsletter', utm_campaign: 'launch' })
    browserWindow.location.search = '?utm_source=google&utm_campaign=later'
    expect(captureUtmAttribution()).toEqual({ utm_source: 'newsletter', utm_campaign: 'launch' })
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('truncates oversized UTM values from query parameters before persisting them', () => {
    const oversizedCampaign = 'x'.repeat(250)
    const { getStoredValue } = installWindow(`?utm_campaign=${oversizedCampaign}`)

    expect(captureUtmAttribution()).toEqual({ utm_campaign: 'x'.repeat(200) })
    expect(JSON.parse(getStoredValue() as string)).toEqual({ utm_campaign: 'x'.repeat(200) })
  })

  it('truncates oversized UTM values read from localStorage', () => {
    installWindow('', JSON.stringify({ utm_campaign: 'y'.repeat(250) }))

    expect(getStoredUtm()).toEqual({ utm_campaign: 'y'.repeat(200) })
    expect(captureUtmAttribution()).toEqual({ utm_campaign: 'y'.repeat(200) })
  })

  it('ignores missing, empty, and unknown query parameters', () => {
    const { localStorage } = installWindow('?utm_source=&utm_campaign=launch&ref=partner')

    expect(captureUtmAttribution()).toEqual({ utm_campaign: 'launch' })
    expect(localStorage.setItem).toHaveBeenCalledTimes(1)

    installWindow('?ref=partner')
    expect(captureUtmAttribution()).toEqual({})
  })

  it('returns an empty object when persisted JSON is malformed', () => {
    installWindow('', '{not-json')
    expect(getStoredUtm()).toEqual({})
    expect(captureUtmAttribution()).toEqual({})
  })

  it('never throws when localStorage is unavailable', () => {
    const localStorage = {
      getItem: jest.fn(() => { throw new DOMException('blocked') }),
      setItem: jest.fn(),
    }
    Object.defineProperty(globalThis, 'window', {
      value: { location: { search: '?utm_source=google' }, localStorage },
      configurable: true,
    })

    expect(getStoredUtm()).toEqual({})
    expect(captureUtmAttribution()).toEqual({})
  })
})
