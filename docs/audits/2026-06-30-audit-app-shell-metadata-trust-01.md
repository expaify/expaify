# AUDIT-APP-SHELL-METADATA-TRUST-01: App Shell Metadata Trust

Date: 2026-06-30
Role: Senior Frontend + UX/UI Engineer
Scope: Strict audit only. Product functionality was not changed.

## Executive Decision

Mostly pass, with one shell-level repair needed before this should be treated as paid-product polished.

The app has a real App Router root layout, `lang="en"`, meaningful product metadata, favicon references, viewport export, visible first-screen search affordance, and global focus-visible defaults. The first paint is a usable search app surface rather than a marketing shell.

The trust issue is theme/chrome consistency: root CSS defaults to dark mode until a body inline script adds `.light`, while the homepage itself is hardcoded light and `themeColor` follows OS color preference. On dark-mode devices with no saved preference, browser chrome can present as dark while the first screen presents as light. That mismatch is cheap at the browser-shell level and can produce a dark-to-light flash before users interact.

## Surfaces Inspected

- `app/layout.tsx`
- `app/globals.css`
- `app/page.tsx`
- `next.config.ts`
- `public/og.svg`
- `app/favicon.ico`
- `app/favicon.svg`
- `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`

Requested files not present in this worktree:

- `components/TicketCard.tsx`
- `components/TicketSlideOver.tsx`

Current equivalents noted but not redesigned:

- Search and results shell are in `app/page.tsx`.
- Flight result cards are in `app/components/FlightCard.tsx` through `components/flights/FlightResults.tsx`.

## Current Shell Inventory

- Title: `expaify | Flight and hotel deal intelligence` from `app/layout.tsx:29`.
- Title template: `%s | expaify` from `app/layout.tsx:30` to `app/layout.tsx:32`.
- Description: `Find current flight and hotel deals ranked against recent route price history.` from `app/layout.tsx:34`.
- Application name, creator, publisher, keywords, robots, canonical, Open Graph, Twitter, and icons are defined in `app/layout.tsx:35` to `app/layout.tsx:60`.
- Language: `<html lang="en">` is present at `app/layout.tsx:75` to `app/layout.tsx:77`.
- Viewport: static `viewport` export sets `width: "device-width"` and `initialScale: 1` at `app/layout.tsx:63` to `app/layout.tsx:65`.
- Color scheme and browser theme color: `colorScheme: "light dark"` plus light/dark `themeColor` values at `app/layout.tsx:66` to `app/layout.tsx:70`.
- Root layout structure: root layout includes required `<html>` and `<body>` and uses the Metadata API instead of manual `<head>` tags, matching the installed Next docs.
- Next config: only `output: 'standalone'` is configured in `next.config.ts:3` to `next.config.ts:5`; no shell metadata overrides are present.

## First-Paint Observations

Browser screenshots could not be captured because this sandbox cannot bind a Next dev server. Attempted commands:

- `npm run dev` failed with `listen EPERM: operation not permitted 0.0.0.0:3001`.
- `HOSTNAME=127.0.0.1 npm run dev -- -H 127.0.0.1 -p 3010` failed with `listen EPERM: operation not permitted 127.0.0.1:3010`.

Written observations from source-level responsive review:

- Mobile 375px: the homepage starts with a fixed theme toggle, compact brand row, headline, trust-stat strip, and a single-column search card. The form controls are large enough for touch and the primary `Search flights` button is visible after the form fields. The route suggestion rail scrolls horizontally and should not force page-level horizontal overflow because the page shell uses `overflow-x-hidden`.
- Desktop: the first paint uses a two-column layout at large widths, with product explanation on the left and the search card on the right. The grid uses a `minmax(620px,1.14fr)` search-card column at `app/page.tsx:954`, which is appropriate for desktop but should be manually checked at tablet widths outside this ticket.
- Loading before results: no pre-results skeleton is needed because the first paint is an actionable search form. Search loading uses a disabled submit state with spinner copy at `app/page.tsx:1161` to `app/page.tsx:1177`.
- Empty/error before interaction: no fake results or empty marketing sections are shown on initial load. Form errors are rendered inline with `role="alert"` at `app/page.tsx:1155` to `app/page.tsx:1158`.

## Findings

