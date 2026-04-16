#!/usr/bin/env bash
# Download tessdata_best (high-accuracy LSTM models) into backend/tessdata/.
# When this directory exists, ocr.service.ts auto-sets TESSDATA_PREFIX to it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESSDATA_DIR="$SCRIPT_DIR/../tessdata"
BASE_URL="https://github.com/tesseract-ocr/tessdata_best/raw/main"
LANGS=(eng jpn osd)

mkdir -p "$TESSDATA_DIR"

for lang in "${LANGS[@]}"; do
  out="$TESSDATA_DIR/$lang.traineddata"
  if [[ -f "$out" ]]; then
    echo "skip: $lang.traineddata already exists"
    continue
  fi
  echo "downloading: $lang.traineddata"
  curl -fsSL -o "$out" "$BASE_URL/$lang.traineddata"
done

# Tesseract needs configs/ and tessconfigs/ alongside .traineddata for output
# formats like pdf/txt. Copy them from the system tessdata install.
SYSTEM_TESSDATA="${SYSTEM_TESSDATA:-/usr/share/tesseract-ocr/5/tessdata}"
for sub in configs tessconfigs; do
  if [[ ! -d "$TESSDATA_DIR/$sub" && -d "$SYSTEM_TESSDATA/$sub" ]]; then
    cp -r "$SYSTEM_TESSDATA/$sub" "$TESSDATA_DIR/"
  fi
done
if [[ ! -f "$TESSDATA_DIR/pdf.ttf" && -f "$SYSTEM_TESSDATA/pdf.ttf" ]]; then
  cp "$SYSTEM_TESSDATA/pdf.ttf" "$TESSDATA_DIR/"
fi

echo "done. files in: $TESSDATA_DIR"
ls -lh "$TESSDATA_DIR"/*.traineddata
