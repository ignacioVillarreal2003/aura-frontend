---
name: AURA
description: Enterprise AI assistant for internal teams — chat, document generation, and collaborative knowledge work.
colors:
  thought-violet: "#6366F1"
  thought-violet-deep: "#7C3AED"
  thought-violet-light: "#A5B4FC"
  thought-violet-pale: "#C7D2FE"
  shell: "#1E1B18"
  surface-content: "#151515"
  surface-raised: "#1A1A1A"
  surface-composer: "#1C1C1E"
  surface-card: "#2C2824"
  border-subtle: "#2A2A2A"
  border-strong: "#525252"
  text-ink: "#E2E8F0"
  text-muted: "#9CA3AF"
  text-ghost: "#6B7280"
  user-gradient-start: "#667EEA"
  user-gradient-end: "#764BA2"
  destructive: "#EF4444"
  destructive-light: "#F87171"
  shell-light: "#E7E5E4"
  surface-light: "#F5F5F4"
  text-ink-light: "#1E293B"
typography:
  display:
    fontFamily: "Chillax, sans-serif"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Sora, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Sora, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.62
    letterSpacing: "0.01em"
  label:
    fontFamily: "Sora, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  xs: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  "2xl": "16px"
  surface: "20px"
  shell: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
  "3xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.thought-violet}"
    textColor: "#FFFFFF"
    rounded: "{rounded.xl}"
    padding: "0 1rem"
    size: "2.5rem"
  button-primary-hover:
    backgroundColor: "{colors.thought-violet-deep}"
    textColor: "#FFFFFF"
    rounded: "{rounded.xl}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.lg}"
    size: "2.5rem"
  button-ghost-hover:
    backgroundColor: "rgba(255,255,255,0.08)"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.lg}"
  chip-active:
    backgroundColor: "rgba(99,102,241,0.18)"
    textColor: "{colors.thought-violet-light}"
    rounded: "{rounded.xl}"
    padding: "0.25rem 0.625rem"
  chip-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.xl}"
    padding: "0.25rem 0.625rem"
  input-composer:
    backgroundColor: "{colors.surface-composer}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.surface}"
  message-user:
    backgroundColor: "{colors.thought-violet}"
    textColor: "#FFFFFF"
    rounded: "14px"
    padding: "12px 14px"
  message-assistant:
    backgroundColor: "rgba(255,255,255,0.04)"
    textColor: "{colors.text-ink}"
    rounded: "14px"
    padding: "14px 16px"
---

# Design System: AURA

## 1. Overview

**Creative North Star: "The Senior Collaborator"**

AURA's interface does not announce itself. It arrives already knowing what you need, steps out of the way while you think, and surfaces itself again exactly when you act. The aesthetic is not minimal for its own sake — it is minimal because decoration would compete with the AI's output, and the output is the product. Every surface decision asks the same question: does this element serve the work, or does it serve the interface?

The visual system is built on a two-layer dark ground: a warm near-black shell (`#1E1B18`) that frames the workspace, and a cooler near-black content surface (`#151515`) where messages, artifacts, and editors live. Thought Violet — the indigo-to-violet accent — does not appear as ambient color. It appears only when the system is asking for attention: a send button, an active selection, a focus ring. Anywhere else it would be noise.

This is an enterprise tool for professionals who return to the same workflows every day. Familiarity and predictability are features. Motion conveys state, not personality. Shadows establish hierarchy, not drama. The type is legible, dense without feeling cramped, and never competes with AI-generated content in the reading column.

**Key Characteristics:**
- Warm two-layer dark foundation (shell below content surface)
- Single accent color (Thought Violet) used only for action and selection
- Sora for UI chrome and labels; Manrope for prose and long-form content
- Chillax reserved for display moments (brand identity, not functional UI)
- Hybrid elevation: tonal layering as floor, shadows only for floating elements
- 150-250 ms transitions; motion tied strictly to state change
- Full light-mode parity — not an inversion, a genuine resolved alternative

## 2. Colors: The Thought Violet System

The palette is restrained by design. One saturated color signals action; everything else is structured silence.

### Primary

