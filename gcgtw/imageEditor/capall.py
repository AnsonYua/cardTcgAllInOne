"""
Scan existing run JSON files under `./302/` and re-process any items that do not
have downloaded output images yet, using `alibaba_api.py` (302.ai Aliyun endpoint).

This is useful for "not ready" items where downloads failed or outputs are missing.

Safety
------
This tool refuses prompts that ask for watermark removal.

Examples
--------
Dry-run: list missing outputs only:
  python3 capall.py --text "increase contrast slightly" --dry-run

Process all missing outputs in 302/*.json:
  API_302_TOKEN=... python3 capall.py --text "increase contrast slightly"

Limit work:
  API_302_TOKEN=... python3 capall.py --text "increase contrast slightly" --limit 10
"""

from __future__ import annotations

import argparse
import datetime as dt
import glob
import hashlib
import json
import os
import random
import sys
import time
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import alibaba_api


def _utc_now_iso() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def _log(msg: str, *, quiet: bool) -> None:
    if not quiet:
        print(msg, flush=True)


def _atomic_write_json(path: str, payload: Any) -> None:
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp_path, path)


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _sleep_backoff(attempt: int, base: float, jitter: float) -> None:
    delay = base * (2**attempt) + random.random() * jitter
    time.sleep(delay)


def _is_alibaba_run(run: Dict[str, Any]) -> bool:
    # alibaba_api.py writes: endpoint + model + parameters
    return isinstance(run.get("endpoint"), str) and "multimodal-generation" in run.get(
        "endpoint", ""
    )


def _downloaded_paths(item: Dict[str, Any]) -> List[str]:
    # Alibaba format: item["downloaded"] = [{path,...}]
    downloaded = item.get("downloaded")
    if isinstance(downloaded, list):
        out: List[str] = []
        for d in downloaded:
            if isinstance(d, dict) and isinstance(d.get("path"), str):
                out.append(d["path"])
        return out

    # 302_dlImage format: item["result"]["downloaded"] = [{path,...}]
    result = item.get("result")
    if isinstance(result, dict) and isinstance(result.get("downloaded"), list):
        out = []
        for d in result["downloaded"]:
            if isinstance(d, dict) and isinstance(d.get("path"), str):
                out.append(d["path"])
        return out

    # capall fallback (we add): item["alibaba_fallback"]["downloaded"]
    fallback = item.get("alibaba_fallback")
    if isinstance(fallback, dict) and isinstance(fallback.get("downloaded"), list):
        out = []
        for d in fallback["downloaded"]:
            if isinstance(d, dict) and isinstance(d.get("path"), str):
                out.append(d["path"])
        return out

    return []


def _has_downloaded_output(item: Dict[str, Any]) -> bool:
    for path in _downloaded_paths(item):
        if os.path.exists(path):
            return True
    return False


def _basename_from_input_image_url(image_url: str) -> str:
    last = image_url.rsplit("/", 1)[-1]
    last = last.split("?", 1)[0]
    if "." in last:
        last = last.rsplit(".", 1)[0]
    return last or "image"


def _guess_ext_from_url(url: str, fallback: str = "png") -> str:
    # same as alibaba_api._guess_ext_from_url but duplicated to avoid reliance on privates
    from urllib.parse import urlparse

    path = urlparse(url).path
    last = path.rsplit("/", 1)[-1]
    if "." in last:
        ext = last.rsplit(".", 1)[-1].lower()
        if ext:
            return ext
    return fallback


def _extract_output_image_urls(response: Dict[str, Any]) -> List[str]:
    return alibaba_api._extract_output_image_urls(response)  # reuse tested parser


