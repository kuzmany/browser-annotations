---
name: bh-annotate
description: Visual feedback loop for a running web app — point at the UI in the browser, get the changes in code. Use when the user says "open <url> for comments", "annotate the page", "let me comment on the UI", "review the design in the browser", "mark up localhost:3000", "I'll click what to change", or otherwise wants to click elements in a live page and have those notes applied to the code. Opens the page, injects the annotation overlay, waits for the user to click elements + type notes, then reads the notes and implements them, and verifies in the browser. Requires browser-harness (bh-open / bh-annotate / bh-apply).
---

# bh-annotate — point at the UI, get the changes

Turn browser clicks + notes into code edits. The loop: **open → annotate → apply → verify**.

## When to use

The user wants to give visual feedback on a running app instead of describing it in words —
e.g. "open localhost:3000 for comments", "let me mark what to change", "review the UI in the browser".

## The loop

1. **Open + inject.**
   ```bash
   bh-open <url> [alias]      # open the page (start the dev server first if needed)
   bh-annotate               # inject the annotation overlay (auto re-injects on reload)
   ```
   If the app isn't running and the user named it, start it first (`npm run dev`, `python3 -m http.server`, …).

2. **Hand off to the user.** Tell them, concisely:
   > Hover an element → click → type a note → **Save** (or ⌘/Ctrl+Enter). **Alt+A** pause, **Clear** wipes. Say **"pull"** (or "done") when finished.

   Then stop and wait for their signal. Do **not** poll.

3. **Pull.** When they say pull/done:
   ```bash
   bh-apply                  # writes ./.annotations/notes.md (+ prints it)
   ```
   Read `./.annotations/notes.md`.

4. **Apply.** Implement each annotation in the code. Every note carries a **unique CSS selector**,
   the element's tag + text, and its box/colors — use them to locate the exact element. No guessing.

5. **Verify.** Reload (`bh-open <url>` or CDP `Page.reload`) and screenshot with `bh-shot` to confirm.
   Then clear resolved annotations (overlay panel **Clear**, or `window.__bhAnno.clear()`) so they don't reappear.

6. Repeat until the user is happy.

## Commands

| Command | Does |
|---|---|
| `bh-annotate` | Inject the overlay into the current browser-harness tab (auto re-injects on reload; dedups its registration). |
| `bh-apply [path\|--json]` | Export annotations → `./.annotations/notes.md` (or a path). `--json` prints raw JSON. |

In the overlay: hover highlights · click opens a note box · Save / ⌘Ctrl+Enter · Esc cancels · Alt+A pause/resume · Clear wipes · ✕ deletes one.

## Output format (`notes.md`)

```markdown
## [#2] `header > div > div > a`  — a "Order"
note: make this button green
box 95x36 @1466,1309 · color rgb(10,13,23) · bg rgb(255,90,54)
```

## Gotchas

- **Requires browser-harness.** The live loop is fastest on the machine where Chrome actually runs
  (e.g. WSL), not over a remote CDP tunnel — a dead tunnel shows up as `bh-status DEAD`.
- On reload the overlay re-injects and pins persist (localStorage per URL).
- Right after a reload the page's own scroll/reveal may settle a beat late — if the first `bh-shot`
  frame looks blank, re-shoot.
- **Standalone** (no browser-harness): paste `overlay/bh-annotate.js` into DevTools, annotate, then
  `copy(JSON.stringify(window.__bhAnno.items, null, 2))`.