- **Thought Violet** (`#6366F1` / oklch(60% 0.21 267)): The primary action color. Used on the send button, active selections, focus rings, and badge counters. Its appearance signals "something you can act on." It never appears as decoration.
- **Thought Violet Deep** (`#7C3AED` / oklch(52% 0.26 291)): The violet terminus of the action gradient. Used in the send-button gradient and generation-mode indicators. Slightly warmer and more saturated; carries more urgency than flat indigo.
- **Thought Violet Light** (`#A5B4FC`): Used for accent text on dark surfaces — active pill labels, link text in markdown, list markers in AI output. Readable against `#151515` at the required contrast.
- **Thought Violet Pale** (`#C7D2FE`): Hover state for active text elements. Implies elevation without changing the element's shape.

### Secondary

- **User Blue-Purple Start** (`#667EEA`): The start of the user-message gradient. Visually distinguishes user speech from AI response at a glance without requiring labels.
- **User Blue-Purple End** (`#764BA2`): The gradient terminus for user bubbles. Pulls toward violet, maintaining kinship with Thought Violet without confusion.

### Neutral — Dark theme

- **Shell Warm** (`#1E1B18`): The outermost shell — sidebar, topbar background. Slightly warm (hue ~50) to prevent the flatness of neutral gray. This is the stage; nothing draws focus here.
- **Content Surface** (`#151515`): The main content area — the chat thread, editor, document canvas. The distinction between this and Shell Warm creates the visual hierarchy without borders.
- **Raised Surface** (`#1A1A1A`): Cards, message containers, elevated panels. Sits between shell and content in the tonal stack.
- **Composer** (`#1C1C1E`): The text input surface. Matches iOS Dark Material — slightly blue-shifted against the warm shell, creating a subtle visual anchor for the composition zone.
- **Border Subtle** (`#2A2A2A`): Hairline borders and dividers. Never structural — only used to separate sections already distinguishable by tonal difference.
- **Border Strong** (`#525252`): Visible borders for interactive components (focus rings exceed this value).
- **Text Ink** (`#E2E8F0`): Primary text on dark surfaces. Slightly blue-shifted from pure white — more comfortable at long reading sessions.
- **Text Muted** (`#9CA3AF`): Secondary text: timestamps, labels, placeholder copy, sidebar metadata.
- **Text Ghost** (`#6B7280`): Tertiary text: hints, captions, disabled states.

### Neutral — Light theme

- **Shell Light** (`#E7E5E4`): Light-mode sidebar background. Warm stone-gray, not pure white.
- **Surface Light** (`#F5F5F4`): Light-mode content surface. Warm near-white, slightly stone-tinted.
- **Text Ink Light** (`#1E293B`): Dark navy — primary text on light surfaces. More character than black; reads as professional, not harsh.

### Destructive

- **Alert Red** (`#EF4444`): Error states, destructive actions, delete confirmations. Never used for emphasis. When this appears, something needs attention.
- **Alert Red Light** (`#F87171`): Hover state text on dark for destructive actions.

### Named Rules

**The Thought Violet Rule.** Thought Violet and its ramp appear only on interactive or stateful elements: buttons, active selections, focus rings, progress indicators, count badges. It is never used as ambient decoration, background fill, or section color. Its rarity is what makes it register.

**The Two-Layer Rule.** The dark theme is built on two distinct tonal layers: the warm shell and the cooler content surface. These must never be the same value. If a component sits on the wrong layer, it flattens the hierarchy.

## 3. Typography

**Display Font:** Chillax (variable, 200–700), sans-serif fallback
**UI/Label Font:** Sora (variable or static), sans-serif fallback
**Body/Prose Font:** Manrope (variable, 200–800), serif fallback

**Character:** Chillax is the brand voice — geometric, confident, used sparingly for identity moments. Sora handles all UI chrome: the tool's own language (labels, buttons, mode selectors, sidebar nav). Manrope takes over for reading: AI output, markdown-rendered prose, and long-form document content. The pairing works because Sora is decisively geometric-neutral and Manrope is humanist-warm — they contrast without competing.

**Note on current state:** Sora is now self-hosted (`public/fonts/Sora-Variable.ttf`, variable 200–800) with an `@font-face` declaration in `fonts.css`, exposed via the `--font-ui` token. The "Sora-in-Chrome Rule" is in effect across the UI.

