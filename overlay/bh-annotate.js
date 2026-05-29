/* bh-annotate — visual web annotation overlay for AI coding workflows.
 *
 * Click elements on a page, write notes; export them as markdown your AI
 * coding agent (Claude Code, etc.) can read and act on.
 *
 * Two ways to load it:
 *   1) browser-harness:  `bh-annotate` injects this via CDP (auto re-injects on reload).
 *   2) standalone:       paste this file into DevTools console, or use as a bookmarklet.
 *
 * No build step, no framework, CSP-safe (CDP eval world), idempotent.
 * Annotations persist in localStorage per path; read them back with `bh-apply`
 * or `JSON.stringify(window.__bhAnno.items)`.
 *
 * State: window.__bhAnno = { items:[{id,selector,tag,text,note,rect,color,bg,ts}], ... }
 * MIT License.
 */
(function () {
  var NS = "__bhAnno";
  if (window[NS] && window[NS].ready) { try { window[NS].show(); } catch (e) {} return "bh-annotate: already loaded"; }

  var S = (window[NS] = { installed: true, ready: false, items: [], mode: true });
  var KEY = "bh-anno:" + location.pathname;
  try { var saved = localStorage.getItem(KEY); if (saved) S.items = JSON.parse(saved) || []; } catch (e) {}
  var seq = S.items.reduce(function (m, a) { return Math.max(m, a.id || 0); }, 0);

  function save() { try { localStorage.setItem(KEY, JSON.stringify(S.items)); } catch (e) {} }
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^\w-]/g, "\\$&"); }
  function isUniq(sel) { try { return document.querySelectorAll(sel).length === 1; } catch (e) { return false; } }

  // Shortest unique CSS selector: #id fast-path, then nth-of-type path (short-circuits when unique).
  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id && isUniq("#" + cssEsc(el.id))) return "#" + cssEsc(el.id);
    var parts = [], node = el;
    while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== "html") {
      if (node.id) { parts.unshift("#" + cssEsc(node.id)); break; }
      var tag = node.tagName.toLowerCase(), nth = 1, sib = node;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) nth++;
      var same = 0, p = node.parentElement;
      if (p) for (var i = 0; i < p.children.length; i++) if (p.children[i].tagName === node.tagName) same++;
      parts.unshift(same > 1 ? tag + ":nth-of-type(" + nth + ")" : tag);
      var cand = parts.join(" > ");
      if (isUniq(cand)) return cand;
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  // ---------- styles ----------
  var Z = 2147483600;
  var FONT = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
  var MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";
  var ACCENT = "#FF5A36";
  var st = document.createElement("style");
  st.setAttribute("data-bh-ui", "1");
  st.textContent =
    "[data-bh-ui],[data-bh-ui] *{box-sizing:border-box;font-family:" + FONT + "}" +
    "#bh-hl{position:fixed;z-index:" + Z + ";pointer-events:none;border:2px solid " + ACCENT + ";background:rgba(255,90,54,.10);border-radius:3px;transition:all .04s linear;display:none}" +
    "#bh-hl-tag{position:absolute;top:-20px;left:-2px;background:" + ACCENT + ";color:#0A0D17;font:600 11px/1 " + MONO + ";padding:3px 6px;border-radius:3px;white-space:nowrap}" +
    ".bh-pin{position:absolute;z-index:" + (Z + 1) + ";min-width:20px;height:20px;padding:0 5px;background:" + ACCENT + ";color:#0A0D17;font:700 12px/20px " + FONT + ";text-align:center;border-radius:11px;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;pointer-events:auto}" +
    "#bh-input{position:fixed;z-index:" + (Z + 3) + ";width:300px;background:#10141F;color:#FAF7F1;border:1px solid " + ACCENT + ";border-radius:10px;padding:10px;box-shadow:0 12px 40px rgba(0,0,0,.6);display:none}" +
    "#bh-input textarea{width:100%;height:64px;resize:vertical;background:#0A0D17;color:#FAF7F1;border:1px solid #2A3142;border-radius:6px;padding:7px;font:14px/1.4 " + FONT + ";outline:none}" +
    "#bh-input .bh-sel{font:11px/1.3 " + MONO + ";color:#8A93A6;margin-bottom:6px;word-break:break-all;max-height:34px;overflow:auto}" +
    "#bh-input .bh-row{display:flex;gap:6px;margin-top:8px;justify-content:flex-end}" +
    ".bh-btn{cursor:pointer;border:none;border-radius:6px;font:600 12px/1 " + FONT + ";padding:8px 12px}" +
    ".bh-btn.p{background:" + ACCENT + ";color:#0A0D17}.bh-btn.s{background:#222a39;color:#cdd3df}" +
    "#bh-panel{position:fixed;right:14px;bottom:14px;z-index:" + (Z + 2) + ";width:320px;max-height:46vh;display:flex;flex-direction:column;background:#10141F;color:#FAF7F1;border:1px solid #232a3a;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.55);overflow:hidden}" +
    "#bh-panel .h{display:flex;align-items:center;gap:6px;padding:10px 11px;background:#0A0D17;border-bottom:1px solid #232a3a}" +
    "#bh-panel .h .dot{width:8px;height:8px;border-radius:50%;background:" + ACCENT + ";flex:0 0 auto}" +
    "#bh-panel .h .ttl{font:700 13px/1 " + FONT + ";white-space:nowrap}" +
    "#bh-panel .h .sp{flex:1}" +
    "#bh-panel .h button{flex:0 0 auto;cursor:pointer;border:1px solid #2a3344;background:#1b2230;color:#cdd3df;border-radius:7px;font:600 11px/1 " + FONT + ";padding:5px 7px;letter-spacing:.1px}" +
    "#bh-panel .h button:hover{background:#243049;color:#fff}" +
    "#bh-list{overflow:auto;padding:6px}" +
    "#bh-list .empty{padding:16px 10px;color:#6b7488;font:12px/1.4 " + FONT + ";text-align:center}" +
    "#bh-list .it{display:flex;gap:8px;padding:8px 6px;border-bottom:1px solid #1a2030;font:12px/1.35 " + FONT + "}" +
    "#bh-list .it .n{flex:0 0 auto;width:18px;height:18px;border-radius:9px;background:" + ACCENT + ";color:#0A0D17;font:700 11px/18px " + FONT + ";text-align:center}" +
    "#bh-list .it .b{flex:1;min-width:0}" +
    "#bh-list .it .s{color:#8A93A6;font:10px/1.3 " + MONO + ";word-break:break-all;margin-top:2px}" +
    "#bh-list .it .x{cursor:pointer;color:#6b7488;flex:0 0 auto}#bh-list .it .x:hover{color:" + ACCENT + "}" +
    "#bh-panel .f{padding:8px 11px;border-top:1px solid #232a3a;font:11px/1.3 " + MONO + ";color:#8A93A6;display:flex;justify-content:space-between;gap:8px}";

  // ---------- element helpers ----------
  function el(tag, attrs) { var n = document.createElement(tag); n.setAttribute("data-bh-ui", "1"); if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
  function btn(txt, cls) { var b = document.createElement("button"); b.className = "bh-btn " + cls; b.setAttribute("data-bh-ui", "1"); b.textContent = txt; return b; }
  function isUI(n) { return n && n.closest && n.closest("[data-bh-ui]"); }

  // ---------- build UI ----------
  var hl = el("div", { id: "bh-hl" }); hl.appendChild(el("div", { id: "bh-hl-tag" }));

  var input = el("div", { id: "bh-input" });
  var inSel = el("div", { class: "bh-sel" }), inTa = document.createElement("textarea");
  inTa.setAttribute("data-bh-ui", "1"); inTa.placeholder = "Note for this element…";
  var inRow = el("div", { class: "bh-row" });
  var bSave = btn("Save", "p"), bCancel = btn("Cancel", "s");
  inRow.appendChild(bCancel); inRow.appendChild(bSave);
  input.appendChild(inSel); input.appendChild(inTa); input.appendChild(inRow);

  var panel = el("div", { id: "bh-panel" });
  var ph = el("div", { class: "h" });
  var pTitle = el("span", { class: "ttl" });
  var bMode = document.createElement("button"), bCopy = document.createElement("button"), bClear = document.createElement("button");
  bMode.setAttribute("data-bh-ui", "1"); bCopy.setAttribute("data-bh-ui", "1"); bClear.setAttribute("data-bh-ui", "1");
  bCopy.textContent = "Copy"; bClear.textContent = "Clear";
  ph.appendChild(el("span", { class: "dot" })); ph.appendChild(pTitle);
  ph.appendChild(el("span", { class: "sp" })); ph.appendChild(bCopy); ph.appendChild(bMode); ph.appendChild(bClear);
  var list = el("div", { id: "bh-list" });
  var foot = el("div", { class: "f" });
  var fLeft = document.createElement("span"); fLeft.textContent = "apply: bh-apply";
  var fRight = document.createElement("span"); fRight.textContent = "⌥A toggle";
  foot.appendChild(fLeft); foot.appendChild(fRight);
  panel.appendChild(ph); panel.appendChild(list); panel.appendChild(foot);

  var pinLayer = el("div", { id: "bh-pins" });
  pinLayer.style.cssText = "position:absolute;top:0;left:0;width:0;height:0;z-index:" + (Z + 1);

  function mount() {
    var b = document.body || document.documentElement;
    var head = document.head || b;
    if (st.parentNode !== head) head.appendChild(st);
    [hl, input, panel, pinLayer].forEach(function (n) { if (n.parentNode !== b) b.appendChild(n); });
    render();
  }

  // ---------- hover highlight ----------
  function onMove(e) {
    if (!S.mode) { hl.style.display = "none"; return; }
    var t = e.target;
    if (isUI(t)) { hl.style.display = "none"; return; }
    var r = t.getBoundingClientRect();
    hl.style.display = "block";
    hl.style.left = r.left + "px"; hl.style.top = r.top + "px";
    hl.style.width = r.width + "px"; hl.style.height = r.height + "px";
    var cls = (t.className && typeof t.className === "string") ? "." + t.className.trim().split(/\s+/)[0] : "";
    hl.firstChild.textContent = t.tagName.toLowerCase() + (t.id ? "#" + t.id : "") + cls;
  }

  // ---------- click → capture ----------
  var pending = null;
  function onClick(e) {
    if (!S.mode || isUI(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    var t = e.target, r = t.getBoundingClientRect(), cs = getComputedStyle(t);
    pending = {
      selector: selectorFor(t), tag: t.tagName.toLowerCase(),
      text: (t.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
      rect: { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
      color: cs.color, bg: cs.backgroundColor
    };
    inSel.textContent = pending.selector; inTa.value = "";
    var x = Math.min(e.clientX, innerWidth - 320), y = Math.min(e.clientY, innerHeight - 150);
    input.style.left = Math.max(8, x) + "px"; input.style.top = Math.max(8, y) + "px"; input.style.display = "block";
    setTimeout(function () { inTa.focus(); }, 0);
  }
  function commit() {
    if (!pending) return;
    var note = inTa.value.trim(); if (!note) { cancel(); return; }
    pending.id = ++seq; pending.note = note; pending.ts = Date.now();
    S.items.push(pending); pending = null; input.style.display = "none";
    save(); render();
  }
  function cancel() { pending = null; input.style.display = "none"; }

  // ---------- render ----------
  function render() {
    if (!list || !pTitle) return;
    pTitle.textContent = "Annotations (" + S.items.length + ")";
    bMode.textContent = S.mode ? "Pause" : "Resume";
    list.innerHTML = "";
    if (!S.items.length) {
      var em = el("div", { class: "empty" }); em.textContent = "Hover an element, click, type a note.";
      list.appendChild(em);
    }
    S.items.forEach(function (a) {
      var it = el("div", { class: "it" });
      var n = el("span", { class: "n" }); n.textContent = a.id;
      var b = el("div", { class: "b" });
      var note = document.createElement("div"); note.textContent = a.note;
      var s = el("div", { class: "s" }); s.textContent = a.selector;
      b.appendChild(note); b.appendChild(s);
      var x = el("span", { class: "x" }); x.textContent = "✕";
      x.onclick = function () { S.items = S.items.filter(function (q) { return q.id !== a.id; }); save(); render(); };
      it.appendChild(n); it.appendChild(b); it.appendChild(x);
      list.appendChild(it);
    });
    layoutPins();
  }
  function layoutPins() {
    if (!pinLayer) return;
    pinLayer.innerHTML = "";
    S.items.forEach(function (a) {
      var node = null; try { node = document.querySelector(a.selector); } catch (e) {}
      var pin = el("div", { class: "bh-pin" }); pin.textContent = a.id; pin.title = a.note;
      if (node) { var r = node.getBoundingClientRect(); pin.style.left = (r.left + scrollX - 6) + "px"; pin.style.top = (r.top + scrollY - 6) + "px"; }
      else { pin.style.left = (a.rect.x - 6) + "px"; pin.style.top = (a.rect.y - 6) + "px"; pin.style.opacity = ".5"; }
      pinLayer.appendChild(pin);
    });
  }

  // ---------- wiring ----------
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && input.style.display === "block") cancel();
    if (e.altKey && (e.key === "a" || e.key === "A")) { S.mode = !S.mode; render(); }
    if (input.style.display === "block" && (e.metaKey || e.ctrlKey) && e.key === "Enter") commit();
  }, true);
  window.addEventListener("scroll", layoutPins, true);
  window.addEventListener("resize", layoutPins);
  // ---------- markdown export (same format as bh-apply) ----------
  function toMarkdown() {
    var L = ["# Web annotations — " + S.items.length + " item(s)", "", "Source: " + location.href, ""];
    S.items.forEach(function (a) {
      var r = a.rect || {};
      L.push("## [#" + a.id + "] `" + a.selector + "`  — " + a.tag + ' "' + (a.text || "").slice(0, 60) + '"');
      L.push("note: " + a.note);
      var m = [];
      if (r.w != null) m.push("box " + r.w + "x" + r.h + " @" + r.x + "," + r.y);
      if (a.color) m.push("color " + a.color);
      if (a.bg) m.push("bg " + a.bg);
      if (m.length) L.push(m.join(" · "));
      L.push("");
    });
    return L.join("\n");
  }
  function flashCopy(label) { var o = bCopy.textContent; bCopy.textContent = label; setTimeout(function () { bCopy.textContent = o; }, 1200); }
  function copyMarkdown() {
    if (!S.items.length) { flashCopy("empty"); return; }
    var md = toMarkdown();
    var fallback = function () {
      try {
        var ta = el("textarea", {}); ta.value = md; ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
        (document.body || document.documentElement).appendChild(ta); ta.focus(); ta.select();
        document.execCommand("copy"); ta.remove(); flashCopy("✓ Copied");
      } catch (e) { flashCopy("✗ failed"); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(function () { flashCopy("✓ Copied"); }, fallback);
    } else { fallback(); }
  }

  bSave.onclick = commit; bCancel.onclick = cancel;
  bCopy.onclick = copyMarkdown;
  bMode.onclick = function () { S.mode = !S.mode; render(); };
  bClear.onclick = function () { if (confirm("Clear all annotations on this page?")) { S.items = []; save(); render(); } };

  // ---------- public API ----------
  S.show = function () { if (panel) panel.style.display = "flex"; };
  S.dump = function () { return S.items; };
  S.markdown = toMarkdown;
  S.clear = function () { S.items = []; save(); render(); };

  S.ready = true;
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  return "bh-annotate: loaded (" + S.items.length + " existing)";
})();
