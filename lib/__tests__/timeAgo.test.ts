import { timeAgo } from '../timeAgo'

describe('timeAgo', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('never fabricates a label for missing or invalid timestamps', () => {
    expect(timeAgo(null)).toBeNull()
    expect(timeAgo(undefined)).toBeNull()
    expect(timeAgo('not-a-date')).toBeNull()
  })

  it('clamps future timestamps to just now', () => {
    jest.setSystemTime(new Date('2026-07-22T12:00:00Z'))
    expect(timeAgo('2026-07-22T13:00:00Z')).toBe('just now')
  })

  it('formats minute, hour, yesterday, and day ranges', () => {
    jest.setSystemTime(new Date('2026-07-22T12:00:00Z'))
    expect(timeAgo('2026-07-22T11:28:00Z')).toBe('32m ago')
    expect(timeAgo('2026-07-22T09:00:00Z')).toBe('3h ago')
    expect(timeAgo('2026-07-21T00:00:00Z')).toBe('yesterday')
    expect(timeAgo('2026-07-19T12:00:00Z')).toBe('3d ago')
  })
})
