"""
Optimize/compress website-ready images under `302/readyToUse/`.

This uses macOS `sips` (no Pillow required) to:
- optionally downscale (max dimension)
- strip color management metadata
- optionally apply "optimizeColorForSharing"
- write to a new output folder preserving the subfolder layout

By default it keeps PNG output (safe). For much smaller files, consider `--format avif`.

Examples
--------
Dry-run:
  python3 optimize_ready_to_use.py --dry-run

Optimize PNGs into `302/readyToUse_optimized/`:
  python3 optimize_ready_to_use.py

Create AVIFs (smaller) with quality 60 and max dimension 1024:
  python3 optimize_ready_to_use.py --format avif --quality 60 --max-dim 1024
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
from typing import Any, Dict, List, Optional, Sequence, Tuple


DEFAULT_IN_DIR = os.path.join("302", "readyToUse")
DEFAULT_OUT_DIR = os.path.join("302", "readyToUse_optimized")


def _utc_now_iso() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def _log(msg: str, *, quiet: bool) -> None:
    if not quiet:
        try:
            print(msg, flush=True)
        except BrokenPipeError:
            # Allow piping output to tools like `head` without crashing.
            pass


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _atomic_write_json(path: str, payload: Any) -> None:
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp_path, path)


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
    # `-1` can return everything on a single line separated by `|`.
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


def _optimize_one(
    *,
    src: str,
    dst: str,
    out_format: str,
    quality: int,
    scale: float,
    max_dim: int,
    optimize_for_sharing: bool,
    strip_color_mgmt: bool,
) -> None:
    _ensure_dir(os.path.dirname(dst))

    cmd: List[str] = ["sips"]

    if scale and scale != 1.0:
        w, h = _sips_get_size(src)
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        cmd += ["-z", str(new_h), str(new_w)]

    if max_dim and max_dim > 0:
        cmd += ["-Z", str(max_dim)]

    if strip_color_mgmt:
        cmd += ["--deleteColorManagementProperties"]

    if optimize_for_sharing:
        cmd += ["--optimizeColorForSharing"]

    # format + quality
    cmd += ["-s", "format", out_format]
    if out_format in {"jpeg", "avif"}:
        # `formatOptions` supports percent on modern macOS; keep within 1..100
        q = max(1, min(100, quality))
        cmd += ["-s", "formatOptions", str(q)]

    cmd += [src, "-o", dst]
    _run(cmd)


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


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--in-dir", default=DEFAULT_IN_DIR)
    p.add_argument("--out-dir", default=DEFAULT_OUT_DIR)
    p.add_argument("--format", default="png", choices=["png", "jpeg", "avif"])
    p.add_argument("--quality", type=int, default=70, help="used for jpeg/avif (1-100)")
    p.add_argument("--scale", type=float, default=1.0, help="resize by scale factor (e.g. 0.5). Applied before --max-dim.")
    p.add_argument("--max-dim", type=int, default=0, help="downscale so max(w,h) <= this (0=keep)")
    p.add_argument("--optimize-for-sharing", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--strip-color-mgmt", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--overwrite", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--quiet", action="store_true")
    args = p.parse_args(argv)

    if not os.path.isdir(args.in_dir):
        print(f"Missing input dir: {args.in_dir}", file=os.sys.stderr)
        return 2

    images = _iter_images(args.in_dir)
    if not images:
        _log("No images found.", quiet=args.quiet)
        return 0

    _ensure_dir(args.out_dir)

    report: Dict[str, Any] = {
        "started_at": _utc_now_iso(),
        "in_dir": args.in_dir,
        "out_dir": args.out_dir,
        "format": args.format,
        "quality": args.quality,
        "scale": args.scale,
        "max_dim": args.max_dim,
        "optimize_for_sharing": args.optimize_for_sharing,
        "strip_color_mgmt": args.strip_color_mgmt,
        "items": [],
    }

    total_before = 0
    total_after = 0
    processed = 0
    skipped = 0
    errors = 0

    for idx, src in enumerate(images, start=1):
        rel = os.path.relpath(src, args.in_dir)
        base, _ext = os.path.splitext(rel)
        out_rel = f"{base}.{args.format}"
        dst = os.path.join(args.out_dir, out_rel)

        if os.path.exists(dst) and not args.overwrite:
            skipped += 1
            _log(f"[SKIP] {idx}/{len(images)} exists: {out_rel}", quiet=args.quiet)
            continue

        before_bytes = os.path.getsize(src)
        total_before += before_bytes
        before_w, before_h = _sips_get_size(src)

        _log(f"[DO] {idx}/{len(images)} {rel} -> {out_rel}", quiet=args.quiet)
        try:
            if not args.dry_run:
                _optimize_one(
                    src=src,
                    dst=dst,
                    out_format=args.format,
                    quality=args.quality,
                    scale=args.scale,
                    max_dim=args.max_dim,
                    optimize_for_sharing=args.optimize_for_sharing,
                    strip_color_mgmt=args.strip_color_mgmt,
                )
                after_bytes = os.path.getsize(dst)
                after_w, after_h = _sips_get_size(dst)
            else:
                after_bytes = 0
                after_w, after_h = before_w, before_h

            total_after += after_bytes
            processed += 1

            report["items"].append(
                {
                    "src": src,
                    "dst": dst,
                    "rel": rel,
                    "before": {"bytes": before_bytes, "width": before_w, "height": before_h},
                    "after": {"bytes": after_bytes, "width": after_w, "height": after_h},
                }
            )
        except Exception as e:
            errors += 1
            report["items"].append(
                {
                    "src": src,
                    "dst": dst,
                    "rel": rel,
                    "error": str(e),
                }
            )
            _log(f"[ERR] {rel}: {e}", quiet=args.quiet)

    report["finished_at"] = _utc_now_iso()
    report["summary"] = {
        "processed": processed,
        "skipped": skipped,
        "errors": errors,
        "total_before_bytes": total_before,
        "total_after_bytes": total_after,
    }

    report_path = os.path.join(args.out_dir, "optimize_report.json")
    _atomic_write_json(report_path, report)

    _log(
        f"Done. processed={processed} skipped={skipped} errors={errors} report={report_path}",
        quiet=args.quiet,
    )
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
