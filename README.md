<div align="center">

# bh-annotate

**Point at your UI in the browser, type what to change — your AI agent reads it and edits the code.**

No Chrome extension. No MCP server. No account. Just CDP + one small JS overlay.

![License: MIT](https://img.shields.io/badge/License-MIT-FF5A36.svg)
![Shell + Python](https://img.shields.io/badge/bash%20+%20python3-555.svg)
![Works with](https://img.shields.io/badge/works%20with-Claude%20Code%20·%20Cursor%20·%20Codex-FF5A36.svg)

<img src="docs/demo.png" alt="bh-annotate: numbered pins on a live page + the annotations panel" width="820">

</div>

---

## What it does

Open your app → click elements → type notes → your coding agent (Claude Code, Cursor, …) reads them as a
markdown file and makes the changes → reload & check. That's the whole loop.

## Install

**As a skill — any agent** (via [skills.sh](https://www.skills.sh)):

```bash
npx skills add kuzmany/bh-annotate          # Claude Code, Cursor, 50+ agents   (--agent '*' for all)
```

**The CLI it calls** — Python 3 + a Chrome started with `--remote-debugging-port` (browser-harness optional):

```bash
git clone https://github.com/kuzmany/bh-annotate && cd bh-annotate && ./install.sh
```

**No install at all?** Paste `overlay/bh-annotate.js` into the DevTools console and annotate any page.

## Use it — one sentence

> **"validate this feature on localhost:3000 in the browser"**

1. **Agent builds + self-verifies.** It makes the change, opens the page, screenshots it, and checks it
   renders and matches the request — *only then* reports done. No broken hand-offs.
2. **You review + annotate.** Annotations are already on: **hover → click → type a note → Save**.
   (Or hit **Copy** to grab all notes as markdown.) Write **"done"** when finished.
3. **Back to the CLI.** The agent reads your notes, applies each one, re-verifies in the browser, and tells
   you what changed. Loop until you're happy.

> Overlay: Save = ⌘/Ctrl+Enter · **Copy** = notes → clipboard · **Alt+A** pause · **Clear** wipes · **✕** deletes one.

## Commands (what the agent runs for you)

| Command | Does |
|---|---|
| `bh-annotate [--url SUB]` | inject the overlay (annotations on; auto re-injects on reload) |
| `bh-apply [--url SUB] [--json]` | export notes → `./.annotations/notes.md` |

Endpoint: `--cdp` → `$CDP_URL` → `$BU_CDP_WS` → `http://localhost:9222`.
`--url` pins a tab by URL; `--window ID` pins a Chrome window (auto-filled from `$BH_SESSION_WINDOW_ID`).

Each note in `notes.md` carries a **unique CSS selector** + tag/text/box — so the agent edits the exact element, no guessing:

```markdown
## [#2] `header > div > a`  — a "Order"
note: make this button green
```

## How it works

- Injects the overlay over CDP (browser WebSocket + flat session) — **CSP-safe**, survives reloads, pins persist (`localStorage`).
- `lib/cdp.py` is ~190 lines, **stdlib only** (no pip deps); it also does `shot` (screenshots) for the agent's self-check.
- Decoupled by design — works with any `--remote-debugging-port` Chrome; browser-harness just makes opening tabs nicer.

## License

[MIT](LICENSE) © kuzmany
