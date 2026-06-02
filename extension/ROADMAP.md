# browser-annotations — roadmap

Where the extension is and where it's going. Guiding constraints: **no account, no
server, works offline, minimal permissions** (prefer `activeTab` over broad
`host_permissions` — any item that needs more is flagged), reuse the single overlay,
keep output agent-grep-friendly.

## Shipped (v1.2.0)

- **Toggle on/off** — toolbar button or **Alt+Shift+A** (per-tab state, `destroy()` on off).
- **Source anchors** per note — id / class / all attributes / literal opening tag + text, so the agent greps the real source.
- **Richer anchors** — nearest accessible label, instance ordinal (`2 of 5 matching .btn`), and relevant computed styles (a before-state for "make the padding smaller").
- **SPA route-aware** — re-keys notes on `pushState`/`replaceState`/`popstate`/`hashchange` so notes don't vanish or save under the wrong path in React/Vue/Next apps.
- **Exports** — Copy markdown (Alt+Shift+C) · Copy JSON (Alt+Shift+J) · `window.__bhAnno.copyPrompt()` (markdown + a ready agent preamble) · `json()`.
- **Honest feedback** — copy flashes ✓/empty; non-injectable pages (chrome://, Web Store, PDF, view-source:) show a red `!` badge + title instead of failing silently; 3-step empty-state guide.

## P1 — correctness & the core loop

- **Resilient pin re-locate** (M) — when the positional selector breaks on a re-render, fall back through the captured anchors (id → opening-tag attrs → tag+text); mark recovered pins amber. AI-built UIs re-render constantly; this keeps pins attached.
- **In-list edit + undo** (M) — click a note to edit; undo stack (Cmd/Ctrl+Z) over delete/edit/Clear so a misfire isn't fatal.
- **Live pin repositioning** (M) — `ResizeObserver` + throttled `MutationObserver` so pins track responsive/lazy reflow without waiting for a scroll.
- **Robust clipboard on strict-CSP sites** (S) — ensure focus, fall back to `execCommand`, and surface failure with a toast/badge.

## P2 — discoverability, polish & store-readiness

- **Action popup** (M) — on/off status, note count, Copy-all, shortcut list (keep one-click toggle as a setting).
- **Options page** (M) — shortcut reference, accent override, default start mode, which anchors to include in output.
- **First-run onboarding** (S) — one-time 3-step card on first enable + "pin me to the toolbar" nudge.
- **Jump-to-pin** (M) — keyboard cursor through the list, Enter to scroll + flash the element.
- **Burst capture** (S) — sticky mode: stay armed for the next element after Save.
- **Pause/resume hardening** (S) — clear armed/paused badge so you never annotate by accident.
- **Real icon set + store assets** (M) — dedicated 16/32/48/128 icons + promo screenshots/descriptions (under `store/`, not packaged).
- **PRIVACY.md + permission justification** (S) — collects nothing, sends nothing, no remote code; one line per permission. Required for Web Store review.

## P3 — reach & power features

- **Armed reload-persistence** (M) — overlay survives a hard reload while armed. *Deferred from v1.2.0:* `activeTab` is revoked on navigation, so auto re-inject needs `host_permissions` (or `scripting.registerContentScripts`) — make it an explicit opt-in mode, not a silent default.
- **Cross-page aggregation** (M) — export every `bh-anno:` route as one combined markdown/JSON for whole-flow fixes.
- **Download `notes.md`** (S) — Save button + Alt+Shift+S → downloads the markdown file (parity with a disk-readable file).
- **Reorder notes** (M) — drag / Alt+Up-Down; order = priority for the agent.
- **Shadow DOM piercing** (L) — `composedPath()` capture + shadow-aware selectors for Lit/Stencil/design-system components.
- **Same-origin iframe capture** (L) — `all_frames` inject + postMessage aggregation (preview panes, Storybook).
- **Large/virtualized-page guardrails** (M) — RAF-batch layout, debounce observers, only lay out near-viewport pins.
- **Element screenshot crop** (L) — gesture-bound `captureVisibleTab` + crop → thumbnail + JSON, for vision agents.
- **Per-domain auto-enable** (M) — allowlist origins (needs `host_permissions`; opt-in).
- **Edge + Firefox builds** (L) — Edge listing is near-free; Firefox needs a gecko id + `browser.scripting` path.
- **"What's new" on update** (S) — one-time changelog line in the panel footer.

---
*Roadmap generated from a multi-lens review (UX · power-user · AI-integration · reliability · distribution). Priorities are value-to-effort with the no-account / minimal-permission constraints applied.*
