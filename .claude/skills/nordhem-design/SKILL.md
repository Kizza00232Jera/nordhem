---
name: nordhem-design
description: The NORDHEM design language. Apply to ALL UI work in this repo (storefront, studio, teaching HTML adopts the tokens). This is the brand book + 2026 e-commerce pattern library + craft checklist. It pins ONE consistent direction — it overrides the "pick a bold new aesthetic each time" behavior of the global designer/bencium skills.
---

# NORDHEM design language

NORDHEM must look like a real, premium Nordic home brand in 2026 — the kind of storefront a design-conscious retailer ships. Warm, editorial, photography-forward, quietly confident. Never like an AI demo, never like a dashboard template.

**Consistency rule**: the global `designer` / `bencium-innovative-ux-designer` skills push for a fresh bold direction per generation. In this repo that is overridden: the direction below is FIXED. Creativity goes into executing it better, not into changing it. `ui-typography` enforcement applies on top of everything here.

## Direction: warm Nordic editorial

Calm warm-paper surfaces, deep ink, one muted botanical accent, oversized editorial serif moments, photography doing the emotional work. Think premium interior magazine that happens to sell things. Restraint executed obsessively — elegance through precision, not effects.

## Tokens (Tailwind v4 @theme — single source of truth in `apps/web`)

- Surfaces: `paper #FAF7F2` (app bg), `linen #F1EBE1` (alt sections), `card #FFFFFF`, `ink-soft-bg #20262E` (footer/dark sections)
- Ink: `ink #20262E` (text), `ink-muted #5B6470`, `line #E7E0D6` (borders)
- Accent: `pine #2F6F62` (primary actions, links, focus) with `pine-deep #24544B` hover
- Highlight: `amber #C8842C` (badges, sale, review stars) — sparingly, never for large areas
- Feedback: success `#2F6F62`, error `#B4452F`, info uses ink, never blue-SaaS
- Radii: `xs 6px` (inputs/chips), `md 12px` (cards), `xl 20px` (drawers/modals). No pill buttons except chips.
- Shadows: 2 levels only — `lift` (0 1px 2px rgba(32,38,46,.06), 0 4px 16px rgba(32,38,46,.05)) and `float` (drawers/popovers: 0 8px 40px rgba(32,38,46,.16)). No glow, no colored shadows.
- Spacing: 4px base; sections breathe (96-128px vertical on desktop, 56-72 mobile); product grids gap 20-24px.

## Typography

- Display serif: **Fraunces** (variable; optical size + wght axes) — headlines, category heroes, prices on PDP, editorial moments. Use real weight/optical contrast: huge & light or small & punchy.
- Body/UI sans: **Schibsted Grotesk** — actually Scandinavian, distinctive, readable. All UI text, product titles, buttons.
- Both self-hosted via `next/font` (zero external requests, GDPR-clean, works in lite mode). NEVER Inter/Roboto/Arial/Space Grotesk.
- Scale: display 56-88px (clamp), h1 40, h2 28, h3 20, body 16, meta 13-14. Line-height: headings 1.05-1.15, body 1.6. Prices: tabular-nums.

## Motion (Motion library for React + CSS; GSAP only if a scroll-driven hero earns it)

- Micro: 150-220ms, ease-out (`cubic-bezier(.2,.8,.2,1)`). Hover lifts max 2px + shadow step, image zoom max 1.04.
- Entrances: staggered grid/list reveals (30-50ms stagger, once per session, not on every filter change). Page-level: View Transitions API for PLP→PDP (product image morph) with graceful fallback.
- Drawers/overlays: 260-320ms spring-ish; backdrop fades, panel slides.
- One orchestrated moment per page maximum (e.g., home hero). Everything else is quiet.
- ALWAYS honor `prefers-reduced-motion: reduce` — swap movement for opacity, kill parallax/morphs.
- Never animate: layout-shifting properties on scroll, text letter-by-letter, infinite attention-seekers near content.

## E-commerce patterns (2026 grade)

- **Header**: slim utility bar (shipping promise), main bar: wordmark left, search front-and-center (this project IS search), favorites/cart right with count badges. Sticky, background blur-free — solid paper with hairline.
- **Search**: instant overlay (also Cmd/Ctrl-K): debounced-as-you-type results with thumbnails, keyboard navigable (proper combobox ARIA), recent searches, did-you-mean, zero-result state with suggestions + category links. Search is the hero feature — it gets the most polish in the app.
- **Product card**: 4:5 image (reserved aspect — zero CLS), hover swaps to 2nd image, favorite heart (top-right, optimistic), title 2-line clamp, price (sale = amber + struck original), rating stars + count, quick-add on hover (desktop) / always (touch). Whole card clickable, heart/add are separate targets.
- **PLP**: facet sidebar desktop (counts, applied-filter chips on top, clear-all) / filter sheet mobile; sort select; results count; skeleton cards on load (shimmer, same dimensions); URL-synced state.
- **PDP**: gallery left (main + thumbs), sticky buy panel right (Fraunces price, stock state, quantity, add-to-cart primary, favorite secondary), accordion for details/specs, "similar products" rail (search-powered — say so in UI).
- **Cart**: drawer not page (page only at checkout), optimistic line updates, undo on remove, sticky summary + checkout CTA.
- **Checkout**: single calm page, address form with proper autocomplete attributes, demo-payment clearly labeled, success page with order number + "view orders".
- **Studio** (`/studio`): same tokens, denser rhythm (13-14px base, tables, mono numbers `JetBrains Mono` self-hosted for metrics/scores). Charts: ink/pine/amber only. It should look like the shop's professional back-office, not a different product.
- **States**: every async surface has skeleton + empty + error designed. Empty states get one warm sentence + one action, never a sad emoji.
- **Lite mode banner**: linen background strip, ink text, pine link "how this works" — honest, calm, not an error toast.

## Imagery

Unsplash/Pexels interiors: warm, natural light, consistent grading (avoid mixing cold/blue shots into the warm palette). `next/image` everywhere, explicit sizes, priority only for LCP hero. Photographer credit in PDP footer ("Photo: Name / Unsplash").

## Craft checklist (run mentally before calling any UI done)

- Contrast AA+ (ink on paper passes; check amber on paper for text — use it at 700-weight 14px minimum or on badges with ink text).
- Focus visible everywhere: 2px pine ring + 2px offset, never `outline: none` without replacement.
- Touch targets ≥44px; labels on every input (no placeholder-as-label); semantic landmarks; one h1 per page; heading order sane.
- Keyboard: full flows operable — search combobox, facets, cart drawer (focus trap + Esc + return focus).
- CLS ≈ 0 (aspect ratios reserved, fonts `display: swap` with metric fallbacks); LCP < 2.5s; hover effects don't reflow.
- `prefers-reduced-motion` verified per page.
- Icons: Lucide only, 1.5-1.75px stroke, 20px default — NEVER emoji as UI icons.

## Never (anti-slop, project-specific)

Purple/blue gradients, glassmorphism, neon glows, dark-mode-by-default (NORDHEM is warm light; dark mode is parked), centered-hero-with-two-buttons template, 3-feature-cards-with-icons rows, fake trust badges, Inter/Space Grotesk, spinners where skeletons belong, design that varies page to page. When in doubt: more whitespace, fewer effects, better photo.
