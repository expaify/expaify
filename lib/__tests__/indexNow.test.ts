import { pingIndexNow } from '@/lib/indexNow'

describe('pingIndexNow', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('does nothing when the url list is empty', async () => {
    await pingIndexNow([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('posts the host, key, keyLocation, and urlList to the IndexNow endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 })

    await pingIndexNow(['https://expaify.com/deals/abc', 'https://expaify.com/deals'])

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('https://api.indexnow.org/indexnow')
    const body = JSON.parse(init.body as string)
    expect(body.host).toBe('expaify.com')
    expect(body.key).toBe('index-now-a3495a8f-58cc-4d49-9bb8-d9564c85ff12')
    expect(body.keyLocation).toBe('https://expaify.com/index-now-a3495a8f-58cc-4d49-9bb8-d9564c85ff12.txt')
    expect(body.urlList).toEqual(['https://expaify.com/deals/abc', 'https://expaify.com/deals'])
  })

  it('swallows a fetch failure instead of throwing', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network error'))

    await expect(pingIndexNow(['https://expaify.com/deals'])).resolves.toBeUndefined()
  })
})
