/* browser-annotations — visual web annotation overlay for AI coding workflows.
 *
 * Click elements on a page, write notes; copy them as markdown your AI coding
 * agent (Claude Code, Cursor, Codex) can read and act on.
 *
 * Loaded by the Chrome extension (toolbar / Alt+Shift+A) as a content script,
 * or paste this file into the DevTools console standalone.
 *
 * No build step, no framework, CSP-safe, idempotent. Annotations persist in
 * localStorage per route; the panel's Copy button (or Alt+Shift+C) puts them on
 * the clipboard. Read them programmatically via JSON.stringify(window.__bhAnno.items).
 *
 * Public API: window.__bhAnno = { items[], markdown(), json(), copy(), copyJson(),
 *   copyPrompt(), clear(), activate(), destroy(), mode }.
 * MIT License.
 */
(function () {
  var NS = "__bhAnno";
  if (window[NS] && window[NS].ready) { try { window[NS].show(); } catch (e) {} return "browser-annotations: already loaded"; }

  // mode: true = interactive (hover+click capture). Auto-display (bh-open) sets
  // window.__bhAnnoStartMode=false to start passive — pins show, clicks pass through.
  var S = (window[NS] = { installed: true, ready: false, items: [],
    mode: (typeof window.__bhAnnoStartMode === "boolean" ? window.__bhAnnoStartMode : true) });
  // Per-route key (path + hash) so single-page-app navigation re-keys correctly.
  function getKey() { return "bh-anno:" + location.pathname + location.hash; }
  try { var saved = localStorage.getItem(getKey()); if (saved) S.items = JSON.parse(saved) || []; } catch (e) {}
  var seq = S.items.reduce(function (m, a) { return Math.max(m, a.id || 0); }, 0);

  function save() { try { localStorage.setItem(getKey(), JSON.stringify(S.items)); } catch (e) {} }
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^\w-]/g, "\\$&"); }
  function isUniq(sel) { try { return document.querySelectorAll(sel).length === 1; } catch (e) { return false; } }
  // className as a string (SVG exposes SVGAnimatedString, not a string) → trimmed token list.
  function classOf(t) { return (t && typeof t.className === "string") ? t.className : (t && t.getAttribute ? (t.getAttribute("class") || "") : ""); }
  function clsTokens(s) { s = (s || "").trim(); return s ? s.split(/\s+/) : []; }

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
  // ChatGPT-inspired palette: dark neutral surfaces + OpenAI green accent.
  var ACCENT = "#10A37F", ACCENT_H = "#1AB68C";
  var BG = "#212121", HDR = "#171717", SURF = "#2f2f2f";
  var TXT = "#ECECEC", MUT = "#9b9b9b";
  var BORD = "rgba(255,255,255,.10)", BORD_S = "rgba(255,255,255,.06)";
  var st = document.createElement("style");
  st.setAttribute("data-bh-ui", "1");
  st.textContent =
    // motion ("feelings") — gentle entrance + press feedback, disabled for reduced-motion
    "@keyframes bh-rise{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}" +
    "@keyframes bh-pop{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}" +
    "@keyframes bh-fade{from{opacity:0}to{opacity:1}}" +
    "@media (prefers-reduced-motion:reduce){[data-bh-ui],[data-bh-ui] *{animation:none!important;transition-duration:.01ms!important}}" +
    "[data-bh-ui],[data-bh-ui] *{box-sizing:border-box;font-family:" + FONT + ";-webkit-font-smoothing:antialiased}" +
    "#bh-hl{position:fixed;z-index:" + Z + ";pointer-events:none;border:2px solid " + ACCENT + ";background:rgba(16,163,127,.12);border-radius:6px;transition:all .06s ease;display:none}" +
    "#bh-hl-tag{position:absolute;top:-22px;left:-2px;background:" + ACCENT + ";color:#fff;font:600 11px/1 " + MONO + ";padding:3px 7px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35)}" +
    ".bh-pin{position:absolute;z-index:" + (Z + 1) + ";min-width:22px;height:22px;padding:0 6px;background:" + ACCENT + ";color:#fff;font:700 12px/22px " + FONT + ";text-align:center;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.45);cursor:pointer;pointer-events:auto;transition:transform .12s ease,box-shadow .12s ease,background .12s ease}" +
    ".bh-pin:hover{transform:scale(1.18);background:" + ACCENT_H + ";box-shadow:0 4px 14px rgba(16,163,127,.5)}" +
    "#bh-input{position:fixed;z-index:" + (Z + 3) + ";width:320px;background:" + BG + ";color:" + TXT + ";border:1px solid " + BORD + ";border-radius:16px;padding:14px;box-shadow:0 16px 48px rgba(0,0,0,.55),0 0 0 1px " + BORD_S + ";display:none;animation:bh-pop .16s ease both}" +
    "#bh-input textarea{width:100%;height:76px;resize:vertical;background:" + SURF + ";color:" + TXT + ";border:1px solid transparent;border-radius:12px;padding:10px 12px;font:14px/1.45 " + FONT + ";outline:none;transition:border-color .15s ease,background .15s ease}" +
    "#bh-input textarea:focus{border-color:" + ACCENT + ";background:#262626}" +
    "#bh-input textarea::placeholder{color:#8e8e8e}" +
    "#bh-input .bh-sel{font:11px/1.3 " + MONO + ";color:" + MUT + ";margin-bottom:8px;word-break:break-all;max-height:34px;overflow:auto}" +
    "#bh-input .bh-row{display:flex;gap:8px;margin-top:10px;justify-content:flex-end}" +
    ".bh-btn{cursor:pointer;border:1px solid transparent;border-radius:999px;font:600 12px/1 " + FONT + ";padding:9px 14px;transition:background .15s ease,color .15s ease,border-color .15s ease,transform .08s ease}" +
    ".bh-btn:active{transform:translateY(1px)}" +
    ".bh-btn.p{background:" + ACCENT + ";color:#fff}.bh-btn.p:hover{background:" + ACCENT_H + "}" +
    ".bh-btn.s{background:transparent;color:" + MUT + ";border-color:" + BORD + "}.bh-btn.s:hover{background:" + SURF + ";color:" + TXT + "}" +
    "#bh-panel{position:fixed;right:16px;bottom:16px;z-index:" + (Z + 2) + ";width:336px;max-height:48vh;display:flex;flex-direction:column;background:" + BG + ";color:" + TXT + ";border:1px solid " + BORD + ";border-radius:18px;box-shadow:0 18px 56px rgba(0,0,0,.55),0 0 0 1px " + BORD_S + ";overflow:hidden;animation:bh-rise .24s cubic-bezier(.22,1,.36,1) both}" +
    "#bh-panel .h{display:flex;align-items:center;gap:8px;padding:13px 14px;background:" + HDR + ";border-bottom:1px solid " + BORD + "}" +
    "#bh-panel .h .dot{width:8px;height:8px;border-radius:50%;background:" + ACCENT + ";flex:0 0 auto;box-shadow:0 0 0 3px rgba(16,163,127,.18)}" +
    "#bh-panel .h .ttl{font:600 14px/1 " + FONT + ";letter-spacing:.2px;white-space:nowrap}" +
    "#bh-panel .h .sp{flex:1}" +
    "#bh-panel .h button{flex:0 0 auto;cursor:pointer;border:1px solid " + BORD + ";background:transparent;color:" + MUT + ";border-radius:999px;font:600 11px/1 " + FONT + ";padding:7px 11px;letter-spacing:.2px;transition:background .15s ease,color .15s ease,border-color .15s ease,transform .08s ease}" +
    "#bh-panel .h button:hover{background:" + SURF + ";color:" + TXT + "}" +
    "#bh-panel .h button:active{transform:translateY(1px)}" +
    "#bh-panel .h button:first-of-type{background:" + ACCENT + ";color:#fff;border-color:transparent}" +
    "#bh-panel .h button:first-of-type:hover{background:" + ACCENT_H + "}" +
    "#bh-list{overflow:auto;padding:8px}" +
    "#bh-list::-webkit-scrollbar{width:8px}#bh-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:8px}" +
    "#bh-list .empty{padding:18px 12px;color:" + MUT + ";font:13px/1.8 " + FONT + ";text-align:left}" +
    "#bh-list .it{display:flex;gap:10px;padding:11px 8px;border-bottom:1px solid " + BORD_S + ";font:13px/1.4 " + FONT + ";border-radius:10px;transition:background .12s ease;animation:bh-fade .18s ease both}" +
    "#bh-list .it:hover{background:rgba(255,255,255,.04)}" +
    "#bh-list .it:last-child{border-bottom:none}" +
    "#bh-list .it .n{flex:0 0 auto;width:20px;height:20px;border-radius:999px;background:" + ACCENT + ";color:#fff;font:700 11px/20px " + FONT + ";text-align:center}" +
    "#bh-list .it .b{flex:1;min-width:0}" +
    "#bh-list .it .s{color:" + MUT + ";font:10px/1.35 " + MONO + ";word-break:break-all;margin-top:3px}" +
    "#bh-list .it .x{cursor:pointer;color:#6e6e6e;flex:0 0 auto;transition:color .12s ease}#bh-list .it .x:hover{color:" + ACCENT + "}" +
    "#bh-panel .f{padding:10px 14px;border-top:1px solid " + BORD + ";font:11px/1.3 " + FONT + ";color:" + MUT + ";display:flex;justify-content:space-between;gap:8px;background:" + HDR + "}";

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
  var fLeft = document.createElement("span"); fLeft.textContent = "Copy → paste to your agent";
  var fRight = document.createElement("span"); fRight.textContent = "⌥A pause";
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
    var first = clsTokens(classOf(t))[0];
    hl.firstChild.textContent = t.tagName.toLowerCase() + (t.id ? "#" + t.id : "") + (first ? "." + first : "");
  }

  // ---------- click → capture ----------
  // Source-mapping anchors: real id/class/attrs + a literal opening tag the agent
  // can grep in the codebase (far more reliable than the positional DOM selector).
  // Attrs that exist literally in source across frameworks → great grep targets.
  var _ANCHOR_ATTRS = ["data-testid", "data-test", "data-cy", "data-qa", "name", "for", "href", "aria-label", "alt", "placeholder", "title", "type", "role"];
  // Runtime/framework-generated attr NAMES that never appear in source → noise for grep.
  var _NOISE_ATTR = /^(data-ved|jsaction|jsname|jscontroller|jsmodel|jsdata|jslog|jsshadow|ping|nonce|data-reactid|data-react-checksum|data-reactroot)$/;
  var _NOISE_VUE = /^data-v-[0-9a-f]{6,}$/;                                          // Vue scoped-style hash
  var _NOISE_ARIA = /^aria-(owns|controls|describedby|labelledby|activedescendant)$/; // runtime-generated id refs
  function isNoiseAttr(n) { return _NOISE_ATTR.test(n) || _NOISE_VUE.test(n) || _NOISE_ARIA.test(n); }
  function attrsOf(t) {
    var o = {};
    if (t.attributes) for (var i = 0; i < t.attributes.length; i++) {
      var a = t.attributes[i], n = a.name;
      if (n === "style" || n === "class" || n === "id" || isNoiseAttr(n)) continue;
      o[n] = (a.value || "").slice(0, 120);
    }
    return o;
  }
  // A class is "generated" (build hash) when it won't be found literally in source.
  function isHashClass(c) {
    if (!c) return true;
    if (/^(css-|sc-)/.test(c)) return true;                        // emotion / styled-components
    if (/__[A-Za-z0-9]{4,}$/.test(c)) return true;                 // CSS modules  Foo_bar__9xQ2
    if (/^(?=[a-f0-9]*[0-9])[a-f0-9]{6,}$/i.test(c)) return true;  // hex-ish hash (≥6 chars, has a digit)
    if (c.length <= 8 && /[A-Z]/.test(c) && /[0-9]/.test(c)) return true; // minified gNO89b
    return false;
  }
  function stableClasses(cls) {
    return clsTokens(cls).filter(function (c) { return !isHashClass(c); });
  }
  // P1 — dev-build source mapping. Returns {fw,file,line,comp} or null (stripped in prod).
  // React file:line relies on fiber._debugSource (React ≤18 dev only; React 19 / Next 15 drop it → null).
  function sourceLoc(el) {
    try {
      var k = Object.keys(el).find(function (x) { return x.indexOf("__reactFiber$") === 0 || x.indexOf("__reactInternalInstance$") === 0; });
      if (k) { var f = el[k], g = 0; while (f && g++ < 60) {
        if (f._debugSource) { var s = f._debugSource, o = f._debugOwner;
          var comp = (o && o.type && (o.type.displayName || o.type.name)) || (f.type && (f.type.displayName || f.type.name)) || "";
          return { fw: "react", file: s.fileName, line: s.lineNumber, comp: typeof comp === "string" ? comp : "" }; }
        f = f.return; } }
      if (el.__svelte_meta && el.__svelte_meta.loc) { var l = el.__svelte_meta.loc; return { fw: "svelte", file: l.file, line: l.line }; }
      var vc = el.__vueParentComponent || el.__vue__;
      if (vc) { var ty = vc.type || vc.$options || {}; var file = ty.__file || (vc.$options && vc.$options.__file) || "";
        var nm = ty.name || ty.__name || (vc.$options && vc.$options.name) || "";
        if (file || nm) return { fw: "vue", file: file, comp: typeof nm === "string" ? nm : "" }; }
      if (window.ng && typeof ng.getComponent === "function") {
        var p = el, c = null; while (p && !c) { try { c = ng.getComponent(p); } catch (e) {} p = p.parentElement; }
        if (c && c.constructor) return { fw: "angular", comp: c.constructor.name || "" }; }
    } catch (e) {}
    return null;
  }
  function openTagOf(tag, id, cls, attrs) {
    var s = "<" + tag;
    if (id) s += ' id="' + id + '"';
    if (cls) s += ' class="' + cls + '"';
    for (var k in attrs) s += " " + k + '="' + attrs[k] + '"';
    return (s.length > 240 ? s.slice(0, 240) + "…" : s) + ">";
  }
  // Extra disambiguators for the agent: nearest accessible label, instance ordinal
  // among same-tag/class matches, and the relevant computed styles (free — cs is
  // already read on click) so "make the padding smaller" carries a before-state.
  function nearestLabel(t) {
    try {
      var al = t.getAttribute && t.getAttribute("aria-label"); if (al) return al.trim().slice(0, 80);
      var lb = t.getAttribute && t.getAttribute("aria-labelledby");
      if (lb) { var le = document.getElementById(lb.split(/\s+/)[0]); if (le) return (le.textContent || "").trim().slice(0, 80); }
      var ph = t.getAttribute && t.getAttribute("placeholder"); if (ph) return ph.trim().slice(0, 80);
      if (t.labels && t.labels.length) return (t.labels[0].textContent || "").trim().slice(0, 80);
      var l = t.closest && t.closest("label"); if (l) return (l.textContent || "").trim().slice(0, 80);
    } catch (e) {}
    return "";
  }
  function ordinalOf(t) {
    try {
      var first = clsTokens(classOf(t))[0] || "";
      var sel = t.tagName.toLowerCase() + (first ? "." + cssEsc(first) : "");
      var all = document.querySelectorAll(sel);
      if (all.length > 1) { var idx = Array.prototype.indexOf.call(all, t); if (idx >= 0) return (idx + 1) + " of " + all.length + " matching " + sel; }
    } catch (e) {}
    return "";
  }
  var _STYLE_KEYS = ["fontSize", "fontWeight", "padding", "margin", "display", "borderRadius", "width", "height"];
  function stylesOf(cs) {
    var o = {};
    _STYLE_KEYS.forEach(function (k) { var v = cs[k]; if (v && v !== "normal" && v !== "auto" && v !== "0px" && v !== "none") o[k] = v; });
    return o;
  }
  var pending = null;
  function onClick(e) {
    if (!S.mode || isUI(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    var t = e.target, r = t.getBoundingClientRect(), cs = getComputedStyle(t);
    var id = t.id || "", cls = classOf(t), at = attrsOf(t);
    pending = {
      selector: selectorFor(t), tag: t.tagName.toLowerCase(),
      elId: id, cls: cls, attrs: at, html: openTagOf(t.tagName.toLowerCase(), id, cls, at),
      text: (t.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
      label: nearestLabel(t), ord: ordinalOf(t), styles: stylesOf(cs), src: sourceLoc(t),
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
      var em = el("div", { class: "empty" });
      ["1 · Hover + click an element", "2 · Type the change → Save", "3 · Copy → paste to Claude / Cursor / Codex"].forEach(function (line, i) {
        if (i) em.appendChild(document.createElement("br"));
        em.appendChild(document.createTextNode(line));
      });
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

  // coalesce pin relayout to one rAF per frame (scroll/resize fire far faster than paint)
  var _pinRAF = 0;
  function scheduleLayout() { if (_pinRAF) return; _pinRAF = requestAnimationFrame(function () { _pinRAF = 0; layoutPins(); }); }

  // ---------- wiring ----------
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  function onKey(e) {
    if (e.key === "Escape" && input.style.display === "block") cancel();
    if (e.altKey && (e.key === "a" || e.key === "A")) { S.mode = !S.mode; render(); }
    if (input.style.display === "block" && (e.metaKey || e.ctrlKey) && e.key === "Enter") commit();
  }
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", scheduleLayout, true);
  window.addEventListener("resize", scheduleLayout);

  // ---------- SPA route awareness ----------
  // On client-side navigation, re-key to the new route: load its notes + re-pin,
  // so notes never vanish or save under the wrong path in React/Vue/Next apps.
  function reloadForPath() {
    try { var s = localStorage.getItem(getKey()); S.items = s ? (JSON.parse(s) || []) : []; }
    catch (e) { S.items = []; }
    seq = S.items.reduce(function (m, a) { return Math.max(m, a.id || 0); }, 0);
    if (pending) cancel();
    render();
  }
  var _routeT = null;
  function onRoute() { clearTimeout(_routeT); _routeT = setTimeout(reloadForPath, 150); }
  var _histWrapped = [];
  ["pushState", "replaceState"].forEach(function (name) {
    var orig = history[name];
    if (typeof orig !== "function") return;
    history[name] = function () { var r = orig.apply(this, arguments); try { onRoute(); } catch (e) {} return r; };
    _histWrapped.push([name, orig]);
  });
  window.addEventListener("popstate", onRoute);
  window.addEventListener("hashchange", onRoute);

  // ---------- markdown / json export ----------
  // The single best way to locate this element in source (P1 source map → P3 stable anchors).
  function findBy(a) {
    var s = a.src;
    if (s) {
      if (s.file) return "source: " + s.file + (s.line ? ":" + s.line : "") + (s.comp ? "  <" + s.comp + ">" : "");
      if (s.comp) return "component: <" + s.comp + ">  (" + s.fw + " — open its file)";
    }
    var at = a.attrs || {};
    for (var i = 0; i < _ANCHOR_ATTRS.length; i++) { var k = _ANCHOR_ATTRS[i]; if (at[k]) return "find by: " + k + '="' + at[k] + '"'; }
    if (a.elId && !isHashClass(a.elId)) return "find by: id=" + a.elId;
    if (a.label) return 'find by: label/text "' + a.label + '"';
    if (a.text) return 'find by: text "' + a.text.slice(0, 60) + '"';
    var sc = stableClasses(a.cls); if (sc.length) return "find by: class ." + sc[0];
    return "find by: the opening tag below";
  }
  // One-line strategy hint for the agent, derived from what we actually captured.
  function envBanner() {
    var fws = {}, withSrc = 0;
    S.items.forEach(function (a) { if (a.src) { if (a.src.fw) fws[a.src.fw] = 1; if (a.src.file || a.src.comp) withSrc++; } });
    var names = Object.keys(fws);
    if (withSrc) return "App: " + names.join("/") + " (dev build — each note carries a source file:line/<Component>; grep by data-testid / id / visible text, ignore hashed class names and the positional dom-path).";
    if (names.length) return "App: " + names.join("/") + " (component framework — grep by data-testid / id / visible text / aria-label; class names may be build-hashed; dom-path is positional, not source).";
    return "Static / server-rendered — id, class, attributes and text appear literally in source; grep the opening tag, id or text.";
  }
  function toMarkdown() {
    var L = ["# Web annotations — " + S.items.length + " item(s)", "", "Source: " + location.href, "", envBanner(), ""];
    S.items.forEach(function (a) {
      var r = a.rect || {};
      L.push("## [#" + a.id + "] " + (a.note || ""));
      L.push(findBy(a));
      var anchor = "`" + (a.html || ("<" + a.tag + ">")) + "`";
      if (a.text) anchor += '  — text: "' + a.text.slice(0, 80) + '"';
      L.push(anchor);
      if (a.label) L.push('label: "' + a.label + '"');
      if (a.ord) L.push("instance: " + a.ord);
      var m = ["dom-path (positional fallback): `" + a.selector + "`"];
      if (r.w != null) m.push("box " + r.w + "x" + r.h + " @" + r.x + "," + r.y);
      if (a.color) m.push("color " + a.color);
      if (a.bg) m.push("bg " + a.bg);
      if (a.styles) { var sl = []; for (var sk in a.styles) sl.push(sk + ":" + a.styles[sk]); if (sl.length) m.push("css " + sl.join(" ")); }
      L.push(m.join(" · "));
      L.push("");
    });
    return L.join("\n");
  }
  function flashCopy(label) { var o = bCopy.textContent; bCopy.textContent = label; setTimeout(function () { bCopy.textContent = o; }, 1200); }
  function copyText(text) {
    var fallback = function () {
      try {
        var ta = el("textarea", {}); ta.value = text; ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
        (document.body || document.documentElement).appendChild(ta); ta.focus(); ta.select();
        document.execCommand("copy"); ta.remove(); flashCopy("✓ Copied");
      } catch (e) { flashCopy("✗ failed"); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flashCopy("✓ Copied"); }, fallback);
    } else { fallback(); }
  }
  var PROMPT_PRE = "For each annotation below: locate the element in my source, make the described change, then re-check it in the browser. Prefer the `source:`/`component:` hint when present; otherwise grep by data-testid / id / visible text / aria-label. Ignore build-hashed class names and the positional dom-path. The captured css is the before-state.";
  function copyMarkdown() { if (!S.items.length) { flashCopy("empty"); return; } copyText(toMarkdown()); }
  function copyJson() { if (!S.items.length) { flashCopy("empty"); return; } copyText(JSON.stringify(S.items, null, 2)); }
  function copyPrompt() { if (!S.items.length) { flashCopy("empty"); return; } copyText(PROMPT_PRE + "\n\n" + toMarkdown()); }

  bSave.onclick = commit; bCancel.onclick = cancel;
  bCopy.onclick = copyMarkdown;
  bMode.onclick = function () { S.mode = !S.mode; render(); };
  bClear.onclick = function () { if (confirm("Clear all annotations on this page?")) { S.items = []; save(); render(); } };

  // ---------- public API ----------
  S.show = function () { if (panel) panel.style.display = "flex"; };
  S.dump = function () { return S.items; };
  S.markdown = toMarkdown;
  S.json = function () { return S.items.slice(); };
  S.copy = copyMarkdown;      // background (Alt+Shift+C) calls this public method, not the closure
  S.copyJson = copyJson;      // Alt+Shift+J
  S.copyPrompt = copyPrompt;
  S.clear = function () { S.items = []; save(); render(); };
  // Flip from passive display to interactive capture.
  S.activate = function () { S.mode = true; render(); };
  // Full teardown — clean removal (drop all nodes + listeners + restore history) for any caller.
  S.destroy = function () {
    try {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", scheduleLayout, true);
      window.removeEventListener("resize", scheduleLayout);
      if (_pinRAF) { cancelAnimationFrame(_pinRAF); _pinRAF = 0; }
      window.removeEventListener("popstate", onRoute);
      window.removeEventListener("hashchange", onRoute);
      clearTimeout(_routeT);
      _histWrapped.forEach(function (w) { try { history[w[0]] = w[1]; } catch (e) {} });
      [st, hl, input, panel, pinLayer].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    } catch (e) {}
    S.ready = false;
    try { delete window[NS]; } catch (e) { window[NS] = undefined; }
    return "browser-annotations: removed";
  };

  S.ready = true;
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  return "browser-annotations: loaded (" + S.items.length + " existing)";
})();