### Hierarchy

- **Display** (Chillax, 500–600, 2.25–3rem, lh 1.1, ls -0.02em): Brand moments only — the AURA wordmark, hero text on auth screens. Not used in app UI labels or headings.
- **Headline** (Sora, 600, 1.5rem, lh 1.25, ls -0.01em): Section and page-level headings inside the app (welcome title, document editor headings). Used with `text-wrap: balance`.
- **Title** (Sora, 600, 1.125rem, lh 1.35): Card titles, chat session title, drawer headings, modal titles.
- **Body** (Manrope, 400, 1rem, lh 1.62, ls 0.01em): All AI-generated prose, markdown-rendered content in the message thread. Max line length 65–75ch where content width allows.
- **Label** (Sora, 500, 0.8125rem, lh 1.2): Sidebar nav links, mode selector triggers, dropdown items, button text, chip labels. The workhorse of the UI chrome.
- **Caption** (Sora or Manrope, 400–500, 0.75rem, lh 1.2): Timestamps, metadata, hints. Color: Text Muted.

### Named Rules

**The Sora-in-Chrome Rule.** Sora is for the tool's own voice: navigation, controls, labels, buttons, menu items. Manrope is for content the AI produces. When markdown renders inside a chat bubble, Manrope takes over. When the interface speaks (a button label, a placeholder), Sora speaks. Never use Manrope for UI controls or Sora for long-form body copy.

**The No-Display-in-Chrome Rule.** Chillax never appears in functional UI: no button labels, no nav items, no form fields, no tooltips. Its presence signals brand context, not product UI. Overuse destroys the distinction.

## 4. Elevation

AURA uses a hybrid elevation model: tonal layering defines the static spatial hierarchy; targeted shadows mark floating and interactive elements.

The floor is three tonal steps — shell (`#1E1B18`) → content surface (`#151515`) → raised surface (`#1A1A1A`) — each perceptibly different under normal viewing conditions. These layers need no shadows to communicate their position. Borders between them are used sparingly (1px `#2A2A2A`) or not at all when tonal contrast is sufficient.

Above the floor, shadows enter: the composer sits on the content surface but appears slightly elevated through a deep ambient shadow combined with an inner border. Dropdowns and menus float above everything with the strongest shadow vocabulary. The send button glows — its Thought Violet drop shadow is the only colored shadow in the system.

### Shadow Vocabulary

- **Ambient Float** (`0 12px 40px rgba(0, 0, 0, 0.35)` + inner `0 0 0 1px rgba(0, 0, 0, 0.35) inset`): The composer surface. Large spread, low opacity — diffuse rather than directional.
- **Focus Glow** (`0 0 0 3px rgba(99, 102, 241, 0.18)`): Composer focus state. Uses Thought Violet at low opacity — the only moment the accent color bleeds into elevation.
- **Action Glow** (`0 4px 14px rgba(99, 102, 241, 0.35)`): The send button at rest. Rises to `0 6px 18px rgba(99, 102, 241, 0.45)` on hover. Signals the primary action point visually.
- **Menu Float** (`0 8px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3)`): Dropdowns and context menus. Stronger — these elements genuinely float above all content.
- **Overlay Deep** (`0 20px 50px rgba(0, 0, 0, 0.45)`): Drop-zone overlays, drag states. Maximum ambient shadow; signals total z-stack dominance.

### Named Rules

**The Colored-Shadow Exception Rule.** Only the send button (primary action) uses a colored shadow. It is the only element in the entire system that uses Thought Violet in a shadow. All other shadows are black-based. Any new shadow added must be black-based unless it is specifically a primary-action state indicator.

**The Flat-Floor Rule.** Static surfaces are flat. The sidebar, topbar, content background, and message thread carry no shadows. Shadows enter only when an element lifts above the static floor (the composer, dropdowns, modals). If a shadow is on a surface that doesn't need to float, remove it.

## 5. Components

### Buttons

Clean, decisive, state-rich. No decorative borders at rest; borders appear only as a focus or selected-state response.

