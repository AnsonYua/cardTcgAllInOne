"""
Render card effects text onto existing card images (ST01/ST02/etc).

Reads:
  /Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/<set>Card.json

Finds:
  images under ./302/<SET>/ (configurable)

Writes:
  annotated images to ./302/<SET>_effectBox/ (configurable)

Text layout:
  - base/command: box top-left (81, 907), width=692, height=141
  - unit: box top-left (54, 854), width=730, height=215
  If `effects.description` is an array with 2 strings, render the second string on the next line.

Requires:
  Pillow (`pip install pillow`)

   python st01_effect_box.py --no-fit --font-size 28 --stroke-width 3  --stroke-fill "#FFFFFF" --overwrite --bold --line-height-mult 1.2 --draw-box --box-fill #FFFFFF80
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


SUPPORTED_INPUT_EXTS = ["png", "jpg", "jpeg"]

UNIT_BOX_X = 54
UNIT_BOX_Y = 854
UNIT_BOX_W = 730
UNIT_BOX_H = 215

BASE_BOX_X = 81
BASE_BOX_Y = 907
BASE_BOX_W = 692
BASE_BOX_H = 141

# Override: base card box (requested)
BASE_BOX_X = 50
BASE_BOX_Y = 875
BASE_BOX_W = 740
BASE_BOX_H = 230

COMMAND_WITH_PILOT_BOX_X = 81
COMMAND_WITH_PILOT_BOX_Y = 907
COMMAND_WITH_PILOT_BOX_W = 692
COMMAND_WITH_PILOT_BOX_H = 151

COMMAND_NO_PILOT_BOX_X = 81
COMMAND_NO_PILOT_BOX_Y = 960
COMMAND_NO_PILOT_BOX_W = 692
COMMAND_NO_PILOT_BOX_H = 151

CHARACTER_BOX_X = 75
CHARACTER_BOX_Y = 1042
CHARACTER_BOX_W = 591
CHARACTER_BOX_H = 150


def _try_import_pillow():
    try:
        from PIL import Image, ImageDraw, ImageFont  # type: ignore

        return Image, ImageDraw, ImageFont
    except Exception:
        return None


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _normalize_desc(desc: Any) -> str:
    """
    Normalize description to a printable string.
    - string -> itself
    - list of strings -> joined by newline
    - None/other -> empty string
    """
    if isinstance(desc, str):
        return desc.strip()
    if isinstance(desc, list):
        parts: List[str] = []
        for x in desc:
            if isinstance(x, str) and x.strip():
                parts.append(x.strip())
        return "\n".join(parts).strip()
    return ""


def _wrap_text(text: str, measure_fn, max_width: int) -> List[str]:
    """
    Wrap text to fit `max_width` using `measure_fn(line)->width`.
    Respects existing newlines by wrapping each paragraph separately.
    """
    if not text:
        return []

    out_lines: List[str] = []
    for para in text.splitlines():
        para = para.strip()
        if not para:
            out_lines.append("")
            continue

        # Prefer word wrap; if no spaces, fallback to char-wrap.
        if " " in para:
            words = para.split()
            current = ""
            for w in words:
                cand = w if not current else f"{current} {w}"
                if measure_fn(cand) <= max_width:
                    current = cand
                else:
                    if current:
                        out_lines.append(current)
                    current = w
            if current:
                out_lines.append(current)
        else:
            current = ""
            for ch in para:
                cand = current + ch
                if measure_fn(cand) <= max_width:
                    current = cand
                else:
                    if current:
                        out_lines.append(current)
                    current = ch
            if current:
                out_lines.append(current)
    return out_lines


def _pick_font(ImageFont, font_path: Optional[str], font_size: int, *, bold: bool):
    if font_path:
        return ImageFont.truetype(font_path, font_size)

    # Best-effort default fonts on macOS
    if bold:
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/Supplemental/Helvetica Bold.ttf",
            "/System/Library/Fonts/HelveticaNeue.ttc",
            "/System/Library/Fonts/Helvetica.ttc",
        ]
    else:
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Helvetica.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        ]
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, font_size)

    return ImageFont.load_default()


def _fit_text(
    *,
    ImageDraw,
    draw,
    text: str,
    box_w: int,
    box_h: int,
    font_path: Optional[str],
    font_size_start: int,
    font_size_min: int,
    line_spacing: int,
    line_height_mult: float,
    bold: bool,
    stroke_width: int,
    ImageFont,
) -> Tuple[Any, List[str]]:
    """
    Find a font size + wrapped lines that fit within the box.
    Returns (font, lines).
    """
    if not text.strip():
        font = _pick_font(ImageFont, font_path, font_size_start, bold=bold)
        return font, []

    for size in range(font_size_start, font_size_min - 1, -1):
        font = _pick_font(ImageFont, font_path, size, bold=bold)
        try:
            ascent, descent = font.getmetrics()
            base_line_h = int((ascent + descent) * max(0.1, line_height_mult))
        except Exception:
            base_line_h = int(size * max(0.1, line_height_mult))

        def measure(s: str) -> int:
            bbox = draw.textbbox((0, 0), s, font=font, stroke_width=stroke_width)
            return int(bbox[2] - bbox[0])

        lines = _wrap_text(text, measure, box_w)
        if not lines:
            return font, lines

        # Ensure all lines fit width (wrap should guarantee, but stroke may push it over)
        too_wide = False
        for ln in lines:
            bbox = draw.textbbox((0, 0), ln or "A", font=font, stroke_width=stroke_width)
            w = int(bbox[2] - bbox[0])
            if w > box_w:
                too_wide = True
                break
        if too_wide:
            continue

        total_h = len(lines) * base_line_h + max(0, len(lines) - 1) * line_spacing
        if total_h <= box_h:
            return font, lines

    # If nothing fits, return smallest and wrap anyway (will clip)
    font = _pick_font(ImageFont, font_path, font_size_min, bold=bold)

    def measure_small(s: str) -> int:
        bbox = draw.textbbox((0, 0), s, font=font, stroke_width=stroke_width)
        return int(bbox[2] - bbox[0])

    return font, _wrap_text(text, measure_small, box_w)


@dataclass(frozen=True)
class Paths:
    json_path: str
    images_dir: str
    out_dir: str


def _iter_cards(cards: Dict[str, Any]) -> Iterable[Tuple[str, Dict[str, Any]]]:
    for code, card in cards.items():
        if not isinstance(card, dict):
            continue
        if card.get("cardType") in {"unit", "base", "command", "pilot"}:
            yield code, card


def _has_designate_pilot(card: Dict[str, Any]) -> bool:
    effects = card.get("effects")
    if not isinstance(effects, dict):
        return False
    rules = effects.get("rules")
    if not isinstance(rules, list):
        return False
    for r in rules:
        if isinstance(r, dict) and r.get("action") == "designate_pilot":
            return True
    return False


def _find_src_image(images_dir: str, code: str) -> Optional[str]:
    for ext in SUPPORTED_INPUT_EXTS:
        p = os.path.join(images_dir, f"{code}.{ext}")
        if os.path.exists(p):
            return p
    return None


def main(argv: Optional[Sequence[str]] = None) -> int:
    Image = ImageDraw = ImageFont = None

    def ensure_pillow():
        nonlocal Image, ImageDraw, ImageFont
        if Image is not None:
            return
        pillow = _try_import_pillow()
        if pillow is None:
            raise RuntimeError(
                "Missing dependency: Pillow. Install in a venv and run with that Python.\n"
                "Example:\n"
                "  python3 -m venv .venv\n"
                "  source .venv/bin/activate\n"
                "  python -m pip install pillow\n"
            )
        Image, ImageDraw, ImageFont = pillow

    default_set = "ST01"
    default_json = f"/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/{default_set.lower()}Card.json"
    default_images_dir = os.path.join("302", default_set)
    default_out_dir = os.path.join("302", f"{default_set}_effectBox")

    p = argparse.ArgumentParser()
    p.add_argument("--set", help="e.g. ST02 (auto-sets --json/--images-dir/--out-dir if left as defaults)")
    p.add_argument(
        "--json",
        default=default_json,
    )
    p.add_argument("--images-dir", default=default_images_dir)
    p.add_argument("--out-dir", default=default_out_dir)
    p.add_argument("--font", help="optional font path (ttf/ttc)")
    p.add_argument("--font-size", type=int, default=20, help="starting font size (auto-shrinks to fit unless --no-fit)")
    p.add_argument("--min-font-size", type=int, default=12, help="minimum font size when auto-fitting")
    p.add_argument(
        "--bold",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="use a bold system font when --font is not provided (default: true)",
    )
    p.add_argument(
        "--line-height-mult",
        type=float,
        default=1.0,
        help="line height multiplier (e.g. 1.2 for taller lines, 0.9 for tighter)",
    )
    p.add_argument("--line-spacing", type=int, default=4)
    p.add_argument("--text-color", default="#000000")
    p.add_argument("--no-fit", action="store_true", help="disable auto-fit; use --font-size as-is (text may clip)")
    p.add_argument(
        "--draw-box",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="draw a background box behind the text (default: true)",
    )
    p.add_argument(
        "--box-fill",
        default="#FFFFFF80",
        help="RGBA hex like #RRGGBBAA (default: 50% transparent white)",
    )
    p.add_argument(
        "--box-outline",
        default="",
        help="RGBA hex like #RRGGBBAA (empty disables outline; default: disabled)",
    )
    p.add_argument("--stroke-width", type=int, default=0, help="outline text for readability (0=off)")
    p.add_argument("--stroke-fill", default="#FFFFFF", help="stroke color (only if --stroke-width > 0)")
    p.add_argument(
        "--unit-box",
        default=f"{UNIT_BOX_X},{UNIT_BOX_Y},{UNIT_BOX_W},{UNIT_BOX_H}",
        help="unit box as x,y,w,h",
    )
    p.add_argument(
        "--base-box",
        default=f"{BASE_BOX_X},{BASE_BOX_Y},{BASE_BOX_W},{BASE_BOX_H}",
        help="base/command box as x,y,w,h",
    )
    p.add_argument(
        "--command-box-with-pilot",
        default=f"{COMMAND_WITH_PILOT_BOX_X},{COMMAND_WITH_PILOT_BOX_Y},{COMMAND_WITH_PILOT_BOX_W},{COMMAND_WITH_PILOT_BOX_H}",
        help="command box when any rule has action=designate_pilot (x,y,w,h)",
    )
    p.add_argument(
        "--command-box-no-pilot",
        default=f"{COMMAND_NO_PILOT_BOX_X},{COMMAND_NO_PILOT_BOX_Y},{COMMAND_NO_PILOT_BOX_W},{COMMAND_NO_PILOT_BOX_H}",
        help="command box when no designate_pilot (x,y,w,h)",
    )
    p.add_argument(
        "--pilot-box",
        default=f"{CHARACTER_BOX_X},{CHARACTER_BOX_Y},{CHARACTER_BOX_W},{CHARACTER_BOX_H}",
        help="character box as x,y,w,h",
    )
    p.add_argument(
        "--move-empty-description",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="if effects.description == [], move the source image into out-dir instead of copying (default: false)",
    )
    p.add_argument("--overwrite", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args(argv)

    if args.set:
        set_code = str(args.set).strip().upper()
        if args.json == default_json:
            args.json = f"/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/{set_code.lower()}Card.json"
        if args.images_dir == default_images_dir:
            args.images_dir = os.path.join("302", set_code)
        if args.out_dir == default_out_dir:
            args.out_dir = os.path.join("302", f"{set_code}_effectBox")

    def parse_box(s: str) -> Tuple[int, int, int, int]:
        parts = [p.strip() for p in s.split(",")]
        if len(parts) != 4:
            raise ValueError(f"Invalid box '{s}', expected x,y,w,h")
        x, y, w, h = (int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3]))
        return x, y, w, h

    try:
        unit_box = parse_box(args.unit_box)
        base_box = parse_box(args.base_box)
        command_box_with_pilot = parse_box(args.command_box_with_pilot)
        command_box_no_pilot = parse_box(args.command_box_no_pilot)
        pilot_box = parse_box(args.pilot_box)
    except ValueError as e:
        print(f"Argument error: {e}", file=sys.stderr)
        return 2

    data = _load_json(args.json)
    cards = data.get("cards")
    if not isinstance(cards, dict):
        print("Unexpected JSON shape: expected top-level `cards` object.", file=sys.stderr)
        return 2

    _ensure_dir(args.out_dir)

    processed = 0
    skipped = 0
    missing_images = 0

    for code, card in _iter_cards(cards):
        card_type = card.get("cardType")
        effects = card.get("effects")
        raw_desc: Any = None
        desc = ""
        if isinstance(effects, dict):
            raw_desc = effects.get("description")
            desc = _normalize_desc(raw_desc)
        else:
            desc = ""

        src_img = _find_src_image(args.images_dir, code)
        if not src_img:
            missing_images += 1
            tried = ", ".join([f"{code}.{e}" for e in SUPPORTED_INPUT_EXTS])
            print(f"[MISS_IMG] {code} (tried: {tried})", file=sys.stderr)
            continue

        dst_img = os.path.join(args.out_dir, f"{code}.png")
        if os.path.exists(dst_img) and not args.overwrite:
            skipped += 1
            continue

        # If description is explicitly an empty array, copy (or move) the image unchanged.
        if isinstance(raw_desc, list) and len(raw_desc) == 0:
            if args.dry_run:
                action = "move" if args.move_empty_description else "copy"
                print(f"[DRY] {code}: description=[] -> {action}")
            else:
                if args.move_empty_description:
                    # Only a true move when the source is already PNG; otherwise convert+delete.
                    if src_img.lower().endswith(".png"):
                        shutil.move(src_img, dst_img)
                    else:
                        ensure_pillow()
                        assert Image is not None
                        Image.open(src_img).convert("RGBA").save(dst_img, "PNG", optimize=True)
                        os.remove(src_img)
                else:
                    if src_img.lower().endswith(".png"):
                        shutil.copy2(src_img, dst_img)
                    else:
                        ensure_pillow()
                        assert Image is not None
                        Image.open(src_img).convert("RGBA").save(dst_img, "PNG", optimize=True)
            processed += 1
            continue

        # If there's no effect text, copy the source image unchanged.
        if not desc:
            if args.dry_run:
                print(f"[DRY] {code}: no effects -> copy")
            else:
                if src_img.lower().endswith(".png"):
                    shutil.copy2(src_img, dst_img)
                else:
                    ensure_pillow()
                    assert Image is not None
                    Image.open(src_img).convert("RGBA").save(dst_img, "PNG", optimize=True)
            processed += 1
            continue

        if args.dry_run:
            preview = desc[:60].replace("\n", " / ")
            print(f"[DRY] {code}: {preview}...")
            processed += 1
            continue

        try:
            ensure_pillow()
        except Exception as e:
            print(str(e), file=sys.stderr)
            return 2

        assert Image is not None and ImageDraw is not None and ImageFont is not None
        im = Image.open(src_img).convert("RGBA")
        overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        if card_type == "unit":
            x0, y0, box_w, box_h = unit_box
        elif card_type == "command":
            x0, y0, box_w, box_h = (
                command_box_with_pilot if _has_designate_pilot(card) else command_box_no_pilot
            )
        elif card_type == "pilot":
            x0, y0, box_w, box_h = pilot_box
        else:
            x0, y0, box_w, box_h = base_box
        x1, y1 = x0 + box_w, y0 + box_h

        # Fit and draw text
        if args.draw_box:
            outline = args.box_outline if args.box_outline else None
            draw.rectangle(
                [x0, y0, x1, y1],
                fill=args.box_fill,
                outline=outline,
                width=2 if outline else 0,
            )

        # Always evaluate fit; if it overshoots, reduce font size by 1 and re-evaluate.
        # `--no-fit` means "start at --font-size", but still shrink if it doesn't fit.
        start_size = int(args.font_size)
        min_size = int(args.min_font_size)
        if args.no_fit:
            # Still allow shrinking when it doesn't fit.
            start_size = int(args.font_size)
        font, lines = _fit_text(
            ImageDraw=ImageDraw,
            draw=draw,
            text=desc,
            box_w=box_w - 16,
            box_h=box_h - 16,
            font_path=args.font,
            font_size_start=start_size,
            font_size_min=min_size,
            line_spacing=args.line_spacing,
            line_height_mult=float(args.line_height_mult),
            bold=bool(args.bold),
            stroke_width=max(0, int(args.stroke_width)),
            ImageFont=ImageFont,
        )
        try:
            ascent, descent = font.getmetrics()
            base_line_h = int((ascent + descent) * max(0.1, float(args.line_height_mult)))
        except Exception:
            base_line_h = int(start_size * max(0.1, float(args.line_height_mult)))

        tx = x0 + 8
        ty = y0 + 8
        for ln in lines:
            draw.text(
                (tx, ty),
                ln,
                font=font,
                fill=args.text_color,
                stroke_width=max(0, int(args.stroke_width)),
                stroke_fill=args.stroke_fill,
            )
            ty += base_line_h + args.line_spacing

        out = Image.alpha_composite(im, overlay).convert("RGBA")
        out.save(dst_img, "PNG", optimize=True)
        processed += 1

    print(f"Done. processed={processed} skipped={skipped} missing_images={missing_images}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
