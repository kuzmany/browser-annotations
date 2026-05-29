#!/usr/bin/env bash
# install.sh — symlink bh-annotate into your bh-* toolchain + Claude Code skills.
#   bin/bh-annotate, bin/bh-apply  ->  ~/bin
#   overlay/bh-annotate.js         ->  ~/.bh-workspace/bh-annotate.js
#   skills/bh-annotate/             ->  ~/.claude/skills/bh-annotate   (Claude Code skill)
set -euo pipefail
ROOT="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
BIN="${BH_BIN_DIR:-$HOME/bin}"
WS="${BH_WORKSPACE_DIR:-$HOME/.bh-workspace}"
SKILLS="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

mkdir -p "$BIN" "$WS" "$SKILLS"
ln -sf  "$ROOT/bin/bh-annotate"        "$BIN/bh-annotate"
ln -sf  "$ROOT/bin/bh-apply"           "$BIN/bh-apply"
ln -sf  "$ROOT/overlay/bh-annotate.js" "$WS/bh-annotate.js"
ln -sfn "$ROOT/skills/bh-annotate"                  "$SKILLS/bh-annotate"
chmod +x "$ROOT/bin/bh-annotate" "$ROOT/bin/bh-apply"

echo "Installed:"
echo "  $BIN/bh-annotate          -> $ROOT/bin/bh-annotate"
echo "  $BIN/bh-apply             -> $ROOT/bin/bh-apply"
echo "  $WS/bh-annotate.js        -> $ROOT/overlay/bh-annotate.js"
echo "  $SKILLS/bh-annotate       -> $ROOT/skills/bh-annotate   (Claude Code skill)"
echo
echo "Make sure $BIN is on your PATH and browser-harness (bh-lib.sh) is installed."
echo 'Then just say: "open localhost:3000 for comments" — the skill drives the loop.'
