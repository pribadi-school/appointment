# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/sekolah-pribadi-depok/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.
>
> Generated with the `ui-ux-pro-max` skill, then hand-corrected: the tool's
> auto-matched query pulled a "kids' learning app" profile (Claymorphism,
> Comic Neue/Baloo 2, indigo) that doesn't fit a K-12 private school's
> professional site, and its own color/font suggestions are generic
> placeholders, not this project's actual brand. What's kept below is the
> tool's *structural* guidance (pattern, elevation scale, spacing rhythm,
> motion timing, accessibility checklist) verified against a second,
> narrower query ("private school institution website professional
> trustworthy" → Minimalism & Swiss Style + Dimensional Layering for
> card depth); the colors and typography are this project's real,
> already-shipped brand, not the tool's suggestion.

---

**Project:** Sekolah Pribadi Depok (SD-SMP-SMA Pribadi)
**Generated:** 2026-09-05
**Category:** K-12 private school / educational institution website

---

## Design Direction

**Pattern:** Hero + Features + CTA (Minimalism & Swiss Style base)
Clean, spacious, grid-based, high-contrast, functional. This is the site's
existing direction (see the homepage sections already built: video hero,
program cards, achievement showcase) — this document formalizes it rather
than changing course.

**Card depth treatment:** Dimensional Layering, applied selectively.
Cards should read as physically raised surfaces via a real elevation
scale (below), not flat blocks with a token 1px border. Depth communicates
"premium," which matters for a school parents are trusting with their
kids — flat/generic cards undersell that.

**Tone:** Clean and modern (Swiss/Minimalism structure) + warm (the
orange accent, used deliberately and sparingly against a blue/neutral
base, is what keeps this from reading cold/corporate — reserve it for
human elements: names, achievements, warmth cues, not structural chrome).

---

## Global Rules

### Color Palette

This project's actual, already-established brand — not a generic
suggestion. Keep hex values in sync with any existing CSS custom
properties; these are the canonical source going forward.

| Role | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Primary (brand blue) | `#18a8fa` | `--color-primary` | Buttons, links, primary CTA, stat numbers |
| Primary Dark | `#0d8fdb` | `--color-primary-dark` | Button hover/pressed state |
| Gradient Start | `#0172bb` | `--color-gradient-start` | Name/heading accent gradients, borders |
| Gradient End | `#01a6a1` | `--color-gradient-end` | Paired with gradient-start (135deg typical) |
| Gradient Start (on dark) | `#2bb6ff` | `--color-gradient-start-on-dark` | Same gradient role, but over the dark achievement tiles |
| Gradient End (on dark) | `#4fe0da` | `--color-gradient-end-on-dark` | Paired with gradient-start-on-dark |
| Accent (warm) | `#f26522` | `--color-accent` | Sparingly: student names, achievement highlights, warmth cues |
| On Primary | `#ffffff` | `--color-on-primary` | Text/icons on blue or dark surfaces |
| Foreground (headings) | `#12233c` | `--color-foreground` | Headings, high-emphasis text |
| Foreground (body dark variant) | `#1c2733` | `--color-foreground-alt` | Body text on light card surfaces |
| Muted Foreground | `#5a6472` | `--color-muted-foreground` | Body copy, secondary text |
| Surface (raised) | `#ffffff` | `--color-surface` | Cards, tooltips, buttons — raised surfaces only, never the page itself |
| Surface Page | `#f2f5f9` | `--color-surface-page` | The page canvas. Plain, non-alternating sections sit on this |
| Surface Muted | `#e9eef5` | `--color-surface-muted` | Alternating section backgrounds — one step down from the page |
| Border | `rgba(18, 35, 60, 0.08)` | `--color-border` | Subtle card borders (navy-tinted, not flat gray) |
| Dark Surface | `#0a0a0c` | `--color-dark-surface` | Achievement section backdrop / overlays |
| Destructive | `#dc2626` | `--color-destructive` | Errors only (not currently used sitewide) |

**Anti-pattern:** Don't introduce new ad-hoc hex values in component CSS.
Every color used should trace back to a role in this table.

**Note on the light tones:** these three are a deliberate ladder — raised
(`#ffffff`) sits above the page (`#f2f5f9`), which sits above the alternating
sections (`#e9eef5`). Keep that order when adjusting any of them, or cards
stop reading as raised. The tokens are scoped to `#homepage-custom` so they
can't leak into Elementor-authored pages, which means the site-wide page tint
in `oceanwp-child/style.css` repeats `#f2f5f9` as a literal — the two are
meant to move together.

### Typography

**Font family:** Inter (already loaded sitewide via Google Fonts,
weights 300–700) for both headings and body across homepage components.
This supersedes any lingering Montserrat references — Inter is the
project's actual current direction (see prior conversion of hero,
achievement section, quote card).

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
```

**Type scale (rem, 16px base):**

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--text-display` | 2.9em | 700 | Hero headline |
| `--text-h1` | 2em | 600 | Section-level quote/statement |
| `--text-h2` | 2.1em | 700 | Section headings |
| `--text-h3` | 1.3–1.6em | 700 | Card titles |
| `--text-body` | 0.96–1.02em | 400 | Paragraph copy |
| `--text-caption` | 0.72–0.86em | 500–800 | Labels, bylines, stat labels |

**Hierarchy rule already in use, keep it:** pair a *bold, larger* label
(name, number, headline) against *basic-weight, smaller* supporting text
(title, description) — established in the achievement tiles and quote
card. Don't flatten this back to uniform weight.

### Spacing Scale

