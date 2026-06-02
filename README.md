<div align="center">

# browser-annotations

**Point at your UI in the browser, type what to change — your AI coding agent reads it and edits the code.**

No Chrome extension. No MCP server. No account. One skill, installed once.

![License: MIT](https://img.shields.io/badge/License-MIT-FF5A36.svg)
![python3](https://img.shields.io/badge/python3-555.svg)
![Works with](https://img.shields.io/badge/works%20with-Claude%20Code%20·%20Cursor%20·%20Codex-FF5A36.svg)

<img src="docs/demo.png" alt="browser-annotations: numbered pins on a live page + the annotations panel" width="820">

</div>

---

## Why — your agent codes the UI blind. This gives it eyes.

You ask for a change, the agent writes code it can't see, you eyeball the browser and then type a
paragraph describing what's off — *"the CTA is too big, move it left, wrong green."* Slow, lossy, repeat.

**browser-annotations closes the loop.** Point at the real UI, the agent fixes the real code.

> ### "validate this feature on localhost:3000 in the browser"

That one sentence runs the whole loop:

1. **The agent ships it — and proves it.** Builds the change, opens the page, screenshots it, checks it
   actually renders + matches the ask. Says "done" only when it's real — no "should work" hand-waving.
2. **You point, you don't type.** Annotations are already on: hover → click the thing → say what's wrong →
   **Save**. Clicking *"smaller"* on the actual button beats a paragraph describing it. (**Copy** grabs every note as markdown.)
3. **Back in the CLI, applied.** Say **"done"** — the agent fixes each pin, re-verifies in the browser, and
   reports what changed. Loop until it's perfect.

**The payoff:** your coding agent finally *sees what you see* — "looks wrong in the browser" becomes "fixed in the code" in one click.

<sub>Overlay keys: Save = ⌘/Ctrl+Enter · Copy = notes→clipboard · Alt+A pause · Clear wipes · ✕ deletes one.</sub>

## Install — one skill, that's it

```bash
npx skills add kuzmany/browser-annotations   # Claude Code · Cursor · Codex · 50+ agents   (--agent '*' for all)
```

**Self-contained** — the CDP client (`cdp.py`) and the overlay ship *inside* the skill. Nothing else to install.
Needs only **Python 3** and a Chrome — and if no debug Chrome is running, the skill **launches one for you**
(its own profile in `~/.browser-annotations/chrome`). That's the whole setup.

## On by default — you never flip a switch

After install, *displaying annotations is the default*: whenever your agent opens a page to show you work, it
injects the overlay automatically (the skill loop does this). You point and comment; saved pins reload from
`localStorage`. Works with **any** agent, however you open the page — no extra config.

<details><summary><b>Optional: auto-attach to every browser-harness page</b></summary>

Drive Chrome through [browser-harness](https://github.com/browser-use/browser-harness)? Run the installer **once**:

```bash
python3 ~/.claude/skills/browser-annotations/integrations/browser-harness.py
```

It wraps browser-harness's `new_tab()` / `goto_url()` via its `agent_helpers.py` hook — so **every** page you
open auto-attaches the overlay: shows its saved annotations on open, persists across reloads, passively (pins
visible, clicks pass through — no automation disruption). No per-session step, no `bh-open` required.

Knobs (read per call, set in the shell): `BH_ANNOTATE` unset = passive + only pages with saved notes ·
`=all` = passive on every page · `=active` = interactive (ready to annotate) · `=0` = off.
Undo with `python3 ~/.claude/skills/browser-annotations/integrations/browser-harness.py --uninstall`.
Explicit `browser-annotate` still flips the current page to **active** for new notes.
</details>

## Use it without any agent

Open DevTools (F12) → Console → paste the overlay (`skills/browser-annotations/bh-annotate.js`) → annotate →
**Copy** → paste the markdown to your agent. Prefer one click? Make a bookmark:

<details><summary><b>📌 Annotate bookmarklet</b> — drag once, click on any page</summary>

New bookmark, name it `📌 Annotate`, paste as the URL:

```
javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/kuzmany/browser-annotations@main/skills/browser-annotations/bh-annotate.js';document.body.appendChild(s);})();
```

Click it on any page → overlay loads → annotate → **Copy**. (Pins persist in `localStorage`; re-click after a hard reload.)
</details>

Want a typed shell command instead of the agent calling it? One alias:

```bash
alias browser-annotate='python3 ~/.claude/skills/browser-annotations/cdp.py inject --js-file ~/.claude/skills/browser-annotations/bh-annotate.js'
alias browser-apply='python3 ~/.claude/skills/browser-annotations/cdp.py pull'
```

## What the agent runs for you

| Command | Does |
|---|---|
| `python3 <skill>/cdp.py inject --js-file <skill>/bh-annotate.js [--open URL] [--url SUB]` | inject the overlay (annotations on). `--open URL` opens a fresh tab — and launches Chrome if none is running. |
| `python3 <skill>/cdp.py pull [--url SUB] [--json]` | export notes → `./.annotations/notes.md` |

`<skill>` = the installed skill dir, e.g. `~/.claude/skills/browser-annotations`.
Endpoint: `--cdp` → `$CDP_URL` → `$BU_CDP_WS` → `http://localhost:9222`. `--url` pins a tab by URL substring.

Each note leads with what you wrote, then the element's **opening tag** (real `id`/`class`/attrs) + its text —
so the agent greps those in your source and edits the exact element, no guessing from a positional selector:

```markdown
## [#2] make this button green
`<a class="btn cta-primary" data-testid="order-btn" href="/order">`  — text: "Order"
selector: `header > div > a` · box 95x36 @1466,1309 · color rgb(10,13,23) · bg rgb(255,90,54)
```

## How it works

- Injects the overlay over CDP (browser WebSocket + flat session) — **CSP-safe**. Pins + notes persist in
  `localStorage` per path; after a hard reload the overlay re-arms (instantly with browser-harness; re-run otherwise).
- `cdp.py` is small, **stdlib only** (no pip deps); it also does `shot` (full-page screenshots via `--full`) for the agent's self-check.
- **Self-contained** — `--open <url>` creates its own tab over CDP and even launches Chrome if needed, so a fresh
  machine works with one command. When **browser-harness** is present it's used for nicer opening (right session
  window + domain-skills) and screenshots — but never required.

## License

[MIT](LICENSE) © kuzmany