def _download_one(
    *,
    url: str,
    out_path: str,
    timeout_s: float,
    max_retries: int,
    backoff_base_s: float,
    backoff_jitter_s: float,
) -> Dict[str, Any]:
    if os.path.exists(out_path):
        return {"url": url, "path": out_path, "skipped": True}

    last: Tuple[int, bytes, Dict[str, str]] = (0, b"", {})
    for attempt in range(max_retries + 1):
        status, data, headers = alibaba_api.download_one(
            url=url,
            timeout_s=timeout_s,
            max_retries=0,  # capall handles retries here
            backoff_base_s=0.0,
            backoff_jitter_s=0.0,
        )
        last = (status, data, headers)
        if 200 <= status < 300:
            _ensure_dir(os.path.dirname(out_path))
            with open(out_path, "wb") as f:
                f.write(data)
            return {
                "url": url,
                "path": out_path,
                "ok": True,
                "http_status": status,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }

        if status in {0, 408, 429} or 500 <= status <= 599:
            if attempt < max_retries:
                _sleep_backoff(attempt, backoff_base_s, backoff_jitter_s)
                continue

        return {
            "url": url,
            "path": out_path,
            "ok": False,
            "http_status": status,
            "headers": headers,
            "bytes": len(last[1]),
        }

    status, data, headers = last
    return {
        "url": url,
        "path": out_path,
        "ok": False,
        "http_status": status,
        "headers": headers,
        "bytes": len(data),
    }


def _process_item_with_alibaba(
    *,
    token: str,
    image_url: str,
    text: str,
    model: str,
    n: int,
    size: str,
    negative_prompt: str,
    prompt_extend: bool,
    watermark: bool,
    images_dir: str,
    timeout_s: float,
    max_retries: int,
    backoff_base_s: float,
    backoff_jitter_s: float,
) -> Dict[str, Any]:
    result = alibaba_api.submit_one(
        token=token,
        image_url=image_url,
        text=text,
        model=model,
        n=n,
        size=size,
        negative_prompt=negative_prompt,
        prompt_extend=prompt_extend,
        watermark=watermark,
        timeout_s=timeout_s,
        max_retries=max_retries,
        backoff_base_s=backoff_base_s,
        backoff_jitter_s=backoff_jitter_s,
    )
    response = result.get("response") or {}

    out_urls = _extract_output_image_urls(response) if result.get("ok") else []
    base = _basename_from_input_image_url(image_url)
    downloaded: List[Dict[str, Any]] = []

    for idx, out_url in enumerate(out_urls):
        ext = _guess_ext_from_url(out_url, fallback="png")
        suffix = "" if idx == 0 else f"_{idx+1}"
        out_path = os.path.join(images_dir, f"{base}{suffix}.{ext}")
        downloaded.append(
            _download_one(
                url=out_url,
                out_path=out_path,
                timeout_s=timeout_s,
                max_retries=max_retries,
                backoff_base_s=backoff_base_s,
                backoff_jitter_s=backoff_jitter_s,
            )
        )

    return {
        "submitted_at": _utc_now_iso(),
        "ok": bool(result.get("ok")),
        "http_status": result.get("http_status"),
        "request_id": response.get("request_id"),
        "response": response,
        "downloaded": downloaded,
    }


