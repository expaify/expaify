const INDEXNOW_KEY = 'index-now-a3495a8f-58cc-4d49-9bb8-d9564c85ff12'
const INDEXNOW_HOST = 'expaify.com'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

// Bing/Yandex's instant-indexing protocol -- best-effort only. A failed ping
// just means those engines fall back to their normal crawl schedule, so this
// must never throw or block the caller.
export async function pingIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) return
  try {
    await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (err) {
    console.error('IndexNow ping failed', err)
  }
}
