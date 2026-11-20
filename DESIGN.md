---
name: Proxy Press
description: Decklist in, print-ready sheet out, laid flat on a graphite cutting mat.
colors:
  graphite-mat: "#1c2022"
  rail: "#222729"
  rail-raised: "#2c3235"
  sunk-well: "#161a1c"
  hairline-rule: "#3a4246"
  field-edge: "#66737a"
  chalk-text: "#e9eef0"
  pencil-muted: "#a3afb4"
  process-cyan: "#33bfe8"
  process-cyan-hover: "#5ccdf0"
  cyan-ink: "#a8e6f8"
  focus-cyan: "#7fd8f3"
  cyan-dark-ink: "#05161d"
  sheet-paper: "#f5f6f2"
  warning-amber: "#eed98a"
  danger-coral: "#ff9c95"
  ok-green: "#a1d7aa"
  placeholder-pencil: "#8b979d"
  danger-solid: "#b8372f"
  paper-slot: "#e6e8e2"
  paper-ink: "#5b6266"
  paper-edge: "#9aa3a8"
typography:
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  numeral:
    fontFamily: "ui-monospace, SF Mono, Cascadia Mono, DejaVu Sans Mono, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
  numeral-strong:
    fontFamily: "ui-monospace, SF Mono, Cascadia Mono, DejaVu Sans Mono, Menlo, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 700
    fontFeature: "tnum"
rounded:
  sm: "3px"
  md: "4px"
  lg: "6px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  control: "36px"
  control-touch: "42px"
components:
  button:
    backgroundColor: "{colors.rail-raised}"
    textColor: "{colors.chalk-text}"
    rounded: "{rounded.sm}"
    padding: "6px 11px"
    height: "{spacing.control}"
  button-primary:
    backgroundColor: "{colors.process-cyan}"
    textColor: "{colors.cyan-dark-ink}"
    rounded: "{rounded.sm}"
    padding: "6px 11px"
    height: "{spacing.control}"
  button-primary-hover:
    backgroundColor: "{colors.process-cyan-hover}"
    textColor: "{colors.cyan-dark-ink}"
  input:
    backgroundColor: "{colors.sunk-well}"
    textColor: "{colors.chalk-text}"
    rounded: "{rounded.sm}"
    padding: "6px 9px"
  decklist-row:
    backgroundColor: "transparent"
    textColor: "{colors.chalk-text}"
    padding: "6px 0"
    height: "46px"
  ticket-value:
    backgroundColor: "transparent"
    textColor: "{colors.chalk-text}"
    typography: "{typography.numeral}"
    rounded: "{rounded.sm}"
    padding: "6px 6px"
  ticket-value-changed:
    textColor: "{colors.process-cyan}"
  dialog:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.chalk-text}"
    rounded: "{rounded.lg}"
---

# Design System: Proxy Press

## Overview

**Creative North Star: "The Cutting Mat & Decklist"**

The workspace is a graphite cutting mat on a print-shop bench. The sheet lies on the mat at true scale, with a millimetre grid behind it that starts at the sheet's own corner and rulers along its top and left edges carrying mm numerals. To the left the deck reads as a tournament decklist: count first, ruled rows, a double-ruled total. To the right the settings read as a job ticket: plain labels on the left, values in tabular mono on the right. The one live colour is process cyan, the colour of a cut line, and it marks only what is selected, focused, the next action, or something the app changed that the user has not yet accepted.

Density is that of a working tool, not a dashboard. Everything lies flat on the mat. Sections are separated by hairline rules, not boxed. The white sheet is the brightest object on screen and nothing competes with it. Overlays (dialogs, popovers, menus, the toast) are the only things that leave the surface.

The system replaces an earlier lavender, glassy dark-SaaS look and refuses its devices: lavender accent, glass bars, glows, boxes nested inside boxes, eyebrow labels and side-stripe callouts.

**Key Characteristics:**
- Graphite neutrals in four close steps, paper white for the sheet only, process cyan as the single live colour.
- The mat grid and rulers are drawn at the sheet's own scale, so 10 mm on the mat is 10 mm on paper.
- System sans for words in three sizes (12 / 14 / 18); system mono with tabular figures for every number.
- Selection is drawn as crop-mark corners, the same marks the printer gets.
- Flat, ruled sections; only overlays lift.
- Drawn line icons at a 1.5 stroke, never glyphs.

## Colors

Cool graphite at low chroma, one saturated cyan, and a paper white kept for the sheet itself.

