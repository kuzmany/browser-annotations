#!/usr/bin/env python3
"""Minimal, dependency-free Chrome DevTools Protocol client for bh-annotate.

Talks to any Chrome started with --remote-debugging-port over a single
browser-level WebSocket using flat sessions (Target.attachToTarget flatten),
so it works locally and through a remote tunnel without per-target host rewrites.

Endpoint resolution (first hit wins):
  --cdp <url>  ->  $CDP_URL  ->  $BU_CDP_WS  ->  http://localhost:9222

Accepts an http(s)://host:port base (queried at /json/version) or a
ws://host:port/devtools/browser/<id> browser URL directly.

Subcommands:
  inject --js-file F [--url SUB]      register on new document + run now (overlay)
  pull   [--url SUB] [--json] [--out] read window.__bhAnno.items -> markdown/json

Stdlib only (socket, ssl, json, base64, hashlib, os, struct, urllib).
MIT License.
"""
import sys, os, json, base64, hashlib, struct, socket, ssl, urllib.request, re, argparse, hashlib as _h

# ---------------- endpoint resolution ----------------

def resolve_browser_ws(cdp_arg=None):
    src = cdp_arg or os.environ.get("CDP_URL") or os.environ.get("BU_CDP_WS") or "http://localhost:9222"
    if src.startswith("ws://") or src.startswith("wss://"):
        if "/devtools/browser/" in src:
            return src
        # ws://host:port with no browser path -> derive http base and query
        http = "http://" + src.split("://", 1)[1].rstrip("/")
        return _ws_from_version(http)
    if src.startswith("http://") or src.startswith("https://"):
        return _ws_from_version(src.rstrip("/"))
    # bare host:port
    return _ws_from_version("http://" + src.rstrip("/"))

def _ws_from_version(http_base):
    try:
        with urllib.request.urlopen(http_base + "/json/version", timeout=6) as r:
            data = json.loads(r.read().decode())
        ws = data.get("webSocketDebuggerUrl")
        if not ws:
            raise RuntimeError("no webSocketDebuggerUrl in /json/version")
        return ws
    except Exception as e:
        raise SystemExit(f"[cdp] cannot reach Chrome at {http_base}/json/version : {e}\n"
                         f"      start Chrome with --remote-debugging-port, or set --cdp / $CDP_URL / $BU_CDP_WS")

# ---------------- tiny RFC6455 websocket client ----------------

