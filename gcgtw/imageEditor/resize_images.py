"""
Batch-resize images to an exact size using macOS `sips`.

Default use-case: resize `302/ST01/*.png` to 864x1216.

Notes
-----
- This uses `sips --resampleHeightWidth`, which may change aspect ratio.
- Writes to a new output directory by default; use `--in-place` to overwrite.

Examples
--------
Dry-run:
  python3 resize_images.py --in-dir 302/ST01 --width 864 --height 1216 --dry-run

Write to a new folder:
  python3 resize_images.py --in-dir 302/ST01 --out-dir 302/ST01_864x1216 --width 864 --height 1216

Overwrite in place:
  python3 resize_images.py --in-dir 302/ST01 --width 864 --height 1216 --in-place
"""

from __future__ import annotations

import argparse
import os
import subprocess
import tempfile
from typing import List, Optional, Sequence, Tuple


def _run(cmd: Sequence[str]) -> str:
    res = subprocess.run(
        list(cmd),
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    if res.returncode != 0:
        raise RuntimeError(f"Command failed ({res.returncode}): {' '.join(cmd)}\n{res.stdout}")
    return res.stdout


def _sips_get_size(path: str) -> Tuple[int, int]:
    out = _run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", "-1", path])
    chunks: List[str] = []
    for line in out.splitlines():
        chunks.extend([c for c in line.split("|") if c.strip()])
    w = h = None
    for chunk in chunks:
        if "pixelWidth:" in chunk:
            w = int(chunk.split("pixelWidth:", 1)[1].strip())
        if "pixelHeight:" in chunk:
            h = int(chunk.split("pixelHeight:", 1)[1].strip())
    if w is None or h is None:
        raise RuntimeError(f"Unable to read image size via sips: {path}\n{out}")
    return w, h


def _iter_images(root: str) -> List[str]:
    out: List[str] = []
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if fn.startswith("."):
                continue
            ext = os.path.splitext(fn)[1].lower()
            if ext not in {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}:
                continue
            out.append(os.path.join(dirpath, fn))
    return sorted(out)


def _resize_one(src: str, dst: str, width: int, height: int) -> None:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    # sips expects: height width
    with tempfile.TemporaryDirectory() as td:
        tmp = os.path.join(td, os.path.basename(dst))
        _run(["sips", "--resampleHeightWidth", str(height), str(width), src, "-o", tmp])
        os.replace(tmp, dst)


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--in-dir", default=os.path.join("302", "ST01"))
    p.add_argument("--out-dir", help="defaults to <in-dir>_resized (ignored if --in-place)")
    p.add_argument("--in-place", action="store_true", help="overwrite images in place")
    p.add_argument("--width", type=int, default=864)
    p.add_argument("--height", type=int, default=1216)
    p.add_argument("--overwrite", action="store_true", help="overwrite existing files in out-dir")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args(argv)

    if not os.path.isdir(args.in_dir):
        print(f"Missing input dir: {args.in_dir}")
        return 2

    images = _iter_images(args.in_dir)
    if not images:
        print("No images found.")
        return 0

    out_dir = args.in_dir if args.in_place else (args.out_dir or f"{args.in_dir}_resized")
    if not args.in_place:
        os.makedirs(out_dir, exist_ok=True)

    processed = 0
    skipped = 0
    errors = 0

    for idx, src in enumerate(images, start=1):
        rel = os.path.relpath(src, args.in_dir)
        dst = os.path.join(out_dir, rel)

        if not args.in_place and os.path.exists(dst) and not args.overwrite:
            skipped += 1
            continue

        try:
            w, h = _sips_get_size(src)
            if w == args.width and h == args.height:
                if args.in_place:
                    skipped += 1
                    continue
                # If copying to out-dir, still avoid unnecessary work by copying bytes
                if not args.dry_run:
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    if os.path.abspath(src) != os.path.abspath(dst):
                        with open(src, "rb") as fsrc, open(dst, "wb") as fdst:
                            fdst.write(fsrc.read())
                processed += 1
                continue

            print(f"[{idx}/{len(images)}] {rel}: {w}x{h} -> {args.width}x{args.height}")
            if not args.dry_run:
                _resize_one(src, dst, args.width, args.height)
            processed += 1
        except Exception as e:
            errors += 1
            print(f"[ERR] {rel}: {e}")

    print(f"Done. processed={processed} skipped={skipped} errors={errors} out_dir={out_dir}")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