def _iter_json_files(patterns: Sequence[str]) -> List[str]:
    out: List[str] = []
    for pat in patterns:
        out.extend(glob.glob(pat))
    # stable dedupe
    seen = set()
    unique: List[str] = []
    for p in sorted(out):
        if p not in seen:
            unique.append(p)
            seen.add(p)
    return unique


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--json", action="append", default=["302/*.json"], help="glob; repeatable")

    p.add_argument("--token", help="or set env API_302_TOKEN")
    p.add_argument("--text", required=True, help="instruction text (no watermark removal)")

    p.add_argument("--model", default=alibaba_api.DEFAULT_MODEL)
    p.add_argument("--n", type=int, default=1)
    p.add_argument("--size", default="864*1216")
    p.add_argument("--negative-prompt", default="")
    p.add_argument("--prompt-extend", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--watermark", action=argparse.BooleanOptionalAction, default=False)

    p.add_argument("--timeout", type=float, default=90.0)
    p.add_argument("--max-retries", type=int, default=3)
    p.add_argument("--backoff-base", type=float, default=0.6)
    p.add_argument("--backoff-jitter", type=float, default=0.4)

    p.add_argument("--limit", type=int, default=0, help="process at most N missing items (0=all)")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--quiet", action="store_true")
    p.add_argument("--log-response", action="store_true")

    args = p.parse_args(argv)

    # Safety: refuse watermark removal requests
    ##alibaba_api._reject_watermark_removal(args.text)

    token = alibaba_api._get_token(args.token) if not args.dry_run else "dry-run"

    json_files = _iter_json_files(args.json)
    if not json_files:
        _log("No JSON files matched.", quiet=args.quiet)
        return 0

    missing: List[Tuple[str, int, str]] = []  # (json_path, item_index, image_url)

    for json_path in json_files:
        run = _load_json(json_path)
        items = run.get("items") or []
        if not isinstance(items, list):
            continue
        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            image_url = item.get("image_url")
            if not isinstance(image_url, str) or not image_url:
                continue
            if _has_downloaded_output(item):
                continue
            missing.append((json_path, idx, image_url))

    if not missing:
        _log("No missing outputs found.", quiet=args.quiet)
        return 0

    if args.limit and args.limit > 0:
        missing = missing[: args.limit]

    _log(f"Found {len(missing)} missing outputs.", quiet=args.quiet)
    if args.dry_run:
        for json_path, idx, image_url in missing:
            stem = os.path.splitext(os.path.basename(json_path))[0]
            images_dir = os.path.join(os.path.dirname(json_path), stem)
            _log(f"[MISS] {json_path} item#{idx} -> {image_url} (save into {images_dir}/)", quiet=args.quiet)
        return 0

    processed = 0
    errors = 0

    # Group by json file so we can update in-place safely
    by_file: Dict[str, List[Tuple[int, str]]] = {}
    for json_path, idx, image_url in missing:
        by_file.setdefault(json_path, []).append((idx, image_url))

    for json_path, jobs in by_file.items():
        run = _load_json(json_path)
        items = run.get("items") or []
        if not isinstance(items, list):
            continue

        stem = os.path.splitext(os.path.basename(json_path))[0]
        images_dir = os.path.join(os.path.dirname(json_path), stem)
        _ensure_dir(images_dir)

        _log(f"[FILE] {json_path} missing={len(jobs)} images_dir={images_dir}", quiet=args.quiet)
        is_alibaba = _is_alibaba_run(run)

        for item_index, image_url in jobs:
            if item_index >= len(items) or not isinstance(items[item_index], dict):
                continue
            item = items[item_index]
            assert isinstance(item, dict)

            # another process may have fixed it
            if _has_downloaded_output(item):
                continue

            _log(f"[REQ] {stem} item#{item_index} {image_url}", quiet=args.quiet)
            result = _process_item_with_alibaba(
                token=token,
                image_url=image_url,
                text=args.text,
                model=args.model,
                n=args.n,
                size=args.size,
                negative_prompt=args.negative_prompt,
                prompt_extend=args.prompt_extend,
                watermark=args.watermark,
                images_dir=images_dir,
                timeout_s=args.timeout,
                max_retries=args.max_retries,
                backoff_base_s=args.backoff_base,
                backoff_jitter_s=args.backoff_jitter,
            )

            processed += 1
            ok = bool(result.get("ok"))
            request_id = result.get("request_id")
            downloaded = result.get("downloaded") if isinstance(result.get("downloaded"), list) else []
            files_ok = sum(1 for d in downloaded if isinstance(d, dict) and d.get("ok") is True)

            _log(
                f"[RESP] ok={ok} http={result.get('http_status')} request_id={request_id} downloads_ok={files_ok}/{len(downloaded)}",
                quiet=args.quiet,
            )
            if args.log_response:
                _log(f"[RESP_JSON] {alibaba_api._short_json(result.get('response'))}", quiet=args.quiet)

            if is_alibaba:
                # Match alibaba_api.py format
                item["ok"] = result.get("ok")
                item["http_status"] = result.get("http_status")
                item["request_id"] = result.get("request_id")
                item["response"] = result.get("response")
                item["downloaded"] = result.get("downloaded")
                item["fixed_at"] = _utc_now_iso()
            else:
                # Preserve 302_api / 302_dlImage fields; attach as fallback
                item["alibaba_fallback"] = result
                item["fixed_at"] = _utc_now_iso()

            if not ok or files_ok == 0:
                errors += 1

            run["items"] = items
            run["updated_at"] = _utc_now_iso()
            _atomic_write_json(json_path, run)

    _log(f"Done. processed={processed} errors={errors}", quiet=args.quiet)
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

