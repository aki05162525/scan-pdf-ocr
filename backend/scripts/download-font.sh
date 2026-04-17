#!/usr/bin/env bash
# Download Noto Sans JP into backend/fonts/ for pdf-lib to embed as the
# invisible text-layer font in searchable PDFs. Any font that covers Latin +
# Japanese Unicode works; Noto Sans JP is chosen for permissive licensing
# (SIL OFL) and full CJK coverage.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FONTS_DIR="$SCRIPT_DIR/../fonts"
FONT_URL="https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf"
FONT_FILE="$FONTS_DIR/NotoSansCJKjp-Regular.otf"

mkdir -p "$FONTS_DIR"

if [[ -f "$FONT_FILE" ]]; then
  echo "skip: $(basename "$FONT_FILE") already exists"
else
  echo "downloading: $(basename "$FONT_FILE")"
  curl -fsSL -o "$FONT_FILE" "$FONT_URL"
fi

echo "done. files in: $FONTS_DIR"
ls -lh "$FONT_FILE"
