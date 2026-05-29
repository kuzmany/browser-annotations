<div align="center">

# bh-annotate

**Point at your UI, leave a note, let your AI coding agent fix it.**

Click elements in the browser, type what you want changed, and export the notes as a
markdown file your AI agent (Claude Code, Cursor, …) reads and acts on.
No Chrome extension. No MCP server. No account. Just CDP + one small JS overlay.

![License: MIT](https://img.shields.io/badge/License-MIT-FF5A36.svg)
![Shell](https://img.shields.io/badge/shell-bash-555.svg)
![Works with](https://img.shields.io/badge/works%20with-Claude%20Code%20·%20Cursor%20·%20Codex-FF5A36.svg)
![No extension](https://img.shields.io/badge/no-extension%20·%20no%20MCP-2AABEE.svg)

<img src="docs/demo.png" alt="bh-annotate: numbered pins on a live page and the annotations panel" width="820">

</div>

---

## The loop

```bash
# open your app in a Chrome with --remote-debugging-port  (or `bh-open <url>`)
bh-annotate --url localhost:3000   # inject the overlay → click elements, type notes
bh-apply    --url localhost:3000   # -> ./.annotations/notes.md
#  → your agent reads notes.md, edits the code, you reload & verify — repeat
```

`bh-annotate` to mark up, `bh-apply` to hand the notes to your agent. That's it.

## Why

Tools like *Vibe Annotations* and *stagewise* do this with a Chrome extension **and** a local
MCP server. `bh-annotate` gets the same result with far fewer moving parts — because if you already
drive Chrome over CDP, the browser *is* the integration:

- **No extension to install or maintain.** The overlay is injected over CDP (or pasted into the console / run as a bookmarklet).
- **No server, no MCP, no license to accept.** Annotations live in `localStorage`; you export a plain `.md`.
- **Agent-native.** Your agent reads a file in the repo — no copy‑paste, no protocol, works with any tool that can read files.
- **Survives reloads.** Pins persist per URL and the overlay re-injects itself after every navigation, so the annotate → edit → reload → verify loop never loses state.

## Requirements

- **Python 3** (standard library only — the CDP client is dependency-free) and
- **a Chrome with remote debugging** — `chrome --remote-debugging-port=9222`.
- **browser-harness is optional** — only handy for `bh-open` (opening tabs in the right profile). The CLI talks to Chrome directly; it does not need it.
- The **overlay itself needs nothing** — paste `overlay/bh-annotate.js` into DevTools or run it as a bookmarklet on any page.
- Works on `localhost`, `127.0.0.1`, `*.test`, `*.local`, and `file://`.

## Install

There are two layers — the **skill** (how the agent uses it) and the **runtime** (the CLI + overlay).

### 1. The skill — any agent, via [skills.sh](https://www.skills.sh)

```bash
npx skills add kuzmany/bh-annotate              # installs to every agent you have (Claude Code, Cursor, …)
npx skills add kuzmany/bh-annotate -a claude    # or target one;  --agent '*' for all
```

Then the whole loop is one sentence — no commands to remember:

> **"open localhost:3000 for comments"**

The agent opens the page, injects the overlay, waits while you click + note, then runs `bh-apply`,
reads your notes, edits the code, and reloads to verify. Say *"pull"* / *"done"* when you're finished marking up.

### 2. The runtime — `bh-annotate` / `bh-apply` CLI + overlay

The skill calls two small commands (`bh-annotate`, `bh-apply`) — a thin shell wrapper over a
dependency-free Python CDP client. Install them once:

```bash
git clone https://github.com/kuzmany/bh-annotate.git
cd bh-annotate && ./install.sh   # symlinks bin/* → ~/bin, overlay → ~/.bh-workspace, skill → ~/.claude/skills
```

Needs only **Python 3** + a Chrome with `--remote-debugging-port`. Point it at your browser with
`--cdp`, `$CDP_URL`, or `$BU_CDP_WS` (defaults to `http://localhost:9222`). `install.sh` also installs
the skill locally, so you can skip step 1.

### Standalone (nothing installed)

Paste `overlay/bh-annotate.js` into the DevTools console, annotate, then export from the console:

```js
copy(JSON.stringify(window.__bhAnno.items, null, 2))   // annotations on your clipboard
```

Or make it a **bookmarklet** — `javascript:(function(){…paste the file…})()` — and annotate any page with one click.

## Commands

| Command | What it does |
|---|---|
| `bh-annotate [--url SUB] [--cdp URL]` | Inject the overlay into a Chrome tab over CDP. Auto re-injects on reload; removes its previous registration so reloads never run stale copies. `--url` pins a tab by URL substring. |
| `bh-apply [--url SUB] [--cdp URL] [--out PATH] [--json]` | Read `window.__bhAnno.items` from the tab and write markdown to `./.annotations/notes.md` (or `--out`) for your agent to apply. `--json` prints raw JSON. |

Endpoint resolution: `--cdp` → `$CDP_URL` → `$BU_CDP_WS` → `http://localhost:9222`. With several tabs open, pass `--url` to pin the right one.

**In the overlay:** hover highlights an element · click opens a note box · **Save** (or ⌘/Ctrl+Enter) ·
**Esc** cancels · **Alt+A** pause/resume · **Clear** wipes the page · the **✕** on a row deletes one.

## Output

`bh-apply` writes a compact, agent-friendly markdown file:

```markdown
# Web annotations — 2 item(s)

Source: http://localhost:3000/

## [#1] `header h1`  — h1 "Welcome"
note: bigger, bolder headline
box 617x96 @345,180 · color rgb(20,20,20) · bg rgba(0,0,0,0)

## [#2] `header > div > div > a`  — a "Order"
note: make this button green
box 95x36 @1466,1309 · color rgb(10,13,23) · bg rgb(255,90,54)
```

Each item carries a **unique CSS selector**, the element tag/text, and its box + colors — enough for an
agent to locate and change the right thing without guessing.

## How it works

1. `lib/cdp.py` is a ~150-line, **dependency-free** CDP client (stdlib WebSocket): it connects to the
   **browser-level** endpoint, lists targets, and `Target.attachToTarget {flatten:true}` to drive the chosen
   page over one session — so it works locally and through a remote tunnel with no per-target host rewrite.
2. `bh-annotate` registers the overlay with `Page.addScriptToEvaluateOnNewDocument` (so it returns on every
   reload) and runs it once with `Runtime.evaluate`. It removes its previous registration first, so reloads
   never stack stale copies.
3. The overlay builds the **shortest unique selector** for each clicked element (`#id` fast-path →
   `:nth-of-type` path, short-circuiting as soon as it's unique), captures tag, text, bounding box and key
   colors, and stores everything in `localStorage` keyed by path.
4. `bh-apply` reads `window.__bhAnno.items` back over CDP and formats the markdown.

Because injection happens in the CDP eval world, it is **CSP-safe** and works even on pages that block inline scripts.

## Limitations

Deliberately small and honest:

- Elements inside **shadow DOM** and cross-origin **iframes** aren't resolved into selectors.
- A pin on a `position: fixed` element drifts when the page scrolls (the note + selector are still correct).
- Selectors are unique *now*; large DOM refactors between annotate and apply can stale them — re-annotate if so.

## License

[MIT](LICENSE) © 2026 Zdeno Kuzmany
