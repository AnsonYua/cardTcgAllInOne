"""
Download results for 302.ai `qwen-image-edit-plus` jobs created by `302_api.py`.

This script:
- Reads an input JSON (e.g. `302/ST01.json`) created by `302_api.py`
- For each `request_id`, calls:
    GET https://api.302.ai/302/submit/qwen-image-edit-plus?request_id=<id>
- When the response includes `images[].url`, downloads those images and saves them
  under an output folder (default: `302/<json-stem>/`).
- Updates the same JSON file in-place with per-item `result` metadata so it can resume.

Examples
--------
Poll until ready and download into `302/ST01/`:
    API_302_TOKEN=... python3 302_dlImage.py --in-json 302/ST01.json --poll

Download once (no polling), writing into a specific folder:
    API_302_TOKEN=... python3 302_dlImage.py --in-json 302/ST01.json --out-dir 302/ST01 --no-poll


API_302_TOKEN=sk-bmNvnq1tleywOOjOhYZyDfyuAbJ77BGjLsLxVkeTT4bAFh0R python3 302_dlImage.py --in-json 302/ST05.json --out-dir 302/ST05 --no-poll
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import random
import sys
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple


ENDPOINT = "https://api.302.ai/302/submit/qwen-image-edit-plus"


def _utc_now_iso() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def _log(msg: str, *, quiet: bool) -> None:
    if not quiet:
        print(msg, flush=True)


def _short_json(data: Any, max_len: int = 400) -> str:
    try:
        s = json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    except Exception:
        s = str(data)
    if len(s) > max_len:
        return s[: max_len - 3] + "..."
    return s


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _atomic_write_json(path: str, payload: Any) -> None:
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp_path, path)


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_token(cli_token: Optional[str]) -> str:
    token = cli_token or os.getenv("API_302_TOKEN") or os.getenv("AI302_TOKEN")
    if not token:
        raise SystemExit(
            "Missing token. Provide `--token ...` or set env `API_302_TOKEN`."
        )
    return token.strip()


def _sleep_backoff(attempt: int, base: float, jitter: float) -> None:
    delay = base * (2**attempt) + random.random() * jitter
    time.sleep(delay)


def _http_get_json(
    *,
    url: str,
    headers: Dict[str, str],
    timeout_s: float,
) -> Tuple[int, Dict[str, Any]]:
    try:
        import requests  # type: ignore

        try:
            resp = requests.get(url, headers=headers, timeout=timeout_s)
            status = int(resp.status_code)
            try:
                data = resp.json()
            except Exception:
                data = {"raw_text": resp.text}
            return status, data
        except requests.RequestException as e:  # includes Timeout
            return 0, {"error": f"{type(e).__name__}: {e}"}
    except ImportError:
        import urllib.error
        import urllib.parse
        import urllib.request

        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=timeout_s) as resp:
                status = int(getattr(resp, "status", 200))
                raw = resp.read().decode("utf-8", errors="replace")
                try:
                    data = json.loads(raw)
                except Exception:
                    data = {"raw_text": raw}
                return status, data
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            try:
                data = json.loads(raw)
            except Exception:
                data = {"raw_text": raw}
            return int(e.code), data
        except Exception as e:
            return 0, {"error": f"{type(e).__name__}: {e}"}


def _http_download_bytes(
    *,
    url: str,
    headers: Dict[str, str],
    timeout_s: float,
) -> Tuple[int, bytes, Dict[str, str]]:
    try:
        import requests  # type: ignore

        try:
            resp = requests.get(url, headers=headers, timeout=timeout_s)
            return int(resp.status_code), resp.content, dict(resp.headers)
        except requests.RequestException as e:  # includes Timeout
            return 0, b"", {"error": f"{type(e).__name__}: {e}"}
    except ImportError:
        import urllib.error
        import urllib.request

        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=timeout_s) as resp:
                status = int(getattr(resp, "status", 200))
                data = resp.read()
                headers_out = {k.lower(): v for k, v in resp.headers.items()}
                return status, data, headers_out
        except urllib.error.HTTPError as e:
            return int(e.code), e.read(), {}
        except Exception as e:
            return 0, b"", {"error": f"{type(e).__name__}: {e}"}


def _guess_ext(image: Dict[str, Any], fallback: str = "png") -> str:
    url = image.get("url")
    if isinstance(url, str) and "." in url.rsplit("/", 1)[-1]:
        ext = url.rsplit(".", 1)[-1].split("?", 1)[0].strip().lower()
        if ext:
            return ext
    ct = image.get("content_type")
    if isinstance(ct, str) and "/" in ct:
        return ct.split("/", 1)[-1].strip().lower() or fallback
    return fallback


def _basename_from_image_url(image_url: str) -> str:
    # ST01-001.webp -> ST01-001
    last = image_url.rsplit("/", 1)[-1]
    last = last.split("?", 1)[0]
    if "." in last:
        last = last.rsplit(".", 1)[0]
    return last or "image"


def _result_already_downloaded(item: Dict[str, Any]) -> bool:
    result = item.get("result")
    if not isinstance(result, dict):
        return False
    downloaded = result.get("downloaded")
    if not isinstance(downloaded, list) or not downloaded:
        return False
    # Consider it done if at least one downloaded path exists
    for d in downloaded:
        if isinstance(d, dict) and isinstance(d.get("path"), str):
            return True
    return False


def fetch_result(
    *,
    token: str,
    request_id: str,
    timeout_s: float,
    max_retries: int,
    backoff_base_s: float,
    backoff_jitter_s: float,
) -> Dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{ENDPOINT}?request_id={request_id}"

    last_status: Optional[int] = None
    last_data: Optional[Dict[str, Any]] = None

    for attempt in range(max_retries + 1):
        status, data = _http_get_json(url=url, headers=headers, timeout_s=timeout_s)
        last_status, last_data = status, data
        if 200 <= status < 300:
            return {"ok": True, "http_status": status, "response": data}
        if status in {0, 408, 429} or 500 <= status <= 599:
            if attempt < max_retries:
                _sleep_backoff(attempt, backoff_base_s, backoff_jitter_s)
                continue
        return {"ok": False, "http_status": status, "response": data}

    return {"ok": False, "http_status": last_status, "response": last_data}


def download_one(
    *,
    url: str,
    timeout_s: float,
    max_retries: int,
    backoff_base_s: float,
    backoff_jitter_s: float,
) -> Tuple[int, bytes, Dict[str, str]]:
    last: Tuple[int, bytes, Dict[str, str]] = (0, b"", {})
    for attempt in range(max_retries + 1):
        status, data, headers = _http_download_bytes(
            url=url, headers={}, timeout_s=timeout_s
        )
        last = (status, data, headers)
        if 200 <= status < 300:
            return last
        if status in {0, 408, 429} or 500 <= status <= 599:
            if attempt < max_retries:
                _sleep_backoff(attempt, backoff_base_s, backoff_jitter_s)
                continue
        return last
    return last


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--in-json", action="append", default=[], help="repeatable")
    p.add_argument(
        "--token",
        help="or set env API_302_TOKEN",
    )
    p.add_argument(
        "--out-dir",
        help="output folder; default: 302/<json-stem>/",
    )
    p.add_argument("--quiet", action="store_true", help="suppress logs")
    p.add_argument("--log-response", action="store_true", help="print compact response JSON")
    p.add_argument(
        "--poll",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="poll until images are available (default: true)",
    )
    p.add_argument("--interval", type=float, default=5.0, help="poll interval seconds")
    p.add_argument("--max-wait", type=float, default=1800.0, help="max seconds per item")
    p.add_argument("--timeout", type=float, default=60.0, help="HTTP timeout seconds")
    p.add_argument("--max-retries", type=int, default=3)
    p.add_argument("--backoff-base", type=float, default=0.6)
    p.add_argument("--backoff-jitter", type=float, default=0.4)
    p.add_argument("--sleep", type=float, default=0.0, help="seconds between items")
    p.add_argument("--dry-run", action="store_true", help="do not call API or download")
    args = p.parse_args(argv)

    if not args.in_json:
        print("Missing --in-json", file=sys.stderr)
        return 2

    token = _get_token(args.token) if not args.dry_run else "dry-run"

    total_downloaded = 0
    total_pending = 0
    total_errors = 0

    for in_path in args.in_json:
        run = _load_json(in_path)
        items = run.get("items") or []
        if not isinstance(items, list):
            print(f"{in_path}: invalid format (items must be a list)", file=sys.stderr)
            total_errors += 1
            continue

        stem = os.path.splitext(os.path.basename(in_path))[0]
        out_dir = args.out_dir or os.path.join("302", stem)
        _ensure_dir(out_dir)

        changed = False

        _log(f"[FILE] {in_path} -> {out_dir} (items={len(items)})", quiet=args.quiet)

        for idx_item, item in enumerate(items, start=1):
            if not isinstance(item, dict):
                continue

            request_id = item.get("request_id")
            if not isinstance(request_id, str) or not request_id.strip():
                continue

            if _result_already_downloaded(item):
                _log(f"[SKIP] {idx_item}/{len(items)} request_id={request_id} (already downloaded)", quiet=args.quiet)
                continue

            image_url = item.get("image_url") if isinstance(item.get("image_url"), str) else ""
            base_name = _basename_from_image_url(image_url) if image_url else request_id

            if args.dry_run:
                _log(
                    f"[DRY_RUN] {idx_item}/{len(items)} would fetch request_id={request_id} -> {ENDPOINT}?request_id={request_id}",
                    quiet=args.quiet,
                )
                _log(f"[DRY_RUN] would save under: {out_dir}/{base_name}.<ext>", quiet=args.quiet)
                continue

            start = time.time()
            last_fetch: Optional[Dict[str, Any]] = None
            _log(f"[FETCH] {idx_item}/{len(items)} request_id={request_id} base={base_name}", quiet=args.quiet)
            while True:
                fetch = fetch_result(
                    token=token,
                    request_id=request_id,
                    timeout_s=args.timeout,
                    max_retries=args.max_retries,
                    backoff_base_s=args.backoff_base,
                    backoff_jitter_s=args.backoff_jitter,
                )
                last_fetch = fetch
                resp = fetch.get("response") or {}
                images = resp.get("images")

                note = ""
                if isinstance(resp, dict) and isinstance(resp.get("status"), str):
                    note = f" status={resp.get('status')}"
                _log(
                    f"[RESP] {idx_item}/{len(items)} http={fetch.get('http_status')} ok={fetch.get('ok')}{note} images={len(images) if isinstance(images, list) else 0}",
                    quiet=args.quiet,
                )
                if args.log_response:
                    _log(f"[RESP_JSON] {_short_json(resp)}", quiet=args.quiet)

                if fetch.get("ok") and isinstance(images, list) and images:
                    break

                if not args.poll:
                    total_pending += 1
                    item["result"] = {
                        "fetched_at": _utc_now_iso(),
                        "ok": bool(fetch.get("ok")),
                        "http_status": fetch.get("http_status"),
                        "response": resp,
                        "downloaded": [],
                        "note": "not_ready",
                    }
                    changed = True
                    _atomic_write_json(in_path, run)
                    _log(f"[PENDING] {idx_item}/{len(items)} not ready (no-poll)", quiet=args.quiet)
                    break

                if time.time() - start >= args.max_wait:
                    total_pending += 1
                    item["result"] = {
                        "fetched_at": _utc_now_iso(),
                        "ok": bool(fetch.get("ok")),
                        "http_status": fetch.get("http_status"),
                        "response": resp,
                        "downloaded": [],
                        "note": "timeout_waiting_for_images",
                    }
                    changed = True
                    _atomic_write_json(in_path, run)
                    _log(f"[TIMEOUT] {idx_item}/{len(items)} waited {args.max_wait}s", quiet=args.quiet)
                    break

                time.sleep(max(0.1, args.interval))

            # if not ready, continue to next item
            if not last_fetch:
                continue
            last_resp = last_fetch.get("response") or {}
            images = last_resp.get("images")
            if not (last_fetch.get("ok") and isinstance(images, list) and images):
                if args.sleep > 0:
                    time.sleep(args.sleep)
                continue

            downloaded: List[Dict[str, Any]] = []
            for idx, image in enumerate(images):
                if not isinstance(image, dict):
                    continue
                url = image.get("url")
                if not isinstance(url, str) or not url:
                    continue
                ext = _guess_ext(image, fallback="png")
                suffix = "" if idx == 0 else f"_{idx+1}"
                out_path = os.path.join(out_dir, f"{base_name}{suffix}.{ext}")

                # Resume: if file already exists, record and skip download
                if os.path.exists(out_path):
                    downloaded.append({"url": url, "path": out_path, "skipped": True})
                    _log(f"[HAVE] {idx_item}/{len(items)} {out_path}", quiet=args.quiet)
                    continue

                _log(f"[DL]   {idx_item}/{len(items)} {url} -> {out_path}", quiet=args.quiet)
                status, data, headers = download_one(
                    url=url,
                    timeout_s=args.timeout,
                    max_retries=args.max_retries,
                    backoff_base_s=args.backoff_base,
                    backoff_jitter_s=args.backoff_jitter,
                )
                if not (200 <= status < 300):
                    total_errors += 1
                    downloaded.append(
                        {
                            "url": url,
                            "path": out_path,
                            "ok": False,
                            "http_status": status,
                            "headers": headers,
                            "bytes": len(data),
                        }
                    )
                    _log(
                        f"[FAIL] {idx_item}/{len(items)} download http={status} bytes={len(data)}",
                        quiet=args.quiet,
                    )
                    continue

                with open(out_path, "wb") as f:
                    f.write(data)

                sha256 = hashlib.sha256(data).hexdigest()
                downloaded.append(
                    {
                        "url": url,
                        "path": out_path,
                        "ok": True,
                        "http_status": status,
                        "bytes": len(data),
                        "sha256": sha256,
                    }
                )
                total_downloaded += 1
                _log(f"[OK]   {idx_item}/{len(items)} saved bytes={len(data)} sha256={sha256[:10]}...", quiet=args.quiet)

            item["result"] = {
                "fetched_at": _utc_now_iso(),
                "ok": bool(last_fetch.get("ok")),
                "http_status": last_fetch.get("http_status"),
                "response": last_resp,
                "downloaded": downloaded,
            }
            changed = True
            run["updated_at"] = _utc_now_iso()
            _atomic_write_json(in_path, run)
            _log(f"[DONE] {idx_item}/{len(items)} request_id={request_id} downloads={len(downloaded)}", quiet=args.quiet)

            if args.sleep > 0:
                time.sleep(args.sleep)

        if changed:
            _atomic_write_json(in_path, run)

    print(
        f"Done. downloaded_files={total_downloaded} pending={total_pending} errors={total_errors}"
    )
    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