### Primary
- **Process Cyan** (#33bfe8): the single live colour. Selection (crop marks, the selected-card wash, the selection bar's border), the primary action (Review export, Change selected art), cut lines, active segment, and ticket values the app changed until the user accepts them. Text on it is Cyan Dark Ink.
- **Process Cyan Hover** (#5ccdf0): primary-action hover only.
- **Focus Cyan** (#7fd8f3): the 2px keyboard focus outline, offset 2px.
- **Cyan Ink** (#a8e6f8): cyan-tinted note text, such as the job-ticket note that explains a change ("A double-faced card made this job double-sided.").
- **Cyan Dark Ink** (#05161d): text on a cyan fill.

### Neutral
- **Graphite Mat** (#1c2022): page background and the mat behind the sheet; also the flat background of settings sections and preset rows.
- **Rail** (#222729): header, footer bar, side rails and dialog surfaces. One step lighter than the mat.
- **Rail Raised** (#2c3235): default button fill.
- **Sunk Well** (#161a1c): text inputs, selects and textareas sit below the mat.
- **Hairline Rule** (#3a4246): row rules, section rules, panel edges, ruler minor ticks.
- **Field Edge** (#66737a): control borders and ruler major ticks; at least 3:1 against the mat and the rails, so every control edge is visible.
- **Chalk Text** (#e9eef0): primary text, and the double rule over the deck total.
- **Pencil Muted** (#a3afb4): secondary text, ruler numerals, totals' secondary counts.
- **Sheet Paper** (#f5f6f2): the sheet preview only. It is the brightest thing on screen.

### Status
- **Warning Amber** (#eed98a), **Danger Coral** (#ff9c95), **OK Green** (#a1d7aa): text and borders for warnings, destructive actions and success states. They report state; they are never decoration.

The mat grid uses white at very low alpha (#ffffff09 minor, #ffffff14 major); hairline washes use #c8d6dc1f and #c8d6dc08; the cyan wash is Process Cyan at 10%.

### Named Rules
**The One Live Colour Rule.** Process Cyan is the only hue that means "act on this" or "this is the current one". If something is cyan, it is selected, focused, the next action, a cut line, or a change awaiting acceptance. Nothing else is cyan.

**The Changed-Until-Accepted Rule.** When the app changes a setting on the user's behalf, the value stays cyan in the job ticket, with a note and explicit choices, until the user accepts it. The output never changes silently.

**The Paper Is Brightest Rule.** Sheet Paper is reserved for the sheet. No UI surface is lighter than Chalk Text, and no surface uses the paper colour.

## Typography

**Body Font:** system-ui (with -apple-system, Segoe UI, Roboto, sans-serif)
**Label/Mono Font:** ui-monospace (with SF Mono, Cascadia Mono, DejaVu Sans Mono, Menlo, Consolas, monospace)

**Character:** The machine's own sans for words, the machine's own mono for numbers: a printed form, not a brand. No web fonts load for the UI.

### Hierarchy
- **Title** (600-650, 18px, 1.4): column headings (Cards, Job ticket), step and empty-state headings, gallery names.
- **Body** (400, 14px, 1.4): default text, buttons, card names, ticket labels.
- **Label** (400, 12px, 1.4): hints, meta lines, tags, compact buttons, bar status.
- **Numeral** (mono, 12px, tabular): every number and measurement: set codes and collector numbers, ticket values, the job summary, zoom, sheet dimensions, page counts.
- **Numeral Strong** (mono 700, 14px, tabular): decklist quantities and the deck total.

On phones (820px and below) inputs, selects and textareas are set at 16px so the browser does not zoom on focus. Ruler numerals are 11px mono; they are instrument markings, not text.

### Named Rules
**The Mono Numbers Rule.** A number is set in mono with tabular figures wherever it appears, including inside sentences of status text. Words never are.

**The Three Sizes Rule.** UI text uses 12, 14 and 18px. Hierarchy beyond that comes from weight and placement, not new sizes.

## Layout

Three columns over a fixed footer. The header is one row: name, the Print at home / Order prints segment, the deck picker, and a mono count. Below it, a left rail holds the decklist, a right rail holds the job ticket (each clamp(250px, 22vw, 280px)), and the centre is the mat. The sheet controls sit in one row directly under the header, with the rulers just below them; the sheet is shown at fit scale with its mm dimensions beneath it in mono. The footer (52px) carries the job summary in mono on the left and Print settings plus the cyan Review export on the right.

The mat grid is part of the layout, not a texture. The preview sets the grid to the sheet's zoom: 10 mm minor and 50 mm major squares, tightening to 5 mm and 10 mm once the zoom is high enough, with the grid origin moved onto the sheet's top-left corner. The rulers hang off the sheet's top and left edges and move with it, with numerals every 50 mm (every 10 mm at high zoom). In order mode the grid returns to the stage origin.

Spacing steps are 4, 8, 12, 16 and 24px. Controls are 36px tall, 42px at 820px and below. At 820px and below the rails collapse: the header wraps to two rows with the deck picker on the second, a bottom tab bar switches between Cards, Preview (with a mono count) and Print settings, and the job ticket gives way to the setup view. At 480px and below the header's Project files button becomes a drawn icon, and at 360px the name hides.

## Elevation & Depth

The workspace is flat. Depth comes from tone: the mat, the rails one step lighter, inputs one step darker, all separated by hairline rules. Settings sections, preset tables, the selected-card strip and the order gallery lie directly on the mat with no fill and no box. Only overlays leave the surface.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 18px 46px #0a0c0dc2, 0 2px 6px #0a0c0d80`): dialogs, the quick-setup popover and the toast.
- Dropdown menus, the context menu and the narrow-screen job ticket drawer use the same overlay shadow. There is one elevation, not a ladder.
- **Scrim** (`--scrim`, graphite at 72%): behind dialogs and the busy indicator.

### Named Rules
**The Flat On The Mat Rule.** Nothing on the workspace casts a shadow or sits in a box inside another box. A section is a rule above a heading, not a card. If it does not float over the workspace, it does not lift.

## Shapes

Small, square-ish corners, as on cut stock and print-shop hardware: 3px for buttons and inputs, 4px for menus, tiles and the toast, 6px for dialogs and popovers. Flattened elements (decklist rows, settings sections, preset cells) use no radius at all. Edges are 1px hairlines; the one heavy rule is the 3px double rule above the deck total. Selection is drawn as crop-mark corners: 3px cyan L-brackets at the corners of a selected card on the sheet, and 9px corner brackets offset outside a selected decklist row.

## Components

### Buttons
Plain and square-shouldered; they look like keys on a machine panel.
- **Shape:** gently squared (3px), 36px minimum height (42px on touch layouts).
- **Default:** Rail Raised fill, Field Edge border, Chalk Text label.
- **Primary:** Process Cyan fill and border, Cyan Dark Ink label at weight 700. Used once per area for the next step (Review export, Change selected art).
- **Hover / Focus / Active:** default buttons take a 35% cyan border on hover; primary brightens to Process Cyan Hover. Focus is a 2px Focus Cyan outline offset 2px. Pressing scales to 0.98 over 150ms.
- **Danger:** Danger Coral label on the default button.

### Segmented Controls
- **View segments** (Front / Back / Guides and similar): a Sunk Well track with a Field Edge border and 4px radius; segments are muted text with no fill, and the active one is filled Process Cyan with Cyan Dark Ink at weight 600.
- **Mode switch** (Print at home / Order prints): a Sunk Well track with a Hairline Rule border and 3px inner padding; the active mode takes the 10% cyan wash, Cyan Ink text and a faint inset cyan edge, so it reads as the current place rather than an action.

### Inputs / Fields
- **Style:** Sunk Well fill, Field Edge border, 3px radius, 6px 9px padding.
- **Focus:** the shared 2px Focus Cyan outline.
- **Selects** use a drawn chevron, not a glyph.

### Decklist
The card list reads as a printed tournament decklist.
- **Rows:** no fill, no radius, a Hairline Rule under each row, 46px minimum. Columns are quantity (Numeral Strong, editable in place with a border only on hover and focus), thumbnail, name with a mono set-code meta line, and a row menu.
- **Hover:** a faint fill wash.
- **Selected:** the 10% cyan wash plus cyan corner brackets outside the row's top-left and bottom-right.
- **Total:** a 3px double rule in Chalk Text, the count in Numeral Strong, the unique-name count in muted mono.

### Job Ticket
The inspector reads as a print-shop job ticket.
- **Rows:** a 64px label column in body sans, then the value as a borderless button in 12px tabular mono, ruled between rows.
- **Changed:** a value the app changed is cyan text with a cyan border, followed by a note in Cyan Ink with explicit choices, until accepted.

### Sheet On The Mat
The preview sheet in Sheet Paper on the scaled grid, with mm rulers on its top and left edges and its page size in mono below. Card selection on the sheet is the crop-mark overlay; selected tiles in the order gallery take the cyan wash instead.

### Settings And Presets
Settings sections are flat on the mat: a Hairline Rule above each, 16px vertical padding, no fill, no radius. Presets are a ruled table: cells separated by 1px Hairline Rule gaps, the chosen preset marked with the cyan wash.

### Icons
Drawn inline SVG line icons, 16px, 1.5 stroke, round caps and joins, in currentColor.

## Do's and Don'ts

### Do:
- **Do** keep Process Cyan (#33bfe8) for selection, focus, the primary action, cut lines and changed-until-accepted values only.
- **Do** set every number in system mono with tabular figures.
- **Do** separate sections with a 1px Hairline Rule (#3a4246) and lay them flat on the mat.
- **Do** keep control borders at Field Edge (#66737a) or stronger so every control edge is at least 3:1.
- **Do** draw the mat grid and rulers at the sheet's own scale, aligned to the sheet's corner.
- **Do** mark selection with crop-mark corners.
- **Do** use drawn SVG icons at a 1.5 stroke.

### Don't:
- **Don't** add a second accent hue, a lavender accent, gradients or glows.
- **Don't** use glass or blurred bars, or shadows on anything that does not float over the workspace.
- **Don't** nest a bordered panel inside another bordered panel.
- **Don't** add eyebrow labels or uppercase tracked kickers above headings.
- **Don't** use a thick coloured stripe on one side of a callout.
- **Don't** introduce UI text sizes outside 12, 14 and 18px.
- **Don't** make any UI surface as bright as the sheet.
- **Don't** use the bundled serif faces (Crimson Text, Goudy Bookletter 1911, Spectral) for UI text; they exist only to render custom cards.