- **Shape:** Rounded rectangle (12px / `--radius-xl`) for standard buttons; full-pill (9999px) for icon-only circular actions and some inline pills.
- **Primary (Send):** Thought Violet → Thought Violet Deep gradient at 135°. Size: 40×40px. Hover: `brightness(1.06)` + expanded shadow. Disabled: `opacity: 0.38`.
- **Ghost/Icon Button (Action):** Transparent background, Text Muted icon. 26–40px square, 6–12px radius. Hover: `rgba(255,255,255,0.08)` background, Text Ink icon.
- **Mode Trigger (Composer):** 40px tall, border `1px solid rgba(255,255,255,0.1)`, slight background tint at rest. Active state: `rgba(99,102,241,0.12)` fill, `rgba(99,102,241,0.35)` border, Text Violet Light text.
- **Destructive (Hover):** Ghost button that shifts to `rgba(239,68,68,0.12)` background, Alert Red Light text on hover. Never pre-colored; danger is revealed on intent.
- **Focus:** All interactive elements receive a 3px Thought Violet focus ring at 18% opacity. No outline-none without replacement.

### Chips and Pills

Used for mode selection, file attachments, and filter states. Pill shape (full-radius) or rounded (12px) depending on context.

- **Active chip:** `rgba(99,102,241,0.18)` fill, `rgba(99,102,241,0.40)` border, Text Violet Light label.
- **Inactive chip:** No fill, low-opacity border or borderless, Text Muted label. Hover brings a subtle Thought Violet tint.
- **File attachment chip:** `rgba(99,102,241,0.12)` fill, `rgba(99,102,241,0.25)` border, 10px radius, `#C7D2FE` text.

### Composer Surface

The primary composition zone. This is a signature component — its elevation, border behavior, and focus state define the feel of the whole product.

- **At rest:** `--surface-composer` background, `1px solid rgba(255,255,255,0.1)` border, `--radius-surface` (20px) corners, ambient float shadow.
- **Focused:** Border shifts to `rgba(129,140,248,0.45)`, focus glow ring appears (`0 0 0 3px rgba(99,102,241,0.18)`). The ring is the only visual announcement that focus exists — no other element changes.
- **Textarea:** Fully transparent background, Sora 15px, Text Ink color. Scrollbar styled with a Thought Violet gradient thumb.

### Chat Message Bubbles

Two distinct visual languages that must be immediately distinguishable without labels.

- **User message:** Thought Violet → Thought Violet Deep gradient at 135°, 14px radius, white text. Floats right, max-width 70% or 680px.
- **Assistant message:** `rgba(255,255,255,0.04)` fill, `rgba(255,255,255,0.06)` border, 14px radius, full content width. Markdown renders inside with Manrope body, Sora headings (via `::ng-deep` overrides).
- **Typing indicator:** Three dots in Bounce animation, Text Muted color. Appears as an assistant message at rest width.

### Sidebar Navigation

Collapsible: 100px closed, 296px open. Animated at 340ms with `cubic-bezier(0.4, 0, 0.2, 1)`. The sidebar is the primary navigation shell; it anchors every session.

- **Shell:** `--bg-primary` (Shell Warm), right border `1px solid --border-color`, 24px border radius on the content edge (when floating or overlaid on mobile).
- **Nav link at rest:** Transparent, Text Primary, Sora 0.95rem. Icon: Text Muted.
- **Nav link hover:** `var(--overlay-subtle)` fill. No border change.
- **Nav link active:** `var(--accent-surface)` fill (Thought Violet at ~10% opacity), accent icon color (`var(--accent-fg)`).
- **Chat history items:** Same link shape, with a `...` context button that appears only on hover (`opacity: 0` → `1` transition).
- **Collapse behavior:** Text labels fade and scale to zero-width with a 260ms ease. Icons remain visible and centered. Transition is staggered between width and opacity for a clean accordion feel.

### Inputs and Text Fields

- **General input:** `--input` background (matches secondary), 6px radius, `--border` stroke. Focus: ring (`--ring` Thought Violet at 18%). Placeholder: Text Muted.
- **Rename input (inline):** Appears in place of the sidebar chat item text. `#2A2A2A` background, 6px radius, 1px Thought Violet border. Exits on Enter or blur.

