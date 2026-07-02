---
id: UXD-AUTH-FIX-001
stage: UXD
---

# Discovery: Sign-in Broken (MissingCSRF + Invalid Google Client ID)

## Problem Statement
Users cannot sign in. Submitting the email form or clicking "Continue with Google" fails silently or redirects to `/login?error=MissingCSRF`.

## Root Causes (two distinct bugs)

### Bug 1 — MissingCSRF
NextAuth v5 validates the CSRF token using the `Origin` header. Azure Container Apps reverse proxy strips/rewrites the Origin header before it reaches the app. NextAuth sees a mismatched or missing Origin and rejects all sign-in POSTs with `MissingCSRF`. Fix: `trustHost: true` in auth config.

### Bug 2 — Invalid Google Client ID
Container env has `GOOGLE_CLIENT_ID=a7d8f6919-0afc-457a-a476-9499e8aa1aa3`. This is NOT a valid Google OAuth client ID (format must be `XXXXXXXXX.apps.googleusercontent.com`). Google OAuth flow will fail. Fix: user must provide real Google Cloud Console credentials.

## Success Statement
Email magic link sign-in succeeds and sends a verification email. Google button uses a valid client ID.
