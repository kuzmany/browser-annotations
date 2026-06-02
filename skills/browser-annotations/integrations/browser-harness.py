#!/usr/bin/env python3
"""Auto-attach browser-annotations to every browser-harness page.

browser-harness (github.com/browser-use/browser-harness) loads
`$BH_AGENT_WORKSPACE/agent_helpers.py` and copies its public names over the core
helpers (`_load_agent_helpers`). So defining `new_tab` / `goto_url` there wraps
the real open functions for every `browser-harness -c` call — no per-session
action, no patching of any wrapper script.

This installer appends a small, marker-guarded block that wraps those two
functions to register the annotation overlay on the freshly opened page
(persisting across reloads via Page.addScriptToEvaluateOnNewDocument, and shown
immediately via a one-shot eval).

Usage:
  python3 browser-harness.py            # install (idempotent; backs up .bak)
  python3 browser-harness.py --uninstall

Behaviour knobs (read at open time, so set per shell / per call):
  BH_ANNOTATE unset / 1   passive display, only on pages that already have notes  (default)
  BH_ANNOTATE=all         passive display on every page
  BH_ANNOTATE=active      interactive (ready to annotate) on every page
  BH_ANNOTATE=0/off/no    disabled
  BH_ANNOTATE_OVERLAY     path to bh-annotate.js (defaults to the installed skill)
MIT License.
"""
import os, sys

BEGIN = "# >>> browser-annotations auto-attach >>>"
END = "# <<< browser-annotations auto-attach <<<"

HOOK = BEGIN + r'''
import os as _ba_os
try:
    from browser_harness.helpers import cdp as _ba_cdp, new_tab as _ba_orig_new_tab, goto_url as _ba_orig_goto_url
except Exception:
    _ba_cdp = None

def _ba_overlay_src():
    for _p in (_ba_os.environ.get("BH_ANNOTATE_OVERLAY", ""),
               _ba_os.path.expanduser("~/.claude/skills/browser-annotations/bh-annotate.js")):
        if _p and _ba_os.path.exists(_p):
            try:
                with open(_p, encoding="utf-8") as _f:
                    return _f.read()
            except OSError:
                pass
    return None

def _ba_source():
    _ov = _ba_overlay_src()
    if not _ov:
        return None
    _an = (_ba_os.environ.get("BH_ANNOTATE") or "1").lower()
    if _an in ("0", "off", "no", "false"):
        return None
    _gate = _an not in ("all", "active")            # default: only pages that already have notes
    _passive = _an != "active"                       # default: display-only (clicks pass through)
    _pre = "window.__bhAnnoStartMode=%s;" % ("false" if _passive else "true")
    if _gate:
        return ("(function(){try{var k='bh-anno:'+location.pathname,v=localStorage.getItem(k);"
                "if(!v||!(JSON.parse(v)||[]).length)return;}catch(e){return;}" + _pre + "\n" + _ov + "\n})();")
    return "(function(){" + _pre + "\n" + _ov + "\n})();"

def _ba_attach(session_id=None):
    if _ba_cdp is None:
        return
    _src = _ba_source()
    if not _src:
        return
    try:
        _ba_cdp("Page.enable", session_id=session_id)
    except Exception:
        pass
    # persist across reloads for this session...
    try:
        _ba_cdp("Page.addScriptToEvaluateOnNewDocument", source=_src, session_id=session_id)
    except Exception:
        pass
    # ...and show it on the page that's already loaded now
    try:
        _ba_cdp("Runtime.evaluate", expression=_src, session_id=session_id)
    except Exception:
        pass

if _ba_cdp is not None:
    def new_tab(*a, **k):
        _r = _ba_orig_new_tab(*a, **k)
        _ba_attach()
        return _r

    def goto_url(*a, **k):
        _r = _ba_orig_goto_url(*a, **k)
        _ba_attach()
        return _r
''' + END + "\n"


def _workspace_helpers():
    ws = os.environ.get("BH_AGENT_WORKSPACE") or os.path.expanduser("~/.bh-workspace")
    return os.path.join(os.path.expanduser(ws), "agent_helpers.py")


def install():
    p = _workspace_helpers()
    os.makedirs(os.path.dirname(p), exist_ok=True)
    existing = ""
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            existing = f.read()
    if BEGIN in existing:
        print("SKIP: already installed in " + p)
        return 0
    if existing:
        with open(p + ".bak", "w", encoding="utf-8") as f:
            f.write(existing)
    sep = "" if (not existing or existing.endswith("\n")) else "\n"
    with open(p, "a", encoding="utf-8") as f:
        f.write(sep + "\n" + HOOK)
    print("INSTALLED auto-attach in " + p + ("  (backup .bak)" if existing else ""))
    print("Now every browser-harness new_tab()/goto_url() auto-attaches annotations.")
    print("Knobs: BH_ANNOTATE unset=passive+noted-only · =all=passive everywhere · =active=interactive · =0=off")
    return 0


def uninstall():
    p = _workspace_helpers()
    if not os.path.exists(p):
        print("nothing to do (no " + p + ")")
        return 0
    with open(p, encoding="utf-8") as f:
        s = f.read()
    if BEGIN not in s:
        print("not installed in " + p)
        return 0
    pre = s.split(BEGIN, 1)[0].rstrip("\n")
    post = s.split(END, 1)[1].lstrip("\n")
    with open(p + ".bak", "w", encoding="utf-8") as f:
        f.write(s)
    with open(p, "w", encoding="utf-8") as f:
        f.write((pre + ("\n" if post else "") + post).rstrip("\n") + "\n")
    print("UNINSTALLED auto-attach from " + p + "  (backup .bak)")
    return 0


if __name__ == "__main__":
    sys.exit(uninstall() if "--uninstall" in sys.argv[1:] else install())
