# Xtiitch Style And Design Guide

This guide is mandatory for agents designing or implementing Xtiitch UI. It turns the product definition into practical visual and interaction rules.

## Brand source of truth (Brand Guidelines v1.0)

- **Colour:** Wine `#800020` (primary, "leads"), Deep Wine `#5C0118`, Wine Tint `#F3E1E5`, Ink `#15111A`, Cream `#FAF6F2`; neutrals Graphite `#565B63` (secondary text), Mauve `#9A7A80`, Line `#E7DED7`, Paper `#FFFFFF`. **Red `#C0392B` / Amber `#B8860B` / Green `#1E8E4E` are reserved for in-product order status — never decoration.** Tokens live in `packages/design-tokens`.
- **Type:** **Inter Tight** is the single typeface — Display/Heading ExtraBold (800), Subhead SemiBold (600), Body Regular (400), Caption Medium (500, often UPPERCASE). (Replaces the old DM Serif Display + Instrument Sans pairing.)
- **Logo:** the **ii-stitch mark** (two dots + two columns + a seam) — not an "X". Horizontal lockup by default; vector masters in `assets/brand/svg`. Motto: **"Fashion, in good order."**
- **Pattern:** a quiet field of running stitches (`pattern-*.svg`), low-contrast texture only.

## Product Feel

Xtiitch is a fashion-business operating system, not a generic SaaS dashboard. It should feel:

- Warm, capable, and trusted.
- Fashion-aware without becoming decorative.
- Mobile-first for real Ghanaian usage.
- Clear enough for customers who may not want dense reading.
- Efficient for business owners who repeat the same tasks every day.

The main product promise is simple: a business can run its fashion work, and a customer can finally see where their garment has reached.

## Brand Tokens

Use these tokens from the first commit onward:

| Token    | Hex       | Use                                                                           |
| -------- | --------- | ----------------------------------------------------------------------------- |
| Burgundy | `#800020` | Primary actions, active navigation, key status accents, important brand marks |
| Ink      | `#15111a` | Primary text, strong icons, high-emphasis UI                                  |
| Cream    | `#faf6f2` | App background, storefront background, calm surfaces                          |

Recommended supporting tokens:

| Token       | Hex       | Use                                    |
| ----------- | --------- | -------------------------------------- |
| White       | `#ffffff` | Cards, menus, inputs, modal surfaces   |
| Soft border | `#e9ded6` | Borders on cream backgrounds           |
| Muted text  | `#6f6672` | Secondary text                         |
| Success     | `#237a4b` | Ready, delivered, paid success states  |
| Warning     | `#b87914` | In progress, pending, needs attention  |
| Danger      | `#a92727` | Cancelled, failed, destructive actions |
| Info        | `#315f8f` | Neutral system information             |

Do not let the app become one-note burgundy. Burgundy is the signature, not the whole painting.

## Typography

Use typography to separate public storytelling from operational work:

- Marketing web: use `DM Serif Display` for large page and section headings, and `Instrument Sans` for body copy, navigation, cards, forms, buttons, and metadata.
- Product web: use `DM Serif Display` for headings and `Instrument Sans` for dense dashboard body/UI text. Keep operational headings compact and do not use decorative alternates beyond the shared title face.
- Mobile: use the platform system font through React Native until a native-safe brand type plan is chosen.
- Avoid narrow, fragile, or overly decorative fashion fonts in operational UI.
- Headings should be confident but compact.
- Body copy should be plain and direct.
- Do not use negative letter spacing.
- Do not scale type with viewport width.

Suggested scale:

| Role                    | Desktop | Mobile |
| ----------------------- | ------- | ------ |
| Marketing page title    | 56-72   | 38-44  |
| Product page title      | 32      | 26     |
| Marketing section title | 36-48   | 30-36  |
| Product section title   | 22      | 20     |
| Panel title             | 18      | 17     |
| Body                    | 16      | 16     |
| Supporting text         | 14      | 14     |
| Metadata                | 12      | 12     |

## Layout

Dashboard surfaces should prioritize scanning and repeated action:

- Use a restrained shell: sidebar or bottom nav, top bar, content area.
- Keep operational pages dense but not cramped.
- Do not use marketing-style hero sections inside the dashboard.
- Do not put UI cards inside other cards.
- Keep cards at 8px radius or less unless a platform component requires otherwise.
- Use full-width bands or unframed layouts for page sections.
- Use fixed dimensions for repeated tiles, status chips, toolbars, and counters so labels do not shift the layout.

Storefront surfaces should prioritize browsing:

- Product imagery is the lead.
- Store branding can vary per business, but the Xtiitch base should remain trustworthy.
- Collection pages need clear filtering/search, not decorative clutter.
- Shareable design pages should load fast and make the order path obvious.

