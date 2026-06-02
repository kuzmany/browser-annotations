<div align="center">

# browser-annotations

**Point at your UI in the browser, say what to change — your AI agent reads it and edits the code.**

No MCP. No account. Works with any AI agent.

![License: MIT](https://img.shields.io/badge/License-MIT-FF5A36.svg)
![python3](https://img.shields.io/badge/python3-555.svg)
![Works with](https://img.shields.io/badge/works%20with-Claude%20Code%20·%20Cursor%20·%20Codex-FF5A36.svg)

<img src="docs/demo.png" alt="browser-annotations: numbered pins on a live page + the annotations panel" width="820">

</div>

---

## Your agent codes the UI blind. This gives it eyes.

You ask for a change, the agent writes code it can't see, you squint at the browser and type a paragraph —
*"CTA too big, move it left, wrong green."* Slow, lossy, repeat.

**Point at the real UI instead.** One sentence runs the loop:

> ### "validate this feature on localhost:3000 in the browser"

1. **Agent ships + proves it** — builds the change, opens the page, screenshots, checks it actually rendered.
2. **You point, not type** — hover → click the thing → say what's wrong → **Save**. (**Copy** = all notes as markdown.)
3. **Applied** — say **"done"**; the agent fixes each pin, re-verifies, reports. Loop till perfect.

<sub>Keys: Save = ⌘/Ctrl+Enter · Copy = notes→clipboard · Alt+A pause · Clear · ✕ delete one.</sub>

## Install

```bash
npx skills add kuzmany/browser-annotations   # Claude Code · Cursor · Codex · 50+ agents
```

Self-contained — the CDP client + overlay ship inside the skill. Needs only **Python 3** + Chrome (it launches
its own if none is running). **On by default:** when your agent opens a page to show you work, the overlay is
already there — you just start clicking.

## Why it finds the right code

Each note hands the agent the element's **opening tag** (real `id` / `class` / attributes) + its text — literal
strings to grep in your source, not a fragile DOM path:

```markdown
## [#2] make this button green
`<a class="btn cta-primary" data-testid="order-btn" href="/order">`  — text: "Order"
selector: `header > div > a` · box 95x36 · color rgb(10,13,23) · bg rgb(255,90,54)
```

## More

<details><summary><b>Auto-attach to every browser-harness page</b></summary>

Drive Chrome through [browser-harness](https://github.com/browser-use/browser-harness)? Run once:

```bash
python3 ~/.claude/skills/browser-annotations/integrations/browser-harness.py   # --uninstall to undo
```

Wraps `new_tab()` / `goto_url()` via its `agent_helpers.py` hook → every page auto-shows its saved annotations,
across reloads, passively (pins visible, clicks pass through). Knobs: `BH_ANNOTATE` unset = passive + noted-only ·
`=all` = passive everywhere · `=active` = ready to annotate · `=0` = off.
</details>

<details><summary><b>Use it without an agent — Chrome extension</b></summary>

Annotate any page by hand and paste the notes to your agent — no skill, no Python, no terminal.

1. Clone the repo, open **chrome://extensions** → enable **Developer mode** → **Load unpacked** → pick the `extension/` folder.
2. Click the toolbar button — or press **Alt+Shift+A** — to **toggle** annotations on/off. Then hover → click the element → type a note → **Save**.
3. **Copy** (button, or **Alt+Shift+C**) → paste the markdown into your AI agent.

Shortcuts are rebindable at `chrome://extensions/shortcuts`. While annotating: **Alt+A** pause · **⌘/Ctrl+Enter** save · **Esc** cancel.
The extension reuses the same overlay, so notes carry the same source anchors (id/class/attrs/text).
No-install fallback: paste `skills/browser-annotations/bh-annotate.js` into the DevTools (F12) console.
</details>

<details><summary><b>Commands & shell aliases</b></summary>

The agent calls these (`<skill>` = `~/.claude/skills/browser-annotations`):

| Command | Does |
|---|---|
| `python3 <skill>/cdp.py inject --js-file <skill>/bh-annotate.js [--open URL] [--url SUB]` | inject overlay (launches Chrome if none) |
| `python3 <skill>/cdp.py pull [--url SUB] [--json]` | export notes → `./.annotations/notes.md` |

Endpoint: `--cdp` → `$CDP_URL` → `$BU_CDP_WS` → `http://localhost:9222`. Want to type it yourself?

```bash
alias browser-annotate='python3 ~/.claude/skills/browser-annotations/cdp.py inject --js-file ~/.claude/skills/browser-annotations/bh-annotate.js'
alias browser-apply='python3 ~/.claude/skills/browser-annotations/cdp.py pull'
```
</details>

<details><summary><b>How it works</b></summary>

- Injects the overlay over CDP (browser WebSocket + flat session) — **CSP-safe**. Pins persist in `localStorage`
  per path; re-run after a hard reload to bring the overlay back (automatic with browser-harness).
- `cdp.py` is small, **stdlib only** (no pip deps); also does `shot` for the agent's screenshot self-check.
- browser-harness, when present, is used for nicer opening + screenshots — but never required.
</details>

## License

[MIT](LICENSE) © kuzmany
