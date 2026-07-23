# Storefront homepage design QA

## Evidence

- Source: `/Users/shayford/.codex/generated_images/019f862d-bc89-7330-83cb-cfdb3f7ec9df/exec-913091bd-5a84-45e3-b10b-710ff1451503.png`
- Desktop implementation: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/storefront-home-desktop.png`
- Mobile implementation: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/storefront-home-mobile.png`
- Side-by-side comparison: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/storefront-home-comparison.png`
- Desktop viewport: 1440 x 1024, marketplace home, live API data
- Mobile viewport: 390 x 844, marketplace home, live API data

## Comparison

The implementation preserves the selected concept's key hierarchy and composition: light marketplace masthead, photographic editorial hero, dark AI stylist surface, horizontal image-led style rail, compact discovery controls, and an asymmetrical image-first studio grid. Existing Xtiitch typography, burgundy tokens, real catalogue data, and existing photographic assets replace the concept's illustrative sample merchants without changing the intended layout.

## Findings and resolution history

1. **Resolved - responsive header and hero hierarchy.** The desktop masthead, hero copy, AI search, and utility links match the source grouping. Mobile collapses text labels into accessible icon actions and stacks the AI search without overlap.
2. **Resolved - live-data directory composition.** The first studio receives the featured visual weight from the source while remaining shops use compact cards. Stores and designs retain their real routes, catalogue counts, prices, and images.
3. **Resolved - filter behavior and empty states.** Studios/Designs tabs, text search, sorting, mobile filter disclosure, and catalogue-derived style filters are interactive. A filter with no results renders a designed empty state with a clear recovery action.
4. **Resolved - image fidelity.** The build uses existing storefront photographs and merchant catalogue images; no placeholder boxes, CSS illustrations, or handcrafted SVG substitutes were introduced.
5. **Resolved - mobile screenshot positioning.** The initial full-page capture preserved an interaction scroll offset and made the sticky header appear displaced. The page was reset to the top and recaptured; the actual header remains correctly sticky at `top: 0`.

## Interaction checks

- Studios tab: passed
- Designs tab and live design cards: passed
- Design search (`Party`): passed
- Mobile filter expand/collapse: passed
- Mobile `Bridal` filter and no-results recovery: passed
- Header, cart, account, store, design, tracking, marketing, style, and AI-search destinations: present with valid routes

## Browser console

- Application errors: none
- Application warnings: none
- Browser-extension-only warnings from an installed wallet extension were observed and excluded from application findings.

## Automated verification

- Storefront tests: 20 passed
- Storefront typecheck: passed
- Storefront production build: passed
- Targeted ESLint: passed
- `git diff --check`: passed

final result: passed

---

# Landing proof and journey controls design QA

## Evidence

- Source visual truth: the two screenshots attached to the 23 July 2026 user
  request, showing the clipped Browse/Confirm/Follow actions and the oversized
  three-card proof section.
- Mobile journey implementation:
  `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/design-qa/home-journey-actions-mobile.png`.
- Mobile proof implementation:
  `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/design-qa/home-proof-mobile.png`.
- Desktop proof implementation:
  `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/design-qa/home-proof-desktop.png`.
- Mobile source and implementation target: 390 x 844 CSS px at density 1;
  implementation captures are 390 x 844 px.
- Desktop implementation target: 1440 x 1000 CSS px at density 1; capture is
  1440 x 1000 px.
- State: landing page, light theme, journey actions and first post-hero proof
  section visible.

## Full-view comparison

The first post-hero section now reads as a compact product promise rather than
three independent oversized cards. A strong editorial statement sits beside
one connected proof panel on desktop; mobile stacks the same content in a
single bordered surface. The original GHS 0, plain-language status colors, and
direct-settlement promise remain intact.

The journey cards now use a two-row mobile grid with a dedicated action area.
Browse, Confirm, and Follow remain fully inside every card with their arrows on
the same line.

## Focused comparison

- The focused 390 px journey capture shows all three actions at full width,
  with no clipping or label/arrow separation.
- Browser measurements confirm each action uses `white-space: nowrap`, remains
  within the 390 px viewport, and produces zero document overflow.
- The desktop proof capture confirms the three facts share equal tracks inside
  one panel and no longer create large empty cards.

## Required fidelity surfaces

- Fonts and typography: existing Xtiitch display and UI families are retained;
  the proof headline has clearer hierarchy and action labels remain single-line.
- Spacing and layout rhythm: the proof section is shorter, its facts share one
  surface, and mobile journey cards use consistent padding and vertical rhythm.
- Colors and visual tokens: burgundy, brass, green, paper, ink, and divider
  tokens remain unchanged.
- Image quality and asset fidelity: the existing production workflow photograph
  remains sharp and correctly cropped; MUI icons are retained with no invented
  or placeholder artwork.
- Copy and content: the original three promises and Browse/Confirm/Follow
  journey remain present. Supporting copy is unchanged in meaning.

## Findings and comparison history

1. **Resolved P1 - journey actions clipped on mobile.** The original
   three-column card compressed the text column and separated the action label
   from its arrow. The responsive grid now gives actions their own row and
   enforces a non-wrapping inline control.
2. **Resolved P2 - post-hero cards felt oversized and disconnected.** Three
   tall cards with large unused areas were replaced by one compact proof panel
   paired with an editorial explanation.
3. **No remaining P0, P1, or P2 findings.** The final 390 px and 1440 px
   captures show zero horizontal overflow and stable light/dark theme controls.

## Interaction and browser checks

- Browse, Confirm, and Follow render as real route links: passed
- Browse, Confirm, and Follow labels and arrows stay on one line: passed
- Light/dark mode controls after redesign: passed
- Desktop and 390 px mobile layouts: passed; no horizontal overflow
- Browser application errors: none observed. The existing browser-extension
  message-channel errors remain external to the application.

## Automated verification

- Marketing type generation and TypeScript: passed
- Targeted marketing ESLint with zero warnings: passed
- `git diff --check`: passed

final result: passed

---

# Landing hero provenance badge design QA

## Evidence

- Source visual truth: user-provided conversation screenshot of the former outlined “Built for Ghanaian fashion businesses” label.
- Desktop implementation: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/design-qa/landing-badge-desktop.png`.
- Mobile implementation: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/design-qa/landing-badge-mobile.png`.
- Desktop viewport: 1419 × 774 CSS px at density 1; focused crop 270 × 100 px.
- Mobile viewport and capture: 390 × 844 CSS px at density 1.
- State: landing-page hero, initial state.

## Comparison

The old source read like a large outlined button and competed with the headline.
The implementation is a compact 48 px provenance marker with an MUI location
icon, a gold “Built in Ghana” eyebrow, and a supporting “For fashion
businesses” line. Its smaller translucent surface preserves the established
burgundy, cream, gold, and photographic hero language.

## Required fidelity surfaces

- Fonts and typography: existing product font stack retained; the two copy
  levels are legible, optically distinct, and do not wrap.
- Spacing and layout rhythm: balanced icon-to-copy gap and the existing 24 px
  separation before the headline remain intact.
- Colors and visual tokens: existing cream, gold, and dark hero colors retained
  with strong contrast against the photograph.
- Image quality and asset fidelity: no image asset was added or altered; the
  existing hero crop remains unobstructed.
- Copy and content: the original meaning is preserved with clearer hierarchy.

## Findings and comparison history

- Resolved P2: the former label resembled a disabled button and carried too much
  visual weight.
- Desktop and 390 px mobile captures show no wrapping or horizontal overflow.
- No application-generated browser error was observed; installed-extension
  listener warnings were excluded.
- No actionable P0, P1, or P2 finding remains.

## Automated verification

- Marketing type generation and TypeScript: passed
- Marketing ESLint with zero warnings: passed
- Marketing production client and SSR builds: passed
- `git diff --check`: passed

final result: passed

---

# Marketing component redesign QA

## Evidence

- Source visual truth: the three marketing-section screenshots attached to the
  23 July 2026 user request (workflow, tracking card, and FAQ list).
- Desktop implementation:
  `/tmp/xtiitch-marketing-workflow-desktop.png`.
- Mobile implementation: `/tmp/xtiitch-marketing-faq-mobile.png`.
- Desktop viewport: 1419 x 774 CSS px at density 1.
- Mobile viewport: 390 x 844 CSS px at density 1.
- State: light theme; workflow and tracking examples visible; FAQ collapsed by
  default with the first answer also tested expanded.

## Full-view comparison

The redesign preserves the source sections' content and purpose while replacing
the flat, oversized card treatment with Xtiitch's editorial image, burgundy,
brass, green, and dark-ink system. The workflow reads as one connected journey;
tracking has a clear current-state hierarchy and vertical progress rail; FAQ
questions are grouped by task instead of one undifferentiated wall.

No horizontal overflow was measured at either viewport. Desktop cards remain
aligned and mobile modules collapse to one readable column without clipped
controls or two-line button labels.

## Focused comparison

- Workflow: the three source steps remain in the same order with equal card
  dimensions, clearer action verbs, a visible connector, and a compact
  customer-status band.
- Tracking: store, order, current state, estimated readiness, and every customer
  stage remain visible. Position, text, icon, and colour reinforce the current
  state.
- FAQ: all 14 source questions remain available. Group headers add navigation
  context, while the accordion exposes the original answer copy.

## Required fidelity surfaces

- Fonts and typography: existing Xtiitch display and body families are retained;
  display type is reserved for editorial headings and operational UI uses the
  body face at readable weights and line heights.
- Spacing and layout rhythm: consistent spacing, aligned internal padding, equal
  card radii, and responsive one-column stacks.
- Colours and visual tokens: burgundy, brass, green, ink, paper, divider, and
  semantic status colours stay within the established product language.
- Image quality and asset fidelity: the workflow uses the existing production
  atelier photograph with a deliberate crop. Existing MUI icons provide the
  interface imagery; no placeholder or handmade icon assets were introduced.
- Copy and content: the original meaning, stage labels, ETA, customer status
  language, and all FAQ answers are preserved. Supporting copy was shortened
  where needed for scanning.

## Interaction, findings, and comparison history

- The first FAQ accordion opened through its accessible button name and its
  answer was confirmed visible.
- Desktop and mobile pages rendered with zero measured horizontal overflow.
- Browser logs contained only the known Chrome-extension message-channel
  warning; no application error was observed.
- Pass 1 found no actionable P0, P1, or P2 differences. No corrective design-QA
  iteration was required.
- P3 follow-up: animation timing can be tuned after observing real production
  scrolling; reduced-motion support already remains in place.

## Automated verification

- Marketing type generation and TypeScript: passed
- Marketing ESLint with zero warnings: passed
- Marketing production client and SSR builds: passed
- `git diff --check`: passed

final result: passed

---

# Admin operations redesign QA

## Evidence

- Source visual truths:
  - `/Users/shayford/.codex/generated_images/019f862d-bc89-7330-83cb-cfdb3f7ec9df/exec-0551c8d7-92e8-4a1d-86eb-5b18ddbabc42.png` (Operations Inbox, full-width revision)
  - `/Users/shayford/.codex/generated_images/019f862d-bc89-7330-83cb-cfdb3f7ec9df/exec-945c1e64-b767-4efa-9c9f-a3f5e7c4c8ba.png` (Businesses & Money)
  - `/Users/shayford/.codex/generated_images/019f862d-bc89-7330-83cb-cfdb3f7ec9df/exec-cca0b020-0681-4028-a620-d8c64b574b94.png` (Control Room)
- Browser-rendered implementation:
  - `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/admin-login-redesign.png`
  - `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/admin-control-room.png`
  - `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/admin-operations-inbox.png`
  - `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/admin-business-directory.png`
  - `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/admin-business-detail.png`
  - `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/admin-inbox-mobile-final.png`
- Source pixels: 1487 x 1058 for each concept. Desktop CSS viewport: 1440 x 960 at density 1; scrollbar-normalized implementation widths are 1419 px. Mobile CSS viewport: 390 x 844 at density 1; full-page inbox capture is 390 x 1612.
- State: locally rendered admin using authenticated live production-backed admin data, light theme, overview, operations inbox, business directory, and dedicated business record.

## Full-view comparison

The implementation combines the three selected directions without changing the established connected sidebar or KPI cards. The Control Room direction informs the overview briefing and ordering; the Operations Inbox direction becomes a full-width triage queue; Businesses & Money becomes a compact tenant directory. The source split inspector was intentionally replaced with dedicated full-page records to follow the user's explicit navigation requirement.

## Required fidelity surfaces

- Fonts and typography: the existing Xtiitch display and UI fonts are retained with the concepts' editorial hierarchy. Desktop and 390 px mobile titles render without clipping after the top-bar correction.
- Spacing and layout rhythm: queue rows, filters, KPI blocks, and record pages share consistent spacing, borders, radii, and full-width composition. No list/detail split remains.
- Colors and visual tokens: the existing cream, burgundy, charcoal, gold, and semantic status palette is preserved. The sidebar and KPI visual treatments remain unchanged.
- Image quality and asset fidelity: the login uses the real Xtiitch favicon. Admin business payloads expose no merchant logo or cover image, so the directory uses the existing icon library rather than invented imagery or placeholders.
- Copy and content: labels are operational, concise, and derived from live admin data. Technical webhook details, destructive business controls, support actions, and risk controls move to dedicated record views.

## Findings and comparison history

1. **Resolved P2 - mobile top-bar title truncation.** The first 390 px inbox capture clipped `Notifications` because help and theme controls competed with the page title. Those secondary controls now hide at the smallest breakpoint; the final mobile capture shows the complete title with no horizontal overflow.
2. **Resolved P2 - list/detail density.** Early concepts used a split inspector and existing code used drawers and oversized standalone cards. Alerts, businesses, support, risk, payouts, and webhook events now open full-page records, leaving each list concise.
3. **Accepted product constraint - merchant imagery.** The admin business model does not expose an image field. Real tenant status, plan, money, and activity data is shown without fabricating merchant artwork.
4. **No remaining P0, P1, or P2 findings.** The implementation keeps the approved visual language while respecting the existing navigation and KPI constraints.

Focused comparison used the separate business-detail capture because record actions and field rhythm are not readable in the directory full view. The login, inbox, directory, and control-room captures cover the remaining important regions at native density.

## Interaction and browser checks

- Admin login form and authenticated navigation: passed
- Inbox category controls and routing settings affordance: passed
- Inbox row to dedicated case URL and back affordance: passed
- Business directory row to dedicated business URL: passed
- Dedicated record actions and Activity tab affordance: passed
- Desktop and 390 px mobile responsiveness: passed; no horizontal overflow
- Browser application console errors after final reload: none

## Automated verification

- Admin TypeScript check: passed
- Admin ESLint with zero warnings: passed
- Admin production build: passed
- `git diff --check`: passed

final result: passed

---

# Customer account redesign QA

## Evidence

- Selected source visual: `/Users/shayford/.codex/generated_images/019f862d-bc89-7330-83cb-cfdb3f7ec9df/exec-ebcabdec-9f75-468a-8b7f-53fd2e48aaa3.png`
- Signed-in desktop implementation: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/account-redesign-orders.png`
- Signed-in mobile implementation: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/account-redesign-orders-mobile.png`
- Signed-out desktop implementation: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/account-redesign-desktop.png`
- Signed-out mobile implementation: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/account-redesign-mobile.png`
- Source pixels: 1487 x 1058. Desktop CSS viewport and capture: 1440 x 900 at density 1. Mobile CSS viewport: 390 x 844 at density 1; full-page capture: 390 x 1961.
- State: local signed-in account with realistic current, awaiting-payment, and archived orders; separate signed-out SMS/email state.

## Full-view comparison

The implementation carries the selected Option 2 hierarchy into the production account route: compact storefront/account navigation, an editorial account title, current/archive controls, a selectable order list, a dedicated order journey, contextual actions, and a quieter supporting profile panel. The signed-out state uses the same cream grid, burgundy accents, editorial type, and rounded white surfaces so authentication no longer feels like a separate product.

## Required fidelity surfaces

- Fonts and typography: Fraunces remains the display face and the shared Xtiitch sans-serif remains the UI face. Headings, labels, status text, and mobile wrapping are legible with no clipping.
- Spacing and layout rhythm: desktop uses the source's list/detail split with a narrow profile rail; mobile collapses in task order without horizontal overflow. Cards, dividers, tabs, and form fields use consistent radii and spacing.
- Colors and visual tokens: existing burgundy, cream, charcoal, status colors, theme-aware surfaces, and shared borders are preserved. No store-specific color was hardcoded into account data.
- Image quality and asset fidelity: the customer order API does not provide product image URLs, so the implementation intentionally omits invented thumbnails. It preserves the source's information hierarchy using real order data and library icons rather than placeholders or CSS-drawn artwork.
- Copy and content: payment expiry, retry/close actions, store contact, tracking, received acknowledgements, profile details, SMS/email OTP, and AI-search entitlement language remain accurate to the existing product behavior.

## Findings and comparison history

1. **Resolved P2 - selected order-tab contrast.** The first signed-in browser capture rendered burgundy selected-tab text on a burgundy fill. The selected label now uses the shared white token; the revised desktop and mobile captures show readable `Current` and `Archived` states.
2. **Accepted product constraint - no fabricated product imagery.** The visual source includes garment thumbnails, but `CustomerOrder` exposes no image URL. The implementation keeps real titles, stores, dates, values, statuses, and actions instead of inventing customer order assets.
3. **No remaining P0, P1, or P2 findings.** Desktop and 390 px mobile layouts preserve the selected composition, and the signed-out page matches the same system.

Focused crops were unnecessary because the desktop capture keeps order selectors, status journey, actions, tabs, and profile controls readable at their native density; the full-page mobile capture covers the responsive sequence.

## Interaction and browser checks

- Current/Archived tab switching: passed
- Awaiting-payment order selection with Pay now and Close actions: passed
- Archived order selection with Received action: passed
- SMS/Email sign-in switching: passed
- Sign out: passed
- Empty current and archived states: passed
- Browser application exceptions and log errors after reload: none

## Automated verification

- Storefront TypeScript check: passed
- Targeted ESLint: passed
- Storefront production build: passed
- `git diff --check`: passed

final result: passed

---

# Store detail redesign QA

## Evidence

- Source visual truth: `/Users/shayford/.codex/generated_images/019f862d-bc89-7330-83cb-cfdb3f7ec9df/exec-a7c229c8-1f64-4cf5-b082-668a90314762.png`
- Desktop implementation: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/store-detail-desktop.jpg`
- Mobile implementation: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/store-detail-mobile.jpg`
- Side-by-side comparison: `/Users/shayford/Desktop/Dev/Projects/xtiitch/.artifacts/store-detail-comparison.jpg`
- Source pixels: 1487 x 1058. Desktop implementation pixels: 1419 x 1740. Mobile implementation pixels: 390 x 2625.
- Desktop CSS viewport: 1419 x 774 at density 1. Mobile CSS viewport: 390 x 844 at density 1.
- State: live `Second business` storefront with an empty catalogue, merchant branding, marketplace discovery, and light theme.

## Full-view comparison

The browser implementation preserves the combined Option 2 and Option 3 composition: a compact neutral masthead, merchant-led photographic hero, catalogue-first toolbar, broad content canvas paired with a confidence rail, and a compact four-step ordering guide. The implementation continues below the visual target with the existing plan-gated marketplace discovery strip and attribution footer. That additional content is expected product behavior rather than design drift.

## Focused comparison

- Typography: Fraunces display hierarchy and the existing Xtiitch sans-serif UI copy match the source's editorial/product split, with no clipping at desktop or 390 px mobile.
- Spacing and layout: the desktop catalogue/rail ratio, dividers, section rhythm, and mobile single-column collapse remain readable and preserve the source hierarchy.
- Colors and tokens: the page uses the merchant's resolved brand color for accents and the shared Xtiitch light/dark surface tokens for contrast. The cover, color, logo, and layout are API-driven rather than store-specific constants.
- Image quality: the supplied merchant cover is rendered with `cover` cropping at both breakpoints and remains sharp. No visible product asset was recreated with CSS or placeholder artwork.
- Copy: customer-facing empty-state and tracking actions replace the mock's merchant-only publishing CTA. This is an intentional correction because public storefront visitors cannot publish inventory.

## Findings and comparison history

1. **Resolved - stale paid-plan storefront customization.** The public repository previously returned stored brand, logo, banner, and layout values without rechecking the current plan. Read-side entitlement gating now restores platform defaults after a downgrade while preserving entitled merchant customization.
2. **Resolved - theme transition validation.** The first dark-mode capture occurred during the circular theme transition. A settled capture confirmed that all surfaces, copy, dividers, and controls switch cleanly with no mixed-theme region.
3. **Resolved - browser application error.** An early hot-reload build logged an unsupported MUI `currentColor` alpha error. The color path was removed; a clean reload now reports no application errors. Remaining warnings originate from the installed wallet extension.
4. **Accepted product deviation.** The implementation keeps the existing free-plan discovery rail and Powered by Xtiitch badge below the target frame, because both are driven by current plan entitlements.

No actionable P0, P1, or P2 visual findings remain. No extra focused crop was needed because the normalized side-by-side comparison keeps the hero, catalogue empty state, confidence rail, navigation, and ordering guide legible at once; the separate mobile full-page capture covers responsive detail.

## Interaction checks

- Catalogue search and no-results recovery: passed
- Hero tracking link and direct tracking route: passed
- Mobile menu contents and responsive collapse: passed
- Light/dark theme toggle: passed
- Desktop and 390 px mobile layouts: passed
- Browser console after clean reload: no application errors; extension-only warnings excluded

## Automated verification

- Storefront tests: 23 passed
- Storefront TypeScript check: passed
- Storefront targeted ESLint: passed
- Storefront production build: passed
- Storefront repository Go tests: passed
- `git diff --check`: passed

final result: passed
