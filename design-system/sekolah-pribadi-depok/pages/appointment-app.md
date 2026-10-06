# Page override: Parent–Teacher Consultation app

> Per MASTER.md's LOGIC rule, this file extends/overrides `../MASTER.md` for
> the consultation booking app only. Everything not listed here follows
> MASTER.md unchanged (palette, Inter, 8px rhythm, elevation scale, radius,
> motion timings, reduced-motion rule, "no emojis as icons", focus states).
> Tokens live in `src/index.css` (`@theme`), which is the single place to
> change them.

## 1. Accessibility override: action blue

MASTER.md specifies white text on `--color-primary` (#18a8fa) for primary
buttons. That pair measures **2.62:1**, below the 4.5:1 that MASTER's own
pre-delivery checklist requires.

| Pair | Ratio |
|---|---|
| white on `#18a8fa` (primary) | 2.62 ✗ |
| white on `#0d8fdb` (primary-dark) | 3.52 ✗ |
| white on `#0172bb` (gradient-start) | **5.09 ✓** |
| `#0172bb` text on white | 5.09 ✓ |
| `#0172bb` text on `#f2f5f9` (page) | 4.65 ✓ |

**Added:** `--color-action: var(--color-gradient-start)` for every
interactive fill and every piece of blue text (buttons, links, selected slot,
available-slot text). Hover is
`--color-action-hover = color-mix(gradient-start 80%, foreground)`, derived
from the palette rather than a new hex value. `#18a8fa` stays in use as the brand
accent for non-text decoration: progress-bar gradient, tints, borders, the
"slot just changed" ring.

The button style is otherwise exactly MASTER's: pill, neutral elevation-2,
hover darkens, lifts 2px and grows to elevation-3. There's no coloured glow.

## 2. Slot status colours (new)

Each status combines colour, an icon and a text label, so colour is never
the only cue.

| Status (EN / ID) | Background | Text | Extra cue |
|---|---|---|---|
| Available / Tersedia | `surface` | `action` | 1px ring `primary 32% → surface` |
| Taken / Terisi | `surface-muted` | `muted-foreground` | strikethrough time + "Taken" label; ● dot on board |
| In progress / Sedang berlangsung | `gradient-end 14% → surface` | `foreground` | teal ring + pulsing teal dot |
| Done / Selesai | `surface-page` | `muted-foreground` | ✓ icon, 1px `border-strong` ring |
| You're booked / Anda terjadwal | as Taken | as Taken | label explains why |
| No-show / Tidak hadir | `accent 10% → surface` | `foreground` | label (staff views only) |
| Selected / Dipilih | `action` | `on-primary` | ✓ icon, elevation-3 |

Tokens: `--color-status-{available,taken,progress,done}-{bg,fg,border,dot}`.

## 3. Live indicator (new)

An 8px dot in `--color-live` (= `gradient-end`, the brand teal) with a 1.8s
ping ring (`--animate-live-ping`) and the label "Live". When the connection
drops, the dot turns grey, the ping stops and the label reads "Reconnecting…".
Teal is used because the warm orange is reserved for human elements (MASTER)
and red would read as an error.

**Slot changed by someone else:** `--animate-slot-flash` is a 1.6s ring in
`primary` with a 1.04 scale settle, on the easeOutCubic curve. It's disabled
under `prefers-reduced-motion`.

## 4. Other additions

- `--color-border-strong: rgba(18,35,60,.16)`: input and chip outlines. The
  0.08 MASTER border is too faint for form controls (WCAG 1.4.11).
- `--color-overlay: rgba(18,35,60,.45)`: bottom-sheet backdrop (navy-tinted,
  like the shadows).
- `--color-action-tint`, `--color-destructive-tint` and `--color-accent-tint`
  are 8–12% `color-mix` tints of palette colours, used for notices and pills.
- **App type scale.** MASTER's em-based scale is for the marketing site. The
  app uses a compact scale on the same Inter weights: page title 24px/700,
  card title 15–18px/700, body 15–16px/400, caption 11–13px/500–600. The
  "bold label + lighter supporting line" hierarchy rule is kept everywhere
  (teacher name / subject, time / status).
- **Accent use** follows MASTER: orange appears only on human elements,
  meaning the child's name in the flow, the confirmation burst, and no-show.
  Buttons are never orange.
- **Bottom sheet:** `radius-xl` top corners, elevation-4, drag handle. It
  becomes a centred dialog from 640px up.
- **Brand badge:** the school mark and teacher initials use MASTER's
  "rounded-square gradient badge with its own shadow" (gradient-start →
  gradient-end, 135°).
- **Motion:** step transitions use `step-in` (300ms, easeOutCubic, 8px rise),
  the sheet uses `sheet-up` (300ms) and the success check draws in 450ms. All
  are within MASTER's 200–300ms band, except the one-off success
  celebration (large-distance movement exemption).

---

## Flat redesign (Oct 2026, `ui-ux-pro-max` → Flat Design)

Queried `ui-ux-pro-max` ("appointment booking scheduling mobile", variance 4,
motion 3, density 5) → **Flat Design**. Applied to the app's *structure* only;
every colour token above is unchanged.

- **No decorative shadows or gradients.** Surfaces are separated by 1px
  `border-border-strong`. Only things that float above the page (bottom sheet,
  toast) keep one soft shadow (`--shadow-e4`). `--shadow-e1…e3` are `none`.
- **Corners:** 6 / 8 / 12 / 16px (`--radius-sm…xl`). Buttons are 8px
  rectangles, not pills.
- **Interaction:** hover/press change colour or background only — no lifts,
  no scale. Transitions 150–200ms. A just-booked slot flashes an outline, no
  movement.
- **Lists:** teachers and level choices are grouped rows in one bordered card
  with hairline dividers (native list pattern).
- **Type:** Inter; body 16px, secondary 14px, nothing below 12px. No emoji.
- **Touch targets:** ≥44px for back buttons, text actions and the EN/ID
  toggle.
- **Admin tabs:** underline tabs (2px `action` bar) instead of floating pills.
