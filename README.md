<div align="center">

# browser-annotations

**Point at your UI in the browser, say what to change — copy the notes straight to your AI coding agent.**

A tiny Chrome extension. No account. No server. No data leaves your browser.

![License: MIT](https://img.shields.io/badge/License-MIT-FF5A36.svg)
![Manifest V3](https://img.shields.io/badge/Chrome-MV3-555.svg)
![Works with](https://img.shields.io/badge/works%20with-Claude%20Code%20·%20Cursor%20·%20Codex-FF5A36.svg)

<img src="docs/demo.png" alt="browser-annotations: numbered pins on a live page + the annotations panel" width="820">

</div>

---

## Your agent codes the UI blind. This gives it eyes.

You ask for a change, the agent writes code it can't see, you squint at the browser and type a paragraph —
*"CTA too big, move it left, wrong green."* Slow, lossy, repeat.

**Point at the real UI instead.** Click the element, type the change, copy — paste into your agent. Each note
carries the element's **opening tag, id/class/attributes, nearby label and text** — the literal strings your
agent greps in your source — so it edits the exact code, not a guess.

## Install

Not on the Web Store yet — load it unpacked (30 seconds):

1. Clone the repo (or download it).
2. Open **`chrome://extensions`** → turn on **Developer mode** (top-right).
3. **Load unpacked** → pick the **`extension/`** folder.
4. Pin **browser-annotations** to your toolbar.

## Use it

1. **Toggle on** — click the toolbar button (or **Alt+Shift+A**). The badge turns ●.
2. **Annotate** — hover → click the element → type the change → **Save**. Repeat.
3. **Copy** — the panel's **Copy** button (or **Alt+Shift+C**) → paste the markdown into your agent.
4. Toggle off when done (same button). Pins are saved in the page's `localStorage` — they come back when you re-enable.

Works on any normal page (it can't run on `chrome://`, the Web Store, or PDFs — it'll show a red `!` if you try).

### Shortcuts

| Key | Action |
|---|---|
| **Alt+Shift+A** | toggle the overlay on/off |
| **Alt+Shift+C** | copy all notes as **markdown** |
| **Alt+Shift+J** | copy all notes as **JSON** |
| **Alt+A** | pause/resume capture (clicks pass through while paused) |
| **⌘/Ctrl+Enter** | save the note · **Esc** cancel |

Rebind any of them at `chrome://extensions/shortcuts`.

## What your agent gets

Each note leads with what you wrote, then real **source anchors** — grep those, don't guess from a positional path:

```markdown
## [#2] make this button green
`<a id="cta" class="btn primary" data-testid="order" href="/order">`  — text: "Order"
label: "Place your order"
instance: 2 of 5 matching a.btn
selector: `header > div > a` · box 95x36 @1466,1309 · color rgb(10,13,23) · css fontSize:14px padding:8px 16px borderRadius:6px
```

The agent greps `order` / `btn primary` / `data-testid="order"` / `"Order"` → finds the exact element. The
ordinal disambiguates repeated elements; the computed styles give it the before-state for "make the padding smaller".

## Built for modern apps

- **SPA-aware** — re-keys your notes on client-side navigation (`pushState`/`popstate`/`hashchange`), so notes
  don't vanish or save under the wrong route in React / Vue / Next.
- **CSP-safe** — the overlay is injected as a content script (vanilla JS, ~17 KB), no inline-eval.
- **Minimal permissions** — `activeTab` + `scripting` + `storage`. **No `host_permissions`**, no background
  network, no account. Notes live only in the page's `localStorage`.

## Roadmap

Edit/undo, resilient pin re-locate, live repositioning, action popup, options page, JSON/download exports, shadow-DOM
& same-origin-iframe capture, Web Store listing, and more — see **[extension/ROADMAP.md](extension/ROADMAP.md)**.

## License

[MIT](LICENSE) © kuzmany
