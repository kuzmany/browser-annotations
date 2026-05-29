# bh-annotate

**Visual web annotation → markdown for AI coding agents.**

Open your app, click elements, type notes — then your AI coding agent (Claude Code, Cursor, etc.)
reads them as a plain markdown file and makes the changes. No Chrome extension, no MCP server,
no account. Just CDP + one small JS overlay.

![demo](docs/demo.png)

---

## Why

Tools like *Vibe Annotations* / *stagewise* do this with a Chrome extension + a local MCP server.
`bh-annotate` does the same loop with **less moving parts** if you already drive Chrome over CDP
(e.g. via [browser-harness](https://github.com/browser-use/browser-use)):

- **No extension** — the overlay is injected over CDP (or pasted into the console).
- **No server, no MCP, no license dance** — annotations live in `localStorage`; you export a `.md`.
- **Agent reads a file** — `bh-apply` writes `./.annotations/notes.md`; the agent reads it. No copy‑paste.

```
bh-open http://localhost:3000/     # open your dev app
bh-annotate                        # overlay appears → click + type notes
bh-apply                      # -> ./.annotations/notes.md
# agent reads notes.md, edits code, reload, verify — repeat
```

## What you get

| File | Role |
|---|---|
| `overlay/bh-annotate.js` | The overlay (hover highlight, click→note, numbered pins, panel). **Standalone** — also works pasted into DevTools or as a bookmarklet. |
| `bin/bh-annotate` | Injects the overlay into the current browser-harness tab via CDP; auto re-injects on reload. |
| `bin/bh-apply` | Reads `window.__bhAnno.items`, writes markdown (`./.annotations/notes.md`) + prints it. |

## Requirements

- **CDP-driven Chrome.** The wrappers target [browser-harness](https://github.com/browser-use/browser-use)
  (`browser-harness` CLI + `bh-lib.sh` for session/daemon handling). The overlay itself needs nothing.
- Works on `localhost` / `127.0.0.1` / `*.test` / `*.local` / `file://`.

## Install

```bash
git clone https://github.com/<you>/bh-annotate.git
cd bh-annotate
./install.sh          # symlinks bin/* into ~/bin and the overlay into ~/.bh-workspace
```

Or use the overlay **without browser-harness** — paste `overlay/bh-annotate.js` into the
DevTools console, annotate, then run in the console:

```js
copy(JSON.stringify(window.__bhAnno.items, null, 2))   // annotations on clipboard
```

## Usage

1. `bh-open <url>` — open your app (browser-harness).
2. `bh-annotate` — overlay loads. **Hover** highlights an element; **click** opens a note box;
   **Save** (or ⌘/Ctrl+Enter). **Alt+A** pauses/resumes; **Esc** cancels; **Clear** wipes the page.
3. `bh-apply` — writes `./.annotations/notes.md`:

```markdown
# Web annotations — 1 item(s)

Source: http://localhost:3000/

## [#1] `header > div > div > a`  — a "Order"
note: make this button green
box 95x36 @1466,1309 · color rgb(10,13,23) · bg rgb(255,90,54)
```

4. Your agent reads `notes.md`, edits, you reload (overlay re-injects), verify, repeat.

## How it works

- `bh-annotate` registers the overlay with `Page.addScriptToEvaluateOnNewDocument` (survives reloads)
  and runs it once with `Runtime.evaluate` for the current page. It removes its previous registration
  first so reloads never run stale copies.
- The overlay generates a **shortest unique CSS selector** (`#id` fast-path → `:nth-of-type` path),
  captures tag, text, bounding box and key colors, and stores everything in `localStorage` per path.
- `bh-apply` reads `window.__bhAnno.items` over CDP and formats markdown.

## License

MIT — see [LICENSE](LICENSE).
