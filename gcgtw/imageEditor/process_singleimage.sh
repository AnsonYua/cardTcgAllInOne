#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./process_singleimage.sh [--in-dir <dir>] [--out-dir <dir>] [--keep-tmp]

Default:
  --in-dir  ./singleimage
  --out-dir <in-dir>/out_657x912_jpeg85_r10

Pipeline:
  1) resize to 657x912
  2) optimize -> JPEG quality 85
  3) round corners radius 10 -> JPEG quality 85
  4) preview resize to 194x273
EOF
}

IN_DIR="$ROOT_DIR/singleimage"
OUT_DIR=""
KEEP_TMP="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --in-dir)
      IN_DIR="$2"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    --keep-tmp)
      KEEP_TMP="1"
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="$IN_DIR/out_657x912_jpeg85_r10"
fi

PY="$ROOT_DIR/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  PY="python3"
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "Missing macOS tool: sips" >&2
  exit 1
fi

if ! "$PY" -c "import PIL" >/dev/null 2>&1; then
  echo "Missing Python dependency: Pillow (PIL)" >&2
  echo "Install with:" >&2
  echo "  $ROOT_DIR/.venv/bin/pip install Pillow" >&2
  exit 1
fi

if [[ ! -d "$IN_DIR" ]]; then
  echo "Missing input folder: $IN_DIR" >&2
  exit 1
fi

IMAGES=()
while IFS= read -r p; do
  [[ -n "$p" ]] && IMAGES+=("$p")
done < <(
  find "$IN_DIR" -maxdepth 1 -type f \
    \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.tif' -o -iname '*.tiff' \) \
    ! -name '.*' | sort
)

if [[ "${#IMAGES[@]}" -eq 0 ]]; then
  echo "No image found in: $IN_DIR" >&2
  exit 1
fi
if [[ "${#IMAGES[@]}" -ne 1 ]]; then
  echo "Expected exactly 1 image in $IN_DIR, found ${#IMAGES[@]}:" >&2
  printf '  - %s\n' "${IMAGES[@]}" >&2
  exit 1
fi

INPUT_IMAGE="${IMAGES[0]}"

mkdir -p "$OUT_DIR"
TMP_DIR="$OUT_DIR/_tmp"
STAGE_IN="$TMP_DIR/0_input"
RESIZED_DIR="$TMP_DIR/1_resized_657x912"
OPTIMIZED_DIR="$TMP_DIR/2_optimized_jpeg85"
ROUNDED_DIR="$OUT_DIR/final_657x912_jpeg85_r10"
PREVIEW_DIR="$OUT_DIR/preview_194x273"

rm -rf "$TMP_DIR"
mkdir -p "$STAGE_IN" "$RESIZED_DIR" "$OPTIMIZED_DIR" "$ROUNDED_DIR" "$PREVIEW_DIR"
cp -f "$INPUT_IMAGE" "$STAGE_IN/"

echo "Input: $INPUT_IMAGE"
echo "Out:   $OUT_DIR"
echo ""

echo "[1/4] Resize -> 657x912"
"$PY" "$ROOT_DIR/resize_images.py" \
  --in-dir "$STAGE_IN" \
  --out-dir "$RESIZED_DIR" \
  --width 657 \
  --height 912 \
  --overwrite

echo ""
echo "[2/4] Optimize -> JPEG quality 85"
"$PY" "$ROOT_DIR/optimize_ready_to_use.py" \
  --in-dir "$RESIZED_DIR" \
  --out-dir "$OPTIMIZED_DIR" \
  --format jpeg \
  --quality 85 \
  --overwrite

echo ""
echo "[3/4] Round corners -> radius 10 (JPEG quality 85)"
"$PY" "$ROOT_DIR/roundcorner.py" \
  --input-dir "$OPTIMIZED_DIR" \
  --out-dir "$ROUNDED_DIR" \
  --radius 10 \
  --format jpeg \
  --jpeg-quality 85 \
  --background "#FFFFFF"

echo ""
echo "[4/4] Preview -> 194x273"
"$PY" "$ROOT_DIR/resize_images.py" \
  --in-dir "$ROUNDED_DIR" \
  --out-dir "$PREVIEW_DIR" \
  --width 194 \
  --height 273 \
  --overwrite

echo ""
echo "Done."
echo "Final:   $ROUNDED_DIR"
echo "Preview: $PREVIEW_DIR"

if [[ "$KEEP_TMP" != "1" ]]; then
  rm -rf "$TMP_DIR"
else
  echo "Tmp kept: $TMP_DIR"
fi
