# Findings: md-delivery.vercel.app access-control review

**Date observed:** 2026-09-12, approx. 18:28–18:38 UTC
**Observed by:** Ethan Kaluau (HCP Pharmacy), via Claude, using an ordinary
browser with no login or special access — everything below is visible to
any member of the public who loads the URL.

## Site state at time of observation

`https://md-delivery.vercel.app` displayed a "Down for Maintenance" screen
with a button reading "Send Michael a message" and the label "MICHAEL'S APP"
in the footer. A button labeled "Scan meds for delivery" redirected to a
Google Docs document rather than to the app's normal functionality.

## Requests made by the page on load

The page (a Vite/React single-page app) made the following requests, all
returning HTTP 200, with no authentication required:

- `GET /api/heartbeat` — returned a JSON payload including the fields
  `killed`, `hardOff`, `blocked`, `scheduledOff`, `forceOpen`,
  `offlineView`, and `redirectUrl`. At observation time: `killed: false`,
  `hardOff: false`, `blocked: false`, `scheduledOff: false`,
  `forceOpen: true`, `offlineView: "sign"`, `redirectUrl` pointing to a
  Google Docs URL.
- `GET /api/mode`
- `GET /api/data`
- Static assets: `index-*.js`, `SimpleBoard-*.js`, `facilities-*.js`,
  `cardSize-*.js`, plus matching `.css` files.

## What the loaded CSS reveals about the app's design

The stylesheets shipped to the browser (and therefore visible to any
visitor, logged in or not) define, among other things:

- `#ks-lock` — a full-screen lock overlay with a disable-able button.
- `.app-killed-banner` — a persistent red banner reading state for a
  "killed" condition.
- `.err-screen` / `.err-title` / `.err-unlock` — a full-screen glitch-styled
  "error" display with a press-and-hold control (`touch-action:none`,
  `user-select:none`) required to proceed.
- `.idle-saver` — a full-screen terminal-styled "idle" takeover screen.
- `.dd-relock` — a small circular button, low default opacity, labeled for
  re-locking the app.
- `.praetorian-root` / `.praetorian-button` — a floating control, name
  referencing the Praetorian Guard (the Roman emperor's personal security
  force).
- `.cm-overlay` / `.cm-card` / `.cm-field` / `.cm-btn` — a "contact"
  modal with form fields, matching the visible "Send Michael a message"
  button.

## What the app appears to actually do when not locked

Based on the CSS structure (`.simple-board`, `.simple-topbar`,
`.simple-search`, `.simple-grid`, `.simple-card`, `.simple-card-tag`,
`.simple-card-label`, `.simple-card-barcode`, `.simple-modal`, `.is-bw`):
a searchable grid of facility cards, each showing a colored route tag, a
label, and a scannable barcode; clicking a card opens an enlarged
label/barcode view; a black-and-white mode exists for printing labels.

## Note on scope

This review did not access `/api/data` (likely contains real facility or
delivery records) and did not attempt to trigger, bypass, or interact with
any of the lock/kill-switch mechanisms described above. Everything above
was observed passively from what the page sends to any ordinary visitor's
browser.
