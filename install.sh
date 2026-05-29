#!/usr/bin/env bash
# install.sh — symlink bh-annotate into your bh-* toolchain.
#   bin/bh-annotate, bin/bh-notes-pull  ->  ~/bin
#   overlay/bh-annotate.js              ->  ~/.bh-workspace/bh-annotate.js
set -euo pipefail
ROOT="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
BIN="${BH_BIN_DIR:-$HOME/bin}"
WS="${BH_WORKSPACE_DIR:-$HOME/.bh-workspace}"

mkdir -p "$BIN" "$WS"
ln -sf "$ROOT/bin/bh-annotate"        "$BIN/bh-annotate"
ln -sf "$ROOT/bin/bh-notes-pull"      "$BIN/bh-notes-pull"
ln -sf "$ROOT/overlay/bh-annotate.js" "$WS/bh-annotate.js"
chmod +x "$ROOT/bin/bh-annotate" "$ROOT/bin/bh-notes-pull"

echo "Installed:"
echo "  $BIN/bh-annotate        -> $ROOT/bin/bh-annotate"
echo "  $BIN/bh-notes-pull      -> $ROOT/bin/bh-notes-pull"
echo "  $WS/bh-annotate.js      -> $ROOT/overlay/bh-annotate.js"
echo
echo "Make sure $BIN is on your PATH and browser-harness (bh-lib.sh) is installed."
