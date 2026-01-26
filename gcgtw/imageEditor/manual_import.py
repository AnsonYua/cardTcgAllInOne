"""
Import manually-edited images from `302/manual/` into the correct set folders.

What it does
------------
- Reads files in `302/manual/` (jpg/png/webp/etc)
- Infers the card code from the filename (e.g. `GD01-023.jpg` -> `GD01` / `GD01-023`)
- Converts to PNG and resizes/pads to match the size used by the destination folder
  (e.g. match `302/GD01/*.png` dimensions)
- Writes to `302/<SET>/<CODE>.png`
- Moves the original file into `302/manual/_done/` (default) to keep the inbox clean

This script does NOT remove watermarks; it only formats/resizes images you already have.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import tempfile
from typing import Any, Dict, Optional, Sequence, Tuple


CODE_RE = re.compile(r"\b((?:GD|ST)\d{2})-(\d{3}(?:_p\d+)?)\b", re.IGNORECASE)


def _utc_now_iso() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def _log(msg: str, *, quiet: bool) -> None:
    if not quiet:
        print(msg, flush=True)


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _run(cmd: Sequence[str]) -> str:
    res = subprocess.run(cmd, check=False, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Command failed ({res.returncode}): {' '.join(cmd)}\n{res.stdout}")
    return res.stdout


def _sips_get_size(path: str) -> Tuple[int, int]:
    # Use one-line output, e.g.:
    #   pixelWidth: 864
    #   pixelHeight: 1216
    out = _run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", "-1", path])
    w = h = None
    for line in out.splitlines():
        if "pixelWidth:" in line:
            w = int(line.split("pixelWidth:", 1)[1].strip())
        if "pixelHeight:" in line:
            h = int(line.split("pixelHeight:", 1)[1].strip())
    if w is None or h is None:
        raise RuntimeError(f"Unable to read image size via sips: {path}\n{out}")
    return w, h


def _infer_target_size_from_folder(folder: str) -> Optional[Tuple[int, int]]:
    if not os.path.isdir(folder):
        return None
    pngs = sorted([p for p in os.listdir(folder) if p.lower().endswith(".png")])
    if not pngs:
        return None
    sample = os.path.join(folder, pngs[0])
    return _sips_get_size(sample)


def _infer_target_size_from_json(json_path: str) -> Optional[Tuple[int, int]]:
    if not os.path.exists(json_path):
        return None
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 302_api.py format
    cfg = data.get("config")
    if isinstance(cfg, dict):
        w = cfg.get("width")
        h = cfg.get("height")
        if isinstance(w, int) and isinstance(h, int):
            return w, h

    # alibaba_api.py format
    params = data.get("parameters")
    if isinstance(params, dict):
        size = params.get("size")
        if isinstance(size, str) and "*" in size:
            w_s, h_s = size.split("*", 1)
            try:
                return int(w_s), int(h_s)
            except ValueError:
                return None
    return None


def _parse_code(filename: str) -> Optional[Tuple[str, str]]:
    m = CODE_RE.search(filename)
    if not m:
        return None
    set_code = m.group(1).upper()
    suffix = m.group(2)
    return set_code, f"{set_code}-{suffix}"


def _unique_path(path: str) -> str:
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    n = 1
    while True:
        cand = f"{base}_{n}{ext}"
        if not os.path.exists(cand):
            return cand
        n += 1


def _convert_resize_pad_to_png(
    *,
    src_path: str,
    dst_path: str,
    target_w: int,
    target_h: int,
    pad_color: str,
) -> None:
    _ensure_dir(os.path.dirname(dst_path))

    # Work in temp files so we don't partially write dst_path.
    with tempfile.TemporaryDirectory() as td:
        tmp1 = os.path.join(td, "step1.png")
        tmp2 = os.path.join(td, "step2.png")
        tmp3 = os.path.join(td, "step3.png")
        tmp4 = os.path.join(td, "out.png")

        # 1) Convert to PNG
        _run(["sips", "-s", "format", "png", src_path, "-o", tmp1])

        # 2) Scale to target height (keeps aspect ratio)
        _run(["sips", "--resampleHeight", str(target_h), tmp1, "-o", tmp2])

        # 3) If width still exceeds target, scale to target width (keeps aspect ratio)
        w2, h2 = _sips_get_size(tmp2)
        if w2 > target_w:
            _run(["sips", "--resampleWidth", str(target_w), tmp2, "-o", tmp3])
        else:
            shutil.copyfile(tmp2, tmp3)

        # 4) Pad to exact target dimensions
        _run(
            [
                "sips",
                "--padToHeightWidth",
                str(target_h),
                str(target_w),
                "--padColor",
                pad_color,
                tmp3,
                "-o",
                tmp4,
            ]
        )

        os.replace(tmp4, dst_path)


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--manual-dir", default=os.path.join("302", "manual"))
    p.add_argument("--out-root", default="302")
    p.add_argument("--done-dir", default=os.path.join("302", "manual", "_done"))
    p.add_argument("--pad-color", default="FFFFFF", help="hex color for padding (default: white)")
    p.add_argument("--overwrite", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--keep-original", action="store_true", help="copy instead of moving originals into done-dir")
    p.add_argument("--quiet", action="store_true")
    args = p.parse_args(argv)

    if not os.path.isdir(args.manual_dir):
        _log(f"No manual dir: {args.manual_dir}", quiet=args.quiet)
        return 0

    _ensure_dir(args.done_dir)

    target_size_cache: Dict[str, Tuple[int, int]] = {}

    processed = 0
    skipped = 0
    errors = 0

    files = sorted(
        [
            os.path.join(args.manual_dir, f)
            for f in os.listdir(args.manual_dir)
            if os.path.isfile(os.path.join(args.manual_dir, f))
            and not f.startswith(".")
        ]
    )

    for src in files:
        filename = os.path.basename(src)
        parsed = _parse_code(filename)
        if not parsed:
            skipped += 1
            _log(f"[SKIP] cannot infer code from filename: {filename}", quiet=args.quiet)
            continue

        set_code, card_code = parsed
        dest_dir = os.path.join(args.out_root, set_code)
        dest_png = os.path.join(dest_dir, f"{card_code}.png")

        if os.path.exists(dest_png) and not args.overwrite:
            skipped += 1
            _log(f"[SKIP] exists: {dest_png}", quiet=args.quiet)
            continue

        if set_code not in target_size_cache:
            size = _infer_target_size_from_folder(dest_dir)
            if size is None:
                json_path = os.path.join(args.out_root, f"{set_code}.json")
                size = _infer_target_size_from_json(json_path)
            if size is None:
                errors += 1
                _log(f"[ERR] cannot infer target size for {set_code} (no images / no {set_code}.json)", quiet=args.quiet)
                continue
            target_size_cache[set_code] = size

        target_w, target_h = target_size_cache[set_code]
        _log(
            f"[DO] {filename} -> {dest_png} (target={target_w}x{target_h})",
            quiet=args.quiet,
        )

        try:
            if not args.dry_run:
                _convert_resize_pad_to_png(
                    src_path=src,
                    dst_path=dest_png,
                    target_w=target_w,
                    target_h=target_h,
                    pad_color=args.pad_color,
                )

                done_path = _unique_path(os.path.join(args.done_dir, filename))
                if args.keep_original:
                    shutil.copy2(src, done_path)
                else:
                    shutil.move(src, done_path)
            processed += 1
        except Exception as e:
            errors += 1
            _log(f"[ERR] {filename}: {e}", quiet=args.quiet)

    _log(
        f"Done at {_utc_now_iso()}. processed={processed} skipped={skipped} errors={errors}",
        quiet=args.quiet,
    )
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

