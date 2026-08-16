# Social content batch — published live

**Status:** LIVE. 4 of 5 platforms published (TikTok excluded — no video content ready yet).

## Real Zernio publish mechanism (confirmed, for future use)

`POST /v1/posts` creates a draft by default. The real trigger to publish immediately is a
top-level boolean field, found via the docs' embedded Next.js page data (not visible through a
plain markdown-fetch of the client-rendered docs site — had to `curl` the raw HTML and extract
`self.__next_f.push(...)` payloads to find it):

```json
{
  "content": "...",
  "mediaItems": [{"type": "image", "url": "https://media.zernio.com/...", "title": "..."}],
  "platforms": [{"platform": "twitter", "accountId": "<real account _id from GET /accounts>"}],
  "publishNow": true
}
```

Image upload flow: `POST /v1/media` with `{"filename": "...", "contentType": "image/png"}` returns
a presigned Cloudflare R2 `uploadUrl` (PUT the raw file bytes there) and a `publicUrl` to reference
in `mediaItems`.

Idempotency: pass a unique `x-request-id` header per real call (a 5-minute same-ID dedup window
exists) — content is also hashed and rejected with `409` if identical content is sent to the same
account within 24h.

## Live results

| Platform | Result | Live URL |
|---|---|---|
| Twitter/X (@Expaifycom) | Published | https://twitter.com/i/web/status/2088965023821349317 |
| LinkedIn (Expaify com) | Published | https://www.linkedin.com/feed/update/urn:li:share:7494730759249911810/ |
| Facebook (Expaify.com) | Published | https://www.facebook.com/1299620659899871_122107529499430134 |
| Instagram (@expaify) | Published (took ~10s longer, async Meta flow) | https://www.instagram.com/p/DcGdNRElbDV/ |
| TikTok (@expaify) | Not posted | No video content — Runware video-inference is credit-gated on this account (`videoInferenceInsufficientCredits`, needs $5+ balance or a card on file at my.runware.ai/wallet), documented in `01-drafts.md`. |

Copy and images used are exactly what's documented as approved in `01-drafts.md`. No content was
altered before publishing.

## Test artifacts, all cleaned up

Several probe/test drafts were created against the real API while discovering the schema
(`platforms.0.platform`, `platforms.0.accountId`, the `publishNow` field) — every one of them was
created with `platforms: []` (no real account attached, so nothing could go anywhere) or was
deleted immediately after use via `DELETE /posts/{id}` (confirmed via the API's own
`"Post deleted successfully"` response each time). None of the probe/placeholder content was ever
sent to a real platform.
