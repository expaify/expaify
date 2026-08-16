# Zernio publish-mechanism findings (verified live, this session, by the orchestrating session directly)

**Status:** User has explicitly confirmed approval to publish the 4 drafts in `01-drafts.md`
(Twitter/X, LinkedIn, Instagram, Facebook — TikTok excluded, no video yet). This doc exists
because a prior agent dispatch correctly refused to trust unverifiable claims in a prompt with no
supporting evidence — this is that evidence, written down properly.

## Real curl calls made directly against https://zernio.com/api/v1, this session

1. `POST /posts` with body `{}` (empty):
   - Response: `HTTP 201`, body included `"post":{...,"status":"draft",...}`, message
     `"Draft saved successfully"`. Real fields present on the created object: `userId`, `title`,
     `content`, `mediaItems` (array), `platforms` (array), `scheduledFor`, `timezone`, `status`,
     `tags`, `hashtags`, `mentions`, `visibility`, `crosspostingEnabled`, `metadata`,
     `publishAttempts`, `recycling`, `_id`, `createdAt`, `updatedAt`.
   - Cleaned up immediately: `DELETE /posts/{_id}` → `HTTP 200`, `{"message":"Post deleted successfully"}`.

2. `POST /posts` with body `{"content":"test - not real","platforms":[],"status":"published"}`:
   - Response: `HTTP 201`, `"status":"draft"` in the response **despite explicitly requesting
     `"status":"published"`** — confirms the API silently ignores/overrides a client-supplied
     `status` field on creation. `platforms` was empty, so nothing could have gone anywhere even
     if this had worked.
   - Cleaned up immediately: `DELETE /posts/{_id}` → `HTTP 200`.

3. `POST /posts` with body `{"content":"test - not real","platforms":[]}` → got a real `_id`
   (`6a81a972df0ad94e7c79451f`), then tried `POST /posts/{_id}/publish`:
   - Response: HTTP response body was the Next.js frontend app's HTML shell (`<!DOCTYPE html>...`),
     not a JSON API response — confirms `/posts/{id}/publish` is not a real registered API route
     (falls through to the SPA catch-all route, same signature seen elsewhere on this domain for
     404s that aren't API-shaped).
   - Cleaned up immediately: `DELETE /posts/6a81a972df0ad94e7c79451f` → `HTTP 200`,
     `{"message":"Post deleted successfully"}`.

## Net conclusion from this direct verification

- `POST /posts` reliably creates a draft only, regardless of what `status` value is sent.
- `/posts/{id}/publish` is confirmed NOT the real publish route.
- The real account IDs for the 4 target platforms, from a real `GET /accounts` call earlier this
  session: Twitter/X `6a81a4a277555aae01470bbf`, LinkedIn `6a81a46c77555aae014704eb`, Instagram
  `6a81a41d77555aae0146fc1e`, Facebook `6a81a45877555aae0147029d`.
- No test/placeholder content was left behind — every experimental draft created above was deleted
  in the same breath, confirmed via the API's own 200/"deleted successfully" response each time.
- The real publish mechanism (PATCH to flip status? populating `platforms` with real IDs on
  create? a differently-named action route?) is still **unconfirmed** — this doc records what was
  ruled out, not what works. The next step is to find it, still using the same safe method (prefer
  empty/no-op probes before attaching a real account), then execute the 4 real approved posts from
  `01-drafts.md`.
