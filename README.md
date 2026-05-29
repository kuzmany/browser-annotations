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

## Why — your agent codes the UI blind. This gives it eyes.

You ask for a change, the agent writes code it can't see, you eyeball the browser and then type a
paragraph describing what's off — *"the CTA is too big, move it left, wrong green"*. Slow, lossy, repeat.

**bh-annotate closes the loop.** Point at the real UI, the agent fixes the real code.

> ### "validate this feature on localhost:3000 in the browser"

That one sentence runs the whole loop:

1. **The agent ships it — and proves it.** Builds the change, opens the page, screenshots it, and checks it
   actually renders + matches the ask. Says "done" only when it's real — no "should work" hand-waving.
2. **You point, you don't type.** Annotations are already on: hover → click the thing → say what's wrong →
   **Save**. Clicking *"smaller"* on the actual button beats a paragraph describing it. (**Copy** grabs every note as markdown.)
3. **Back in the CLI, applied.** Write **"done"** — the agent fixes each pin, re-verifies in the browser, and
   reports what changed. Loop until it's perfect.

**The payoff:** your coding agent finally *sees what you see* — "looks wrong in the browser" becomes "fixed in the code" in one click. No extension, no MCP, no leaving your terminal.

<sub>Overlay keys: Save = ⌘/Ctrl+Enter · Copy = notes→clipboard · Alt+A pause · Clear wipes · ✕ deletes one.</sub>

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