class WS:
    def __init__(self, url, timeout=20):
        m = re.match(r"^(wss?)://([^/:]+)(?::(\d+))?(/.*)?$", url)
        if not m:
            raise SystemExit(f"[cdp] bad ws url: {url}")
        scheme, host, port, path = m.group(1), m.group(2), m.group(3), m.group(4) or "/"
        port = int(port) if port else (443 if scheme == "wss" else 80)
        self.sock = socket.create_connection((host, port), timeout=timeout)
        if scheme == "wss":
            self.sock = ssl.create_default_context().wrap_socket(self.sock, server_hostname=host)
        self.sock.settimeout(timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\n"
               f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.sock.sendall(req.encode())
        resp = self._read_until(b"\r\n\r\n")
        if b" 101 " not in resp.split(b"\r\n", 1)[0]:
            raise SystemExit(f"[cdp] websocket handshake failed: {resp[:120]!r}")
        self._buf = b""

    def _read_until(self, marker):
        data = b""
        while marker not in data:
            chunk = self.sock.recv(4096)
            if not chunk:
                break
            data += chunk
        return data

    def _recv_exact(self, n):
        while len(self._buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise SystemExit("[cdp] connection closed mid-frame")
            self._buf += chunk
        out, self._buf = self._buf[:n], self._buf[n:]
        return out

    def send(self, text):
        payload = text.encode()
        mask = os.urandom(4)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        n = len(payload)
        hdr = bytes([0x81])  # FIN + text
        if n < 126:
            hdr += bytes([0x80 | n])
        elif n < 65536:
            hdr += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            hdr += bytes([0x80 | 127]) + struct.pack(">Q", n)
        self.sock.sendall(hdr + mask + masked)

    def recv(self):
        # returns the next complete TEXT message (handles fragmentation + control frames)
        data = b""
        while True:
            b0, b1 = self._recv_exact(2)
            fin = b0 & 0x80
            opcode = b0 & 0x0F
            masked = b1 & 0x80
            ln = b1 & 0x7F
            if ln == 126:
                ln = struct.unpack(">H", self._recv_exact(2))[0]
            elif ln == 127:
                ln = struct.unpack(">Q", self._recv_exact(8))[0]
            mk = self._recv_exact(4) if masked else b""
            payload = self._recv_exact(ln)
            if masked:
                payload = bytes(c ^ mk[i % 4] for i, c in enumerate(payload))
            if opcode == 0x9:            # ping -> pong
                self._send_ctrl(0xA, payload); continue
            if opcode in (0xA,):         # pong
                continue
            if opcode == 0x8:            # close
                raise SystemExit("[cdp] server closed connection")
            data += payload
            if fin:
                return data.decode("utf-8", "replace")

    def _send_ctrl(self, opcode, payload=b""):
        mask = os.urandom(4)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes([0x80 | opcode, 0x80 | len(payload)]) + mask + masked)

    def close(self):
        try: self._send_ctrl(0x8)
        except Exception: pass
        try: self.sock.close()
        except Exception: pass

# ---------------- CDP layer ----------------

class CDP:
    def __init__(self, ws):
        self.ws = ws
        self._id = 0

    def call(self, method, params=None, session=None, timeout_msgs=200):
        self._id += 1
        mid = self._id
        msg = {"id": mid, "method": method, "params": params or {}}
        if session:
            msg["sessionId"] = session
        self.ws.send(json.dumps(msg))
        for _ in range(timeout_msgs):
            data = json.loads(self.ws.recv())
            if data.get("id") == mid:
                if "error" in data:
                    raise RuntimeError(f"{method} -> {data['error']}")
                return data.get("result", {})
            # else: event or other-session reply -> ignore
        raise RuntimeError(f"{method}: no reply after {timeout_msgs} messages")

def pick_page(cdp, url_sub=None, window_id=None):
    targets = cdp.call("Target.getTargets").get("targetInfos", [])
    pages = [t for t in targets if t.get("type") == "page"
             and not t.get("url", "").startswith(("devtools://", "chrome://", "chrome-extension://"))]
    if not pages:
        raise SystemExit("[cdp] no normal page open. open your app first.")
    # pin page targets to a single Chrome window id (generic; e.g. auto-filled from $BH_SESSION_WINDOW_ID)
    if window_id is not None:
        in_win = []
        for t in pages:
            try:
                if cdp.call("Browser.getWindowForTarget", {"targetId": t["targetId"]}).get("windowId") == window_id:
                    in_win.append(t)
            except Exception:
                pass
        if in_win:
            pages = in_win
        else:
            print(f"[cdp] no page in window {window_id}; ignoring window filter", file=sys.stderr)
    if url_sub:
        match = [t for t in pages if url_sub in t.get("url", "")]
        if not match:
            raise SystemExit(f"[cdp] no open page matching --url {url_sub!r}. open it first.\n"
                             f"      pages: " + (", ".join(p.get('url', '')[:60] for p in pages) or "(none)"))
        page = match[-1]
    else:
        page = pages[-1]  # most recently created ≈ active
        if len(pages) > 1:
            print(f"[cdp] {len(pages)} pages open; using last: {page.get('url','')[:70]}  (use --url to pin)", file=sys.stderr)
    sess = cdp.call("Target.attachToTarget", {"targetId": page["targetId"], "flatten": True})["sessionId"]
    return sess, page.get("url", "")

def evaluate(cdp, sess, expr, by_value=True, user_gesture=False):
    r = cdp.call("Runtime.evaluate", {"expression": expr, "returnByValue": by_value,
                                      "userGesture": user_gesture, "awaitPromise": False}, session=sess)
    return r.get("result", {}).get("value")

# ---------------- commands ----------------

def _idfile(ws_url, url_sub):
    key = _h.sha1((ws_url.split("/devtools/")[0] + "|" + (url_sub or "")).encode()).hexdigest()[:12]
    return f"/tmp/bh-annotate-{key}.id"

def cmd_inject(args):
    js = open(args.js_file, encoding="utf-8").read()
    ws_url = resolve_browser_ws(args.cdp)
    ws = WS(ws_url); cdp = CDP(ws)
    try:
        sess, page_url = pick_page(cdp, args.url, args.window)
        cdp.call("Page.enable", session=sess)
        idf = _idfile(ws_url, args.url)
        # remove our previous document-start registration (no stale duplicates on reload)
        if os.path.exists(idf):
            try: cdp.call("Page.removeScriptToEvaluateOnNewDocument", {"identifier": open(idf).read().strip()}, session=sess)
            except Exception: pass
        try:
            ident = cdp.call("Page.addScriptToEvaluateOnNewDocument", {"source": js}, session=sess).get("identifier")
            if ident: open(idf, "w").write(str(ident))
        except Exception as e:
            print(f"[bh-annotate] warn addScriptToEvaluateOnNewDocument: {e}", file=sys.stderr)
        val = evaluate(cdp, sess, js, user_gesture=True)
        print(f"[bh-annotate] {val}  ({page_url[:60]})")
    finally:
        ws.close()

def cmd_pull(args):
    ws_url = resolve_browser_ws(args.cdp)
    ws = WS(ws_url); cdp = CDP(ws)
    try:
        sess, _ = pick_page(cdp, args.url, args.window)
        raw = evaluate(cdp, sess, "JSON.stringify((window.__bhAnno&&window.__bhAnno.items)||[])")
        href = evaluate(cdp, sess, "location.href") or ""
    finally:
        ws.close()
    items = json.loads(raw) if raw else []
    if args.json:
        print(json.dumps(items, ensure_ascii=False, indent=2)); return
    L = [f"# Web annotations — {len(items)} item(s)", "", f"Source: {href}", ""]
    for a in items:
        sel = a.get("selector", ""); tag = a.get("tag", ""); txt = (a.get("text") or "")[:60]
        r = a.get("rect") or {}
        L.append(f"## [#{a.get('id')}] `{sel}`  — {tag} \"{txt}\"")
        L.append(f"note: {a.get('note','')}")
        meta = []
        if r: meta.append(f"box {r.get('w',0)}x{r.get('h',0)} @{r.get('x',0)},{r.get('y',0)}")
        if a.get("color"): meta.append(f"color {a['color']}")
        if a.get("bg"): meta.append(f"bg {a['bg']}")
        if meta: L.append(" · ".join(meta))
        L.append("")
    out_text = "\n".join(L)
    out_path = args.out or os.path.join(os.getcwd(), ".annotations", "notes.md")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    open(out_path, "w", encoding="utf-8").write(out_text)
    print(out_text)
    print(f"[bh-apply] saved -> {out_path}  ({len(items)} annotation(s))")

def cmd_shot(args):
    ws_url = resolve_browser_ws(args.cdp)
    ws = WS(ws_url, timeout=40); cdp = CDP(ws)
    try:
        sess, url = pick_page(cdp, args.url, args.window)
        cdp.call("Page.enable", session=sess)
        params = {"format": "png"}
        if args.full:
            params["captureBeyondViewport"] = True
        data = cdp.call("Page.captureScreenshot", params, session=sess).get("data", "")
    finally:
        ws.close()
    if not data:
        raise SystemExit("[shot] empty screenshot")
    out = args.out or "/tmp/bh-cdp-shot.png"
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "wb") as f:
        f.write(base64.b64decode(data))
    print(f"[shot] saved -> {out}  ({url[:60]})")

def main():
    p = argparse.ArgumentParser(prog="bh-cdp", add_help=True)
    sub = p.add_subparsers(dest="cmd", required=True)
    ew = os.environ.get("BH_SESSION_WINDOW_ID", "").strip()
    envwin = int(ew) if ew.isdigit() else None   # browser-harness's bh-open exports this; --window overrides
    def add_window(sp): sp.add_argument("--window", type=int, default=envwin, help="pin to a Chrome window id")
    pi = sub.add_parser("inject"); pi.add_argument("--js-file", required=True); pi.add_argument("--url"); pi.add_argument("--cdp"); add_window(pi)
    pp = sub.add_parser("pull");   pp.add_argument("--url"); pp.add_argument("--cdp"); pp.add_argument("--json", action="store_true"); pp.add_argument("--out"); add_window(pp)
    ps = sub.add_parser("shot");   ps.add_argument("--url"); ps.add_argument("--cdp"); ps.add_argument("--out"); ps.add_argument("--full", action="store_true"); add_window(ps)
    args = p.parse_args()
    {"inject": cmd_inject, "pull": cmd_pull, "shot": cmd_shot}[args.cmd](args)

if __name__ == "__main__":
    main()
