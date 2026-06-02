#!/usr/bin/env bash
# Chrome doesn't reliably serve symlinked extension files (and the Web Store strips
# them), so the extension ships a real copy of the overlay. Re-sync it after editing
# skills/browser-annotations/bh-annotate.js:
set -e
cd "$(dirname "$0")"
cp ../skills/browser-annotations/bh-annotate.js bh-annotate.js
echo "synced extension/bh-annotate.js"