### Dropdown Menus

Floating menus (mode selectors, context menus). Position: above trigger by default (`bottom: calc(100% + 6px)`).

- **Container:** `--surface-composer` fill, 12px radius, 1px `rgba(255,255,255,0.1)` border, Menu Float shadow.
- **Item at rest:** Transparent, Text Muted, Sora 0.8125rem 500.
- **Item hover:** `var(--overlay-hover)` fill, Text Ink.
- **Item active:** `rgba(99,102,241,0.12)` fill, Text Violet Light.
- **Scrollbar (where needed):** Thin, Thought Violet thumb.

### Artifact Card

A signature component for AI-generated documents surfaced in the chat thread.

- **Container:** `rgba(255,255,255,0.04)` fill, `rgba(255,255,255,0.10)` border, 12px radius, 14px/16px internal padding.
- **Type badge:** `rgba(129,140,248,0.15)` fill, `#A5B4FC` text, pill shape (20px radius), 11px Sora 600.
- **Open button:** `rgba(99,102,241,0.12)` fill, `rgba(99,102,241,0.50)` border, 7px radius. Hover: fill rises to `0.28`. Sora 13px 500.
- **Status indicators:** Final = `#6EE7B7` (green), Draft = `#FBBF24` (amber), Archived = `#9CA3AF` (muted). Lowercase, 10px caption.

## 6. Do's and Don'ts

### Do

- **Do** use Thought Violet exclusively on actionable and stateful elements — buttons, active selections, progress, focus rings, count badges.
- **Do** maintain the two-layer dark hierarchy: Shell Warm (`#1E1B18`) as the outermost container, Content Surface (`#151515`) as the reading and composition area. These must read as distinct layers without relying on borders.
- **Do** use Sora for all UI chrome (labels, nav links, button text, pills, placeholders) and Manrope for all AI-generated prose and long-form reading content.
- **Do** keep transitions at 150–250 ms for state changes. The composer focus ring and button hover responses should feel immediate, not choreographed.
- **Do** use 12px radius for dropdowns and menus, 20px for the composer surface, 24px for floating panels. These three radii define three spatial zones; applying them consistently builds a coherent depth language.
- **Do** distinguish user messages from assistant messages visually at a glance: user messages are Thought Violet gradient bubbles; assistant messages are near-invisible subtle containers at full width.
- **Do** use ghost buttons that reveal their danger only on hover (shift to destructive red background) rather than pre-coloring them red. The intent to delete should trigger the danger visual, not its passive presence.

### Don't

- **Don't** use Thought Violet as a section background, hero fill, card accent, or ambient decoration. It is an action signal; treating it as an aesthetic color destroys that function.
- **Don't** design AURA to look like a generic SaaS dashboard: no blue-primary card grids, no metric widgets with large numbers and small labels, no enterprise-boilerplate spacing and shadows.
- **Don't** use consumer chatbot conventions: no bubbly rounded chat layouts with full-saturation color gradients on both sides of the conversation, no gamified icons or mascots.
- **Don't** copy the ChatGPT layout: no white-card center-column on a neutral background, no monochrome sidebar with minimal visual differentiation. AURA has a warm two-layer ground, not a neutral flat canvas.
- **Don't** use `border-left` greater than 1px as a colored accent stripe on cards, messages, or alerts. Use background tints or full borders instead.
- **Don't** use Chillax (the display font) in functional UI contexts — nav items, button labels, form fields, modal titles, data tables. Chillax is for brand moments only.
- **Don't** add shadows to static surfaces (the sidebar, content background, topbar). Shadows are for floating elements only. A shadow on a flush surface reads as a visual error, not depth.
- **Don't** apply gradient text (`background-clip: text` with a gradient fill). Use a single solid Thought Violet Light (`#A5B4FC`) for accent text emphasis.
- **Don't** use the same send-button gradient (`#6366F1 → #7C3AED`) for backgrounds, section fills, or decorative bands. It belongs on the send button — one element, one usage.
- **Don't** gate content visibility on animation. Reveal transitions must enhance content that is already visible at rest. If a section's opacity starts at 0 and the animation doesn't fire, the section ships blank.
