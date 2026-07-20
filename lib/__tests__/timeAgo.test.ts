import { timeAgo } from '../timeAgo'

describe('timeAgo', () => {
  const now = new Date('2026-07-20T12:00:00.000Z').getTime()

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns null for missing or invalid input', () => {
    expect(timeAgo(null)).toBeNull()
    expect(timeAgo(undefined)).toBeNull()
    expect(timeAgo('not-a-date')).toBeNull()
  })

  it('returns just now for future dates and offsets under 2 minutes', () => {
    expect(timeAgo('2026-07-20T12:05:00.000Z')).toBe('just now')
    expect(timeAgo('2026-07-20T11:58:30.000Z')).toBe('just now')
  })

  it('formats minute, hour, yesterday, and day ranges', () => {
    expect(timeAgo('2026-07-20T11:57:00.000Z')).toBe('3m ago')
    expect(timeAgo('2026-07-20T09:00:00.000Z')).toBe('3h ago')
    expect(timeAgo('2026-07-19T06:00:00.000Z')).toBe('yesterday')
    expect(timeAgo('2026-07-18T08:00:00.000Z')).toBe('2d ago')
  })
})