Marketing pages should feel specific to fashion operators:

- Keep the page content from the approved marketing plan, but present it with editorial rhythm, generous whitespace, and clear conversion paths.
- Page heroes should use the cream grid, large `DM Serif Display` title, and a dark brand panel with a page-specific icon watermark.
- Do not squeeze fake dashboard screens into hero panels. Use real product screenshots only when the dashboard exists and can be shown accurately.
- Use page-specific icon watermarks as quiet background identity, not as generic decoration.
- Contact, pricing, security, customer, legal, and feature pages should all feel like parts of one system, not unrelated templates.

## Components

Use familiar controls:

- Buttons: commands only, with icons when an icon is available.
- Icon buttons: edit, delete, share, upload, filter, close, download, save.
- Segmented controls: order type, fulfilment mode, view mode.
- Switches: feature toggles such as delivery, bespoke orders, measurements, collections.
- Checkboxes: multi-select and explicit boolean choices.
- Sliders/steppers/inputs: numeric values such as price, deposit, quantity, fees.
- Tabs: dashboard subviews such as overview, orders, catalogue, money.
- Menus: compact option sets.
- Tooltips: unfamiliar icons or compact controls.

Use MUI components on web. For mobile, create native equivalents that honor the same tokens and interaction rules.

## Status Language

Customer-facing order status must stay simple:

| State  | Color   | Meaning                 |
| ------ | ------- | ----------------------- |
| Red    | Danger  | Received or not started |
| Yellow | Warning | Being made              |
| Green  | Success | Ready or delivered      |

Business-facing stages may be more detailed, but the customer view maps them back to the simple red/yellow/green model.

Use short labels:

- Received
- Being made
- Fitting
- Ready
- Delivered
- Awaiting deposit
- Paid
- Payment failed

## Voice And Copy

Copy should be direct, local, and calm:

- Prefer "Order received" over "Your request has been successfully submitted".
- Prefer "Ready for pickup" over "Fulfilment completed".
- Prefer "Call the business" over "Initiate contact".

Avoid:

- Dense legal wording in normal flows.
- Fake excitement.
- Internal payment or state-machine language.
- Blaming customers or businesses when a payment, booking, or network action fails.

## Accessibility And Low Literacy

The product definition is clear that some users may not be strong readers. Design for this from the beginning:

- Pair status words with color and icon where useful.
- Never rely on color alone.
- Use plain labels.
- Keep primary actions visually obvious.
- Make touch targets at least 44px.
- Preserve contrast on cream backgrounds.
- Show one clear next step after payment, order placement, or booking.
- Make forms forgiving and explain errors near the relevant field.

## Mobile And Poor Network

Assume real mobile data, not perfect Wi-Fi:

- Use skeletons and stable layouts while loading.
- Save form state where practical.
- Let users retry failed network actions.
- Avoid huge images without Cloudinary transformations.
- Use compact payloads for customer tracking.
- Do not block the main order/payment flow on notification delivery.

## Imagery

Use real product, garment, store, or process imagery. Avoid generic stock-like fashion mood imagery where the user needs to inspect a design.

Image rules:

- Use Cloudinary transformations for size and crop.
- Store alt text for design images.
- Keep product thumbnails consistent in aspect ratio.
- Do not stretch images.
- Do not use placeholder boxes in finished UI.
- If source assets are missing during design exploration, generate real bitmap assets instead of faking visuals with CSS art or inline SVG.

## Web Theme Requirements

When the web app is scaffolded, create an MUI theme from the shared design tokens:

- `palette.primary.main = #800020`
- `palette.text.primary = #15111a`
- `palette.background.default = #faf6f2`
- `shape.borderRadius = 8` for cards, panels, and compact surfaces.
- Buttons use a pill `999px` radius; input fields use a softer `16px` control radius.
- Buttons should use sentence-case labels.
- Inputs should be calm, readable, and at least 44px high on touch devices.

## Mobile Theme Requirements

When the Expo app is scaffolded:

- Use the same tokens from `packages/design-tokens`.
- Match screen density to native mobile expectations.
- Prefer bottom tabs for high-frequency mobile navigation.
- Use native-feeling sheets, pickers, and date/time controls.
- Register push permissions with a clear explanation of order updates.

## QA Checklist For Every UI Change

Before an agent marks a UI feature complete:

- Check desktop and mobile widths.
- Check empty, loading, success, error, and permission-denied states.
- Check long names, long prices, and long status labels.
- Check touch targets.
- Check color contrast.
- Check that text does not overflow buttons, cards, or chips.
- Check that business data never appears across tenant boundaries.
- Capture screenshots for meaningful visual changes once the app can render.

## Agent Rule

If a UI decision is not covered here, choose the option that makes a Ghanaian fashion business owner faster and a customer less anxious.
