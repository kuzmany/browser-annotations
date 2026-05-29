---
name: bh-annotate
description: Visual feedback loop for a running web app — point at the UI in the browser, get the changes in code. Use when the user says "open <url> for comments", "annotate the page", "let me comment on the UI", "review the design in the browser", "mark up localhost:3000", "I'll click what to change", or otherwise wants to click elements in a live page and have those notes applied to the code. Uses a page in a Chrome started with --remote-debugging-port, injects the annotation overlay, waits for the user to click elements + type notes, then reads the notes (bh-apply) and implements them, and verifies in the browser. Needs Python 3 and a CDP-enabled Chrome; browser-harness is optional (only for bh-open convenience).
---

# bh-annotate — point at the UI, get the changes

Turn browser clicks + notes into code edits. The loop: **open → annotate → apply → verify**.
Talks straight to Chrome over CDP — no extension, no MCP, no server.

## When to use

The user wants to give visual feedback on a running app instead of describing it in words —
e.g. "open localhost:3000 for comments", "let me mark what to change", "review the UI in the browser".

## Endpoint

`bh-annotate` / `bh-apply` resolve the Chrome CDP endpoint in this order:
`--cdp <url>` → `$CDP_URL` → `$BU_CDP_WS` → `http://localhost:9222`.

- Plain Chrome: launch with `--remote-debugging-port=9222` → the default works.
- browser-harness rig: the endpoint lives in its `.env` as `BU_CDP_WS` (e.g. `ws://<tailscale-ip>:9333/…`).
  Pass it through: `--cdp "$BU_CDP_WS"` or `export BU_CDP_WS=...` first.

## The loop

1. **Open the page** in the CDP Chrome (start the dev server first if needed).
   - browser-harness: `bh-open <url>`
   - plain Chrome: open the tab in a `--remote-debugging-port=9222` Chrome.

2. **Inject the overlay.**
   ```bash
   bh-annotate --url <substr>     # --url pins the tab (recommended if several are open)
   ```

3. **Hand off to the user.** Tell them, concisely:
   > Hover an element → click → type a note → **Save** (or ⌘/Ctrl+Enter). **Alt+A** pause, **Clear** wipes. Say **"pull"** / "done" when finished.

   Then stop and wait. Do **not** poll.

4. **Apply.** When they say pull/done:
   ```bash
   bh-apply --url <substr>        # writes ./.annotations/notes.md (+ prints it)
   ```
   Read `./.annotations/notes.md` and implement each annotation. Every note carries a **unique CSS selector**,
   the element's tag + text, and its box/colors — use them to locate the exact element. No guessing.

5. **Verify.** Reload the page and screenshot to confirm. Then clear resolved annotations (overlay panel
   **Clear**, or `window.__bhAnno.clear()`) so they don't reappear. Repeat until the user is happy.

## Commands

| Command | Does |
|---|---|
| `bh-annotate [--url SUB] [--cdp URL]` | Inject the overlay into a Chrome tab over CDP (auto re-injects on reload; dedups its registration). |
| `bh-apply [--url SUB] [--cdp URL] [--out PATH] [--json]` | Export annotations → `./.annotations/notes.md` (or `--out` / `--json`). |

In the overlay: hover highlights · click opens a note box · Save / ⌘Ctrl+Enter · Esc cancels · Alt+A pause/resume · Clear wipes · ✕ deletes one.

## Output format (`notes.md`)

```markdown
## [#2] `header > div > div > a`  — a "Order"
note: make this button green
box 95x36 @1466,1309 · color rgb(10,13,23) · bg rgb(255,90,54)
```

## Gotchas

- **Which tab:** without a session manager the tool attaches to the most-recent matching page. If several
  tabs are open, always pass `--url <substr>` to pin the right one.
- **Persistence:** annotations live in `localStorage` per URL path and the overlay re-injects on reload, so the
  loop keeps state. Applied notes stay until you **Clear** them.
- **Remote Chrome:** a dead tunnel (`bh-status DEAD` on a browser-harness rig) means CDP is unreachable — fix
  the tunnel first; this tool uses the same transport, it doesn't add reliability.
- **Standalone** (nothing installed): paste `overlay/bh-annotate.js` into DevTools, annotate, then
  `copy(JSON.stringify(window.__bhAnno.items, null, 2))`.
