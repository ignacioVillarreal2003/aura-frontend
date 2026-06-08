---
timestamp: 2026-06-08T02-07-36Z
slug: src-app-features-chat
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No success toast for message actions; icon toggle alone is ambiguous |
| 2 | Match System / Real World | 3 | "Acción automática" vague; "Artefactos" is borderline jargon |
| 3 | User Control and Freedom | 3 | Cancel/back paths solid; no undo anywhere for destructive operations |
| 4 | Consistency and Standards | 3 | 'RAG' label survived in checklists panel (line 740); 3 terms for the same concept |
| 5 | Error Prevention | 3 | Destructive confirm overlay works; no char-count display on rename |
| 6 | Recognition Rather Than Recall | 2 | 9-item composer mode dropdown; icon-only action toolbar (hover-dependent) |
| 7 | Flexibility and Efficiency | 2 | Enter-to-send works; no shortcuts for mode switching or drawer; no bulk actions |
| 8 | Aesthetic and Minimalist Design | 3 | Clean; 9-item mode list and 9-action drawer management list push the limit |
| 9 | Error Recovery | 2 | No toast/notification infrastructure; silent failures on network errors |
| 10 | Help and Documentation | 1 | AI mode hints are the only contextual help; no help system |
| **Total** | | **25/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment**: This does not read as AI-generated. The violet brand identity is applied consistently, the motion system is purposeful (token materialization is genuinely distinctive), and the drawer's semantic color-per-section wayfinding shows intentional design decisions. The composer surface feels like a considered product choice, not a template fill-in. No absolute-ban violations: no gradient text, no glassmorphism used decoratively, no side-stripe borders > 1px as accent. The one aesthetic concern is the 9-item mode dropdown, which starts to feel like "feature gravity" rather than intentional design — adding modes rather than rethinking the mental model.

**Deterministic scan**: The detector returned zero findings across all three HTML files (chat-session.html, chat-options-drawer.html, chat-sidebar.component.html). Exit code 0. No AI slop patterns detected programmatically.

**Visual overlays**: Browser automation was not available in this environment. No live-server overlay was run. Findings are based on source review only.

## Overall Impression

The core chat experience is solid. Token materialization, streaming cursor, and the motion system set it apart from generic chat UIs. The weak point is discoverability: mode switching requires remembering 9 unlabeled options, message actions are invisible by default and icon-only on reveal, and errors silently fail with no toast feedback. The product punishes new users and mobile users while rewarding desktop power users who have already learned its patterns.

## What's Working

1. **Token materialization + streaming cursor** — The blur-in stagger animation on AI responses is genuinely uncommon and creates a premium "text materializing" feel. The streaming cursor with the exact same violet hue ties it cleanly to the brand. This is a differentiator.

2. **Drawer section tile navigation** — Each section (chat, participants, documents, pinned, bookmarks, artifacts) has its own semantic hue on the icon background — teal for participants, blue for docs, amber for pinned, etc. This is spatial memory-building done correctly. Users learn the color, not just the label.

3. **Reduced-motion and focus-ring coverage** — Every animation has a `prefers-reduced-motion` override. Every interactive element has a `:focus-visible` ring. This is done more thoroughly than 95% of production UIs.

## Priority Issues

### [P1] 9-item composer mode dropdown overwhelms working memory

**Why it matters**: Miller's Law (Cowan, 2001) puts working memory at 4 items. The mode dropdown presents up to 9 options (Chat, Informe, Checklist, Quiz, Línea de tiempo, Lecciones aprendidas, Brief de decisión, Resumen de documentos, Acción sobre documentos) with no grouping, no descriptions, and no preview of what changes when a mode is selected. Users scan the list, don't recognize half the names, and default back to Chat mode. The AI tool modes ("Brief de decisión," "Lecciones aprendidas") are high-value features that go undiscovered.

**Fix**: Group modes into 2 semantic clusters with section headers inside the dropdown: **Conversación** (Chat) and **Herramientas** (Informe, Checklist, Quiz, etc.) — then add a one-line hint per tool mode, matching the style already used in the AI mode items (`.ai-mode-item__hint`). The infrastructure already exists; apply it to the composer mode items.

**Suggested command**: `/impeccable layout`

---

### [P2] Icon-only message action toolbar — invisible by default, broken on touch

**Why it matters**: The toolbar has 7 buttons (thread, thumb-up, thumb-down, PDF, bookmark, pin, delete). It lives at `opacity: 0` until hover. On touch devices (no hover), it never appears. On desktop, there's no signal it exists until the user accidentally hovers. First-time users miss it entirely; they cannot thread-reply or bookmark. The actions most important to the product (thread, bookmark) are the hardest to discover.

**Fix**: Set `.message-actions` to `opacity: 0.45` by default (not zero) so users can see buttons exist. Add `aria-label` role confirmation, and consider a persistent "..." overflow button on mobile that expands the toolbar via tap. The existing `:focus-within` trigger already handles keyboard reveal correctly.

**Suggested command**: `/impeccable bolder`

---

### [P2] 'RAG' label survived the clarify pass — checklist mode inconsistency

**Why it matters**: The reports panel shows `'Con documentos'` at line 656 of chat-options-drawer.html. The checklists panel shows `'RAG'` at line 740. The composer gen-mode-pills say `'Con docs'`. Three different labels for the same "mode: rag" data field. Users moving between reports and checklists see inconsistent terminology; the technical acronym RAG leaks to users who don't know what it means.

