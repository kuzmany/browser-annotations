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

## Triggers

Any of these run the **self-verifying loop** below — and **enable annotations automatically** (inject the overlay
as part of validating in the browser): "do X, validate it in the browser", "do X and let me check / review it",
"open `<url>` for comments", "let me annotate", "build X then I'll comment".

## The loop (self-verifying — never hand off broken work)

1. **Make the change** the user asked for.

2. **Open the page** in the CDP Chrome (start the dev server first if needed).
   - browser-harness: `bh-open <url>`
   - plain Chrome: open the tab in a `--remote-debugging-port=9222` Chrome.

3. **Self-verify BEFORE handing off (required).** Screenshot and actually look:
   ```bash
   bh-shot /tmp/v.png 1600                                  # browser-harness, auto-resizes
   # or, no browser-harness:
   python3 <repo>/lib/cdp.py shot --url <substr> --out /tmp/v.png
   ```
   Read the image. Confirm: the page renders, no errors, and **your change is visibly present and matches the
   instruction**. If not → fix and re-verify. Only continue once it's genuinely OK *for you*.

4. **Enable annotations + announce.** Inject the overlay and hand off explicitly:
   ```bash
   bh-annotate --url <substr>     # --url pins the tab; annotations now ON
   ```
   > ✅ Done & verified from my side. Annotate at `<url>`: hover → click → note → **Save** (⌘/Ctrl+Enter). **Alt+A** pause, **Clear** wipes. Write **"done"** when finished.

   Then **STOP and wait** — do not poll, do not move/close/reopen the tab. Overlay + pins persist at that URL
   across reloads (localStorage per path), so the page stays ready while the user clicks.

5. **Apply.** When the user writes **"done"** (or "pull"):
   ```bash
   bh-apply --url <substr>        # writes ./.annotations/notes.md (+ prints it)
   ```
   Read `./.annotations/notes.md` and implement each annotation. Every note carries a **unique CSS selector**,
   the element's tag + text, and its box/colors — locate the exact element, no guessing.

6. **Self-verify AFTER applying (required).** Reload, screenshot again, and check **each note was addressed and
   still matches the original instructions**. If a note isn't satisfied → fix and re-verify. Then **report to the
   user**: a short per-note summary (done / how) + that it's verified. Clear resolved annotations (overlay
   **Clear** / `window.__bhAnno.clear()`) so they don't reappear, and offer another round.

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
