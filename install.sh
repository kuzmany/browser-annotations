#!/usr/bin/env bash
# install.sh — symlink browser-annotations into your toolchain + agent skills.
#   commands  ->  ~/bin   (both names work):
#       browser-annotate  +  bh-annotate   ->  bin/bh-annotate
#       browser-apply     +  bh-apply      ->  bin/bh-apply
#   overlay/bh-annotate.js          ->  ~/.bh-workspace/bh-annotate.js
#   skills/browser-annotations      ->  ~/.claude/skills/browser-annotations
set -euo pipefail
ROOT="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
BIN="${BH_BIN_DIR:-$HOME/bin}"
WS="${BH_WORKSPACE_DIR:-$HOME/.bh-workspace}"
SKILLS="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

mkdir -p "$BIN" "$WS" "$SKILLS"
ln -sf  "$ROOT/bin/bh-annotate"        "$BIN/browser-annotate"
ln -sf  "$ROOT/bin/bh-annotate"        "$BIN/bh-annotate"
ln -sf  "$ROOT/bin/bh-apply"           "$BIN/browser-apply"
ln -sf  "$ROOT/bin/bh-apply"           "$BIN/bh-apply"
ln -sf  "$ROOT/overlay/bh-annotate.js" "$WS/bh-annotate.js"
ln -sfn "$ROOT/skills/browser-annotations" "$SKILLS/browser-annotations"
chmod +x "$ROOT/bin/bh-annotate" "$ROOT/bin/bh-apply"
# drop stale pre-rename skill symlink
[ -L "$SKILLS/bh-annotate" ] && rm -f "$SKILLS/bh-annotate"

echo "Installed:"
echo "  commands: browser-annotate / bh-annotate · browser-apply / bh-apply  (in $BIN)"
echo "  overlay:  $WS/bh-annotate.js"
echo "  skill:    $SKILLS/browser-annotations"
echo
echo "Ensure $BIN is on your PATH. Then say: \"validate this feature on localhost:3000 in the browser\"."