**Fix**: Change `c.mode === 'rag' ? 'RAG'` to `c.mode === 'rag' ? 'Con documentos'` at chat-options-drawer.html line 740. One-line fix.

**Suggested command**: `/impeccable clarify`

---

### [P2] No post-action feedback — silent success and failure

**Why it matters**: Bookmarking, pinning, toggling feedback, exporting PDFs, renaming, tagging, inviting — none of these have visible success/failure feedback beyond a subtle icon state change. If a network request fails, the icon reverts (or doesn't), with no message. The confirm overlay correctly handles pre-action confirmation, but there's nothing after the action. Users cannot tell if their action was saved or silently dropped.

**Fix**: Add a lightweight toast/snackbar service at the chat feature level (Angular signal-based, can be a simple `<div>` with animation). Wire `.next({message, type})` calls to the post-action callbacks in chat-session.ts and chat-options-drawer.ts. The minimum viable version: success toast for bookmark/pin/rename/invite, error toast for any HTTP failure.

**Suggested command**: `/impeccable harden`

---

### [P3] Mode dropdown items lack ARIA role semantics

**Why it matters**: The `.mode-dropdown-menu` is a `div` with `button` children. The trigger has `[attr.aria-expanded]` but the menu has no `role="menu"` and the items have no `role="menuitem"`. Screen readers announce the open dropdown as generic content, not a menu. Sam cannot navigate it with standard menu keyboard patterns (arrow keys).

**Fix**: Add `role="menu"` to `.mode-dropdown-menu` and `role="menuitem"` to each `.mode-dropdown-item`. This is a 2-line HTML change.

**Suggested command**: `/impeccable audit`

## Persona Red Flags

**Alex (Power User)**: Sends messages with Enter ✓. But switching from Chat to Informe mode requires opening a dropdown, scanning 9 items, and clicking. No Cmd+Shift+[key] or any shortcut for mode switching. In the drawer, there's no keyboard shortcut to open/close it (only the top-right button click). Bulk message operations (select all, delete batch) don't exist. Alex hits the ceiling fast and resorts to mouse-heavy workflows for anything beyond basic chat.

**Sam (Accessibility-Dependent)**: Focus rings are correctly applied across all interactive elements ✓. The `:focus-within` trigger on `.message-actions` makes the toolbar visible on keyboard focus ✓. However: `.mode-dropdown-menu` lacks `role="menu"` / `role="menuitem"` — a screen reader landing on the open dropdown won't announce it as a navigation structure. The `.thread-input` uses `:focus` (not `:focus-visible`) for its border highlight — shows for mouse focus where it shouldn't. Three small low-contrast violations: `.drawer-report-card__meta` at `rgba(255,255,255,0.35)` at 11px (~3.8:1), `.drawer-artifact-card__date` at `rgba(255,255,255,0.32)` at 11px (~3.5:1), `.drawer-pagination__info` at `rgba(255,255,255,0.38)` at 11px (~4.1:1) — all below the 4.5:1 WCAG AA threshold for small text.

**Riley (Stress Tester)**: Whitespace-only messages are correctly blocked ✓. Failed document uploads show the error chip icon ✓ — but there's no message explaining why the upload failed or how to retry (user must remove the chip and re-upload). Long document names truncate at 28 chars in session chips, which may truncate before a meaningful differentiator (e.g., "Project_Q3_2026_Report_FINA..." vs "Project_Q3_2026_Report_DRAF..."). Thread replies render as plain text — if an AI response contains markdown formatting and gets threaded, the thread reply shows raw markdown syntax (`**bold**` instead of **bold**).

## Minor Observations

- `.message-time` aligns `flex-end` within the bubble. For very short messages (1-3 words), the timestamp appears immediately adjacent to the text with no visual breathing room. A `margin-top: auto` on the time element or minimum bubble height would help.
- The empty-state icon `float-idle` animation begins immediately on mount. On slow connections, the empty state could flash briefly before messages load, causing a distracting floating animation during load transitions. Consider a `animation-delay: 0.5s` to let the loading state settle first.
- `.drawer-doc-card__status` has `text-transform: capitalize` applied — but `docStatusLabel()` now returns "Procesando", "Listo", "Error" which are already capitalized. The CSS rule is now redundant.
- The "Con docs" label in the gen-mode-pills (`.gen-mode-pill`) is truncated from "Con documentos" while the drawer now says "Con documentos". This is a third variant of the mode label. Align all three to "Con documentos" or standardize on "Con docs" everywhere.
- The voice button hover state shows `color: #f87171` (red) for chat mode — suggesting danger, when it actually means "start recording." Consider a more neutral or brand-violet hover for idle state, reserving red for the stop/cancel recording states.

## Questions to Consider

- The mode dropdown now has 9 items. Is "Chat" the dominant mode (90%+ of usage), or are the AI generation modes used frequently enough to warrant equal prominence? The answer determines whether to group, tabify, or surface tool modes differently.
- Message actions are invisible by default. Was this intentional to keep the message list clean, or was discoverability deprioritized? If mobile use is in scope, the hover pattern needs to be replaced entirely.
- There is no undo for any destructive action. The confirm overlay prevents accidents, but post-confirm recovery is impossible. Would a "5-second undo window" toast (like Gmail's send undo) meaningfully reduce user anxiety for delete operations?