8px rhythm, consistent with the skill's spacing-scale guideline:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 8px | Icon-to-text gaps |
| `--space-sm` | 16px | Tight internal gaps |
| `--space-md` | 24px | Card internal padding (compact) |
| `--space-lg` | 32px | Card internal padding (generous) |
| `--space-xl` | 56px | Component-to-component gaps |
| `--space-2xl` | 90px | Section vertical padding (desktop) |
| `--space-2xl-mobile` | 56px | Section vertical padding (mobile) |

### Elevation Scale (Dimensional Layering)

Verified against the `style` domain (`dimensional-layering`). Use these
four levels consistently instead of inventing a new shadow value per
component — this is what "premium, not flat" actually means in practice.

```css
--elevation-1: 0 1px 3px rgba(18, 35, 60, 0.08);           /* resting, barely raised */
--elevation-2: 0 8px 20px rgba(18, 35, 60, 0.10);          /* default card state */
--elevation-3: 0 20px 40px -12px rgba(18, 35, 60, 0.18);   /* hover / active */
--elevation-4: 0 30px 56px -14px rgba(18, 35, 60, 0.28);   /* lifted / focal state */
```

On dark surfaces (achievement section backdrop), shadows alone don't read
— pair elevation with a light rim (`inset 0 1px 0 rgba(255,255,255,.5)`)
or a visible border instead of relying on shadow contrast against dark.

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 10px | Small elements, chips |
| `--radius-md` | 14px | Achievement tiles, buttons |
| `--radius-lg` | 16–22px | Program cards, quote card |
| `--radius-full` | 999px | Pill buttons |

### Motion

200–300ms across the board (matches every timing value already verified
across style entries and this project's own transitions). Longer only
for large-distance movement (hero text fade, curved section transition).

```css
--motion-fast: 200ms;
--motion-base: 250ms;
--motion-slow: 300ms;
--ease-standard: ease;

/* Entrance motion, not interaction feedback - the exemption above for
   large-distance movement. Used by the .hp-reveal scroll-in on every
   homepage section below the hero.

   500ms is mid-band for a standard scroll reveal (400-600ms). It was
   briefly 650ms, which overshot the band and made the reveal read as
   sluggish. The curve is easeOutCubic, equivalent to GSAP power2.out -
   deceleration on arrival, no overshoot. (It was previously mislabelled
   "quad"; quad is 0.25/0.46/0.45/0.94, a weaker curve. Only the name was
   ever wrong, not the value.) */
--motion-reveal: 500ms;
--ease-out-cubic: cubic-bezier(0.22, 0.61, 0.36, 1);

/* One stagger step for grouped reveals. Use multiples of this and nothing
   else - the page previously carried six ad-hoc values (60/70/100/120/
   150/200/240ms) with no shared rhythm. Cap a run at ~6-8 children;
   beyond that the tail reads as lag rather than sequence. */
--motion-stagger: 80ms;
```

**Scroll-reveal trigger:** fire when the element's top edge crosses ~85% of
viewport height (`IntersectionObserver` with `threshold: 0` and
`rootMargin: '0px 0px -15% 0px'`). Waiting for a fixed fraction of the
element to be on screen makes tall elements start visibly late.

Always pair with `@media (prefers-reduced-motion: reduce)` disabling the
transition/animation, not just shortening it — already the pattern used
elsewhere in this codebase (hero text scroll, header transitions).

### Button Style

- Primary: solid `--color-primary` fill, white text, `border-radius: 30px`
  (pill), resting shadow `--elevation-2`, hover darkens to
  `--color-primary-dark` + lifts (`translateY(-2px)`) + shadow grows to
  `--elevation-3`.
  Shadow is neutral/navy-tinted (the shared elevation scale), **not** a
  glow tinted to match the fill colour. A colour-matched shadow
  (`rgba(24,168,250,...)` under a blue button) was the original spec here
  and read as generic/AI-templated - it's also the literal thing this
  project's base style, Minimalism & Swiss Style, warns against ("sharp
  shadows if any", no decorative glow). Every other lifting element on the
  page (cards, covers, video frames) already used the neutral elevation
  scale; the button was the one outlier still doing its own thing.
- Outline (on dark/photo backgrounds): white 2px border, transparent fill,
  inverts to filled white on hover.
- Never use the orange accent as a button fill — reserve it for text/data
  (names, highlights), keep CTAs on-brand blue for consistency.

### Card Style (general principle)

- Real elevation (see scale above), not a flat 1px border pretending to
  be a card.
- Icon/photo treatment should feel considered — a badge (rounded-square
  gradient, own shadow) or a real photo, never a bare flat-color circle.
- Clear typographic hierarchy inside the card: one dominant element
  (name, title, number), one supporting line, never equal visual weight.
- Hover state should communicate "this is interactive" even when it
  isn't strictly clickable yet (subtle lift + shadow growth, ~250ms).

---

## Pre-Delivery Checklist

- [ ] No emojis as icons (SVG/Font Awesome only — already the pattern here)
- [ ] cursor-pointer on interactive, non-link elements (tiles, cards)
- [ ] Hover states use `--motion-base` (250ms), not ad-hoc durations
- [ ] Text contrast ≥4.5:1 on every surface (verify light card text as well as text on the dark achievement backdrop)
- [ ] Focus states visible for keyboard nav (don't rely on hover alone)
- [ ] `prefers-reduced-motion` respected on every new transition/animation
- [ ] Responsive check at 375px, 768px, 1024px, 1440px
- [ ] Every color traces to a role in the palette table above — no stray hex values