### P1: Browser chrome can disagree with the first paint on dark-mode devices

Evidence:

- Root CSS defines light tokens first at `app/globals.css:41` to `app/globals.css:72`, but immediately overrides them for `:root:not(.light)` at `app/globals.css:74` to `app/globals.css:103`.
- The inline theme script adds `.light` only after the body starts rendering unless `localStorage.theme === 'dark'` at `app/layout.tsx:27` and `app/layout.tsx:79` to `app/layout.tsx:80`.
- The homepage form view is hardcoded light with `bg-[#f5f7fb] text-slate-950` at `app/page.tsx:937` to `app/page.tsx:939`.
- The viewport theme color follows OS preference, not the app's actual default theme, at `app/layout.tsx:67` to `app/layout.tsx:70`.

Impact:

On a dark-mode device with no saved theme, the browser address bar can use dark theme color while the app paints light. Depending on render timing, users may also see a dark root background before the body script applies `.light`. This is exactly the type of browser-level polish issue that makes a paid travel product feel less finished.

Recommended repair:

- In `app/layout.tsx` and `app/globals.css`, make the initial server-rendered theme and `themeColor` match the actual default first screen. If the app defaults to light, the document should start light without needing a body script to correct it.
- Keep user zoom enabled; do not add `maximumScale` or `userScalable: false`.
- Keep this as a shell-only repair. Do not redesign homepage, results, booking, providers, or pricing logic as part of this ticket.

### P2: Social preview image is SVG-only and visually from an older dark treatment

Evidence:

- Open Graph and Twitter images point to `https://expaify.com/og.svg` at `app/layout.tsx:48` and `app/layout.tsx:54`.
- `public/og.svg` uses a dark gradient background and generic "flight deal intelligence" copy, while the current first paint is a light search product surface.

Impact:

This does not block browser title or viewport trust, but it is a browser/share-level trust mismatch. Some preview consumers also handle raster images more predictably than SVG.

Recommended repair:

- In a separate metadata asset ticket, replace or supplement `og.svg` with a supported raster OG image that matches current product positioning and avoids unsupported claims.
- Do not add badges, testimonials, or new claims.

## Positive Notes

- The root layout uses the Metadata API instead of manual `<head>` tags, which matches the installed Next docs.
- `lang="en"` is present.
- The default viewport preserves pinch zoom and uses device width with initial scale.
- Global focus visibility exists through `:focus-visible` and focus ring rules at `app/globals.css:137` to `app/globals.css:143`.
- The first screen is a usable search surface, not a decorative landing page.
- No shell-level fake data appears on first paint.

## Manual Verification Checklist

Run in an unrestricted browser environment:

1. Hard refresh `/` at 375px with no `localStorage.theme`. Confirm title is `expaify | Flight and hotel deal intelligence`, browser chrome color matches the visible first screen, and no dark flash is visible.
2. Repeat with OS dark mode and no saved theme. Confirm browser chrome and page background do not disagree.
3. Tab from the address bar into the page. Confirm the theme toggle, trip controls, origin field, swap button, destination field, date fields, flexible dates, passenger controls, and submit button all show visible focus.
4. Hard refresh desktop width. Confirm the brand, H1, search card, and primary action are visible without overlap.
5. Trigger a form validation error. Confirm the alert is visually near the failed action and the layout remains stable at 375px.

## Self-Review

- Hierarchy: first paint prioritizes brand, H1, search form, and primary CTA clearly.
- Contrast: shell focus ring and primary text are acceptable; older dark metadata appears only after results and is outside this shell audit.
- Spacing: mobile form is single-column with consistent gaps; no nested marketing clutter was introduced.
- Mobile fit: source review indicates 375px usability for initial search, but live screenshot verification is blocked by server binding restrictions.
- Focus states: global focus-visible exists and control-specific focus styles exist for key form fields and primary buttons.
- Decorative effects: no new effects added; existing first paint uses restrained cards and no ornamental imagery.

## Out-of-Scope Findings

- `components/TicketCard.tsx` and `components/TicketSlideOver.tsx` are not present in this worktree.
- Results shell visual consistency, booking review trust, and result card accessibility are covered by other audit surfaces and were not repaired here.
- This audit did not change provider, booking, pricing, API, cache, or database behavior.
