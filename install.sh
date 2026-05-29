#!/usr/bin/env bash
# install.sh — symlink bh-annotate into your bh-* toolchain.
#   bin/bh-annotate, bin/bh-apply  ->  ~/bin
#   overlay/bh-annotate.js              ->  ~/.bh-workspace/bh-annotate.js
set -euo pipefail
ROOT="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
BIN="${BH_BIN_DIR:-$HOME/bin}"
WS="${BH_WORKSPACE_DIR:-$HOME/.bh-workspace}"

mkdir -p "$BIN" "$WS"
ln -sf "$ROOT/bin/bh-annotate"        "$BIN/bh-annotate"
ln -sf "$ROOT/bin/bh-apply"      "$BIN/bh-apply"
ln -sf "$ROOT/overlay/bh-annotate.js" "$WS/bh-annotate.js"
chmod +x "$ROOT/bin/bh-annotate" "$ROOT/bin/bh-apply"

echo "Installed:"
echo "  $BIN/bh-annotate        -> $ROOT/bin/bh-annotate"
echo "  $BIN/bh-apply      -> $ROOT/bin/bh-apply"
echo "  $WS/bh-annotate.js      -> $ROOT/overlay/bh-annotate.js"
echo
echo "Make sure $BIN is on your PATH and browser-harness (bh-lib.sh) is installed."
