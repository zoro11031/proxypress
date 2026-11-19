# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Magic: The Gathering players making proxies of a deck. There are two equal paths, and neither should feel secondary:
- **Print at home.** Print sheets on their own laser or inkjet printer, usually on heavy card stock or foil paper, then cut with a trimmer, scissors or a Silhouette cutter.
- **Order prints.** Prepare an order for MakePlayingCards and upload it there.

They arrive with a decklist (pasted, or a Moxfield or Archidekt link) and leave with a print-ready PDF, a print-and-cut ZIP or an order ZIP. They use it on desktop and on phones.

## Product Purpose
Turn a decklist into physical proxies in one place: import the deck, choose art, make custom cards, lay out and calibrate the sheet, then print and cut, or order. Success means the cards that come out look right and line up, and the user never had to juggle separate tools to get there.

## Positioning
The edge is the end-to-end flow. Deck import, art search, card maker, sheet layout, printer calibration, cut files and order files all live in one app and share one deck. Accuracy matters inside that flow, with calibrated front and back offsets, matching cut files and registration marks, but the reason to use it is that nothing has to leave the app between steps.

## Operating Context
- **Sources:** Scryfall for card data and printings; a community art search (the autofill tool) for alternative art; EDHREC for suggestions.
- **Home print path:** Print settings (paper, layout, sides, cutting, alignment, color) → sheet preview front and back → Review export → PDF printed at Actual size / 100%. Duplex is either manual flip or printer duplex, and back offsets correct second-pass drift.
- **Cutting:** by hand (trimmer or scissors), or a Silhouette Cameo using Studio files, DXF or the companion Silhouette Control Center.
- **Order path:** Review order → choose card stock and a shared cardback → order ZIP → upload to MakePlayingCards.
- **Where it runs:** self-hosted in Docker with an optional password and share links, or as a desktop build (Electron) for Windows and Linux.

## Capabilities and Constraints
- The app is one HTML file with inline CSS and JS, plus a Python standard-library server. No build step, no framework, no npm, no new CDN scripts.
- **Must work fully offline.** The desktop builds run without internet for the app itself, so fonts and assets must be bundled locally (jsPDF already is). Remote font services are not allowed.
- A strict CSP is generated from hashes of the inline scripts. No inline event handlers, no `eval`. New external hosts must be added to `page_csp`.
- **Phone must work well.** The mobile layout gets the same care as desktop.
- **The UI stays dark.** The white sheet preview is the brightest thing on screen.
- Settings and decks live in IndexedDB. A renamed or removed setting must be migrated in `cleanSettings`.
- Card names, deck text and upstream data are untrusted and always escaped.

## Brand Commitments
- The name is "Proxy Press".
- **Terminology:** the UI never says "MPC". It says "art search", "order prints" or "the autofill tool".
- **Voice:** short, plain labels. Hint and help text is written in full sentences without jargon.

## Evidence on Hand
- **Screenshots:** `screenshots/` (print preview, art picker, cutting workflow, order mode).
- **Assets:** frame packs and fonts in `assets/`, and Silhouette Studio base templates in `assets/studio3/`.
- **Absences:** there are no testimonials, user counts or benchmarks. Do not invent them.

## Product Principles
1. **One flow, no hand-offs.** Every step from decklist to physical card stays in the app, and the next step is always visible from the current one.
2. **Home printing and ordering are peers.** Neither path is an afterthought in layout, naming or polish.
3. **The sheet is the truth.** What the preview shows is what the printer and cutter will get. Never change the output silently.
4. **Expensive stock, no surprises.** Anything that adds a pass, a sheet or a duplex flip is the user's choice, made visibly.
5. **Plain words.** Name things the way a player at a printer would, and use one name per concept everywhere.

## Accessibility & Inclusion
- Keyboard operable throughout, with visible focus, respected reduced motion and WCAG AA contrast.
- The app works offline and on phones, as above.
