"""
Call 302.ai's Aliyun-compatible multimodal generation endpoint and download output images.

Endpoint
--------
POST https://api.302.ai/aliyun/api/v1/services/aigc/multimodal-generation/generation

Auth
----
Provide a token via `--token` or env var `API_302_TOKEN` (preferred).

Examples
--------
Run one image:
  API_302_TOKEN=... python3 alibaba_api.py --image-url https://.../GD02-001.webp --text "make the colors more vibrant" --out-name GD02.json

Run a range:
  API_302_TOKEN=... python3 alibaba_api.py --param-a GD02 --b-start 1 --b-end 10 --text "increase sharpness slightly" --out-name GD02.json

  API_302_TOKEN=sk-bmNvnq1tleywOOjOhYZyDfyuAbJ77BGjLsLxVkeTT4bAFh0R python3 alibaba_api.py --param-a GD02 --b-start 1 --b-end 16 --text "remove watermark SAMPLE in the image" --out-name 302/GD02.json --images-dir 302/GD02


  API_302_TOKEN=sk-bmNvnq1tleywOOjOhYZyDfyuAbJ77BGjLsLxVkeTT4bAFh0R python3 alibaba_api.py --local-dir 302/ST01-backup --param-a ST01 --b-start 1 --b-end 16 --text "remove the text card effect and label below the title " --out-name ST01.json
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import random
import sys
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import urlparse

ENDPOINT = "https://api.302.ai/aliyun/api/v1/services/aigc/multimodal-generation/generation"
DEFAULT_MODEL = "qwen-image-edit-plus-2025-12-15"
DEFAULT_URL_TEMPLATE = "https://www.gundam-gcg.com/en/images/cards/card/{paramA}-{paramB}.webp"
DEFAULT_LOCAL_EXTS = ["png", "jpg", "jpeg", "webp"]


def _utc_now_iso() -> str:
    return dt.datetime.now(dt.UTC).isoformat()


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _atomic_write_json(path: str, payload: Any) -> None:
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp_path, path)


def _load_json_if_exists(path: str) -> Optional[Dict[str, Any]]:
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


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


def _parse_csv(s: str) -> List[str]:
    return [part.strip() for part in s.split(",") if part.strip()]


def _build_param_b_values(
    *,
    b_start: Optional[int],
    b_end: Optional[int],
    b_width: int,
    b_values: Optional[Sequence[str]],
) -> List[str]:
    if b_values:
        return list(b_values)
    if b_start is None or b_end is None:
        raise ValueError("Provide either --b-values or both --b-start and --b-end")
    if b_end < b_start:
        raise ValueError("--b-end must be >= --b-start")
    return [f"{n:0{b_width}d}" for n in range(b_start, b_end + 1)]


def _load_image_urls_from_file(path: str) -> List[str]:
    urls: List[str] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            urls.append(s)
    return urls


def _build_image_urls(
    *,
    url_template: str,
    param_a: Optional[str],
    param_b_values: Sequence[str],
    image_urls: Sequence[str],
) -> List[str]:
    if image_urls:
        return list(dict.fromkeys(image_urls))  # stable dedupe
    if not param_a:
        raise ValueError("Provide either --image-url/--image-url-file or --param-a")
    return [url_template.format(paramA=param_a, paramB=param_b) for param_b in param_b_values]


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


def _http_post_json(
    *,
    url: str,
    headers: Dict[str, str],
    payload: Dict[str, Any],
    timeout_s: float,
) -> Tuple[int, Dict[str, Any]]:
    try:
        import requests  # type: ignore

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=timeout_s)
            status = int(resp.status_code)
            try:
                data = resp.json()
            except Exception:
                data = {"raw_text": resp.text}
            return status, data
        except requests.RequestException as e:
            return 0, {"error": f"{type(e).__name__}: {e}"}
    except ImportError:
        import urllib.error
        import urllib.request

        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
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
    timeout_s: float,
) -> Tuple[int, bytes, Dict[str, str]]:
    try:
        import requests  # type: ignore

        try:
            resp = requests.get(url, timeout=timeout_s)
            return int(resp.status_code), resp.content, dict(resp.headers)
        except requests.RequestException as e:
            return 0, b"", {"error": f"{type(e).__name__}: {e}"}
    except ImportError:
        import urllib.error
        import urllib.request

        req = urllib.request.Request(url, method="GET")
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


def _guess_ext_from_url(url: str, fallback: str = "png") -> str:
    path = urlparse(url).path
    last = path.rsplit("/", 1)[-1]
    if "." in last:
        ext = last.rsplit(".", 1)[-1].lower()
        if ext:
            return ext
    return fallback


def _basename_from_input_ref(image_ref: str) -> str:
    if os.path.exists(image_ref):
        last = os.path.basename(image_ref)
        if "." in last:
            last = last.rsplit(".", 1)[0]
        return last or "image"

    last = image_ref.rsplit("/", 1)[-1]
    last = last.split("?", 1)[0]
    if "." in last:
        last = last.rsplit(".", 1)[0]
    return last or "image"


def _already_downloaded(item: Dict[str, Any]) -> bool:
    downloaded = item.get("downloaded")
    if not isinstance(downloaded, list) or not downloaded:
        return False
    for d in downloaded:
        if isinstance(d, dict) and isinstance(d.get("path"), str) and os.path.exists(d["path"]):
            return True
    return False


def _extract_output_image_urls(response: Dict[str, Any]) -> List[str]:
    """
    Expected shape:
      response.output.choices[0].message.content = [{"image": "..."}]
    """
    out: List[str] = []
    output = response.get("output")
    if not isinstance(output, dict):
        return out
    choices = output.get("choices")
    if not isinstance(choices, list) or not choices:
        return out
    choice0 = choices[0]
    if not isinstance(choice0, dict):
        return out
    message = choice0.get("message")
    if not isinstance(message, dict):
        return out
    content = message.get("content")
    if not isinstance(content, list):
        return out
    for c in content:
        if isinstance(c, dict) and isinstance(c.get("image"), str) and c["image"]:
            out.append(c["image"])
    return out


def _reject_watermark_removal(text: str) -> None:
    lowered = text.lower()
    if "watermark" in lowered or "水印" in text:
        raise SystemExit(
            "Refusing to help with watermark removal. Provide a prompt that does not request removing watermarks."
        )


def _is_http_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")


def _mime_from_ext(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".png":
        return "image/png"
    if ext in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if ext == ".webp":
        return "image/webp"
    # default: works for most cases
    return "application/octet-stream"


def _image_value_from_ref(image_ref: str) -> str:
    """
    Return value for the request JSON `content[].image`.
    - If it's an http(s) URL, return as-is.
    - If it's a local file path, encode as data URI: data:<mime>;base64,<...>
    """
    if _is_http_url(image_ref):
        return image_ref

    if not os.path.exists(image_ref):
        raise FileNotFoundError(image_ref)

    mime = _mime_from_ext(image_ref)
    with open(image_ref, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _parse_exts_csv(s: str) -> List[str]:
    parts = [p.strip().lstrip(".").lower() for p in s.split(",") if p.strip()]
    return [p for p in parts if p]


def _resolve_local_paths(
    *,
    local_dir: str,
    bases: Sequence[str],
    exts: Sequence[str],
) -> Tuple[List[str], List[str]]:
    """
    For each base like 'ST01-001', find the first file existing in local_dir with allowed exts.
    Returns (paths, missing_bases).
    """
    paths: List[str] = []
    missing: List[str] = []
    for base in bases:
        found = None
        for ext in exts:
            cand = os.path.join(local_dir, f"{base}.{ext}")
            if os.path.exists(cand):
                found = cand
                break
        if found:
            paths.append(found)
        else:
            missing.append(base)
    return paths, missing


def submit_one(
    *,
    token: str,
    image_ref: str,
    text: str,
    model: str,
    n: int,
    size: str,
    negative_prompt: str,
    prompt_extend: bool,
    watermark: bool,
    timeout_s: float,
    max_retries: int,
    backoff_base_s: float,
    backoff_jitter_s: float,
) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    image_value = _image_value_from_ref(image_ref)
    payload: Dict[str, Any] = {
        "model": model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"image": image_value},
                        {"text": text},
                    ],
                }
            ]
        },
        "parameters": {
            "n": n,
            "size": size,
            "negative_prompt": negative_prompt,
            "prompt_extend": prompt_extend,
            "watermark": watermark,
        },
    }

    last_status: Optional[int] = None
    last_data: Optional[Dict[str, Any]] = None

    for attempt in range(max_retries + 1):
        status, data = _http_post_json(
            url=ENDPOINT, headers=headers, payload=payload, timeout_s=timeout_s
        )
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
        status, data, headers = _http_download_bytes(url=url, timeout_s=timeout_s)
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

    # URL generation (same shape as 302_api.py)
    p.add_argument("--url-template", default=DEFAULT_URL_TEMPLATE)
    p.add_argument("--param-a", help="e.g. GD02 or ST01")
    p.add_argument("--b-start", type=int)
    p.add_argument("--b-end", type=int)
    p.add_argument("--b-width", type=int, default=3)
    p.add_argument("--b-values", help="comma-separated explicit paramB values (e.g. 001,002,016)")
    p.add_argument("--image-url", action="append", default=[], help="repeatable")
    p.add_argument("--image-url-file", help="text file with one URL per line")
    p.add_argument(
        "--local-dir",
        help="If set, read images from this local folder instead of using remote URLs (expects files like ST01-001.png).",
    )
    p.add_argument(
        "--local-exts",
        default="png,jpg,jpeg,webp",
        help="comma-separated extensions to try when --local-dir is used (default: png,jpg,jpeg,webp)",
    )

    # API auth + behavior
    p.add_argument("--token", help="or set env API_302_TOKEN")
    p.add_argument("--timeout", type=float, default=90.0)
    p.add_argument("--max-retries", type=int, default=3)
    p.add_argument("--backoff-base", type=float, default=0.6)
    p.add_argument("--backoff-jitter", type=float, default=0.4)
    p.add_argument("--sleep", type=float, default=0.0, help="seconds between submissions")
    p.add_argument("--dry-run", action="store_true", help="do not call the API or download")
    p.add_argument("--quiet", action="store_true", help="suppress logs")
    p.add_argument("--log-response", action="store_true", help="print compact response JSON")
    p.add_argument(
        "--resume",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="skip items already downloaded (default: true)",
    )

    # Request body
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--text", required=True, help="instruction text (no watermark removal)")
    p.add_argument("--n", type=int, default=1)
    p.add_argument("--size", default="864*1216")
    p.add_argument("--negative-prompt", default="")
    p.add_argument("--prompt-extend", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--watermark", action=argparse.BooleanOptionalAction, default=False)

    # Output
    p.add_argument("--out-dir", default="302")
    p.add_argument(
        "--out-name",
        help="e.g. ST05.json (saved under --out-dir). Defaults to {paramA}.json if --param-a is set.",
    )
    p.add_argument(
        "--images-dir",
        help="where to save downloaded images; default: <out-dir>/<out-name-stem>/",
    )

    args = p.parse_args(argv)

    #_reject_watermark_removal(args.text)

    token = _get_token(args.token) if not args.dry_run else "dry-run"

    image_urls = list(args.image_url)
    if args.image_url_file:
        image_urls.extend(_load_image_urls_from_file(args.image_url_file))

    if image_urls:
        # Can be actual URLs OR local paths when --local-dir is set.
        refs = list(dict.fromkeys(image_urls))
        if args.local_dir:
            resolved: List[str] = []
            for r in refs:
                if _is_http_url(r) or os.path.isabs(r):
                    resolved.append(r)
                else:
                    resolved.append(os.path.join(args.local_dir, r))
            refs = resolved
    else:
        b_values = _parse_csv(args.b_values) if args.b_values else None
        try:
            param_b_values = _build_param_b_values(
                b_start=args.b_start,
                b_end=args.b_end,
                b_width=args.b_width,
                b_values=b_values,
            )
            urls = _build_image_urls(
                url_template=args.url_template,
                param_a=args.param_a,
                param_b_values=param_b_values,
                image_urls=[],
            )
        except ValueError as e:
            print(f"Argument error: {e}", file=sys.stderr)
            return 2
        refs = urls

    # If local mode, convert generated URLs (or bases) into local paths.
    if args.local_dir and not image_urls:
        local_dir = args.local_dir
        exts = _parse_exts_csv(args.local_exts) or DEFAULT_LOCAL_EXTS
        bases = []
        for r in refs:
            if os.path.exists(r):
                bases.append(os.path.splitext(os.path.basename(r))[0])
            else:
                # URL -> base from URL filename
                bases.append(_basename_from_input_ref(r))
        local_paths, missing = _resolve_local_paths(local_dir=local_dir, bases=bases, exts=exts)
        if missing:
            _log(f"[WARN] missing local files for: {', '.join(missing[:20])}{'...' if len(missing) > 20 else ''}", quiet=args.quiet)
        refs = local_paths

    out_name = args.out_name or (f"{args.param_a}.json" if args.param_a else None)
    if not out_name:
        print("Missing --out-name (or provide --param-a so it can default).", file=sys.stderr)
        return 2

    _ensure_dir(args.out_dir)
    out_path = os.path.join(args.out_dir, out_name)
    out_stem = os.path.splitext(os.path.basename(out_name))[0]
    images_dir = args.images_dir or os.path.join(args.out_dir, out_stem)
    _ensure_dir(images_dir)

    existing = _load_json_if_exists(out_path) if args.resume else None
    items: List[Dict[str, Any]] = []
    if existing and isinstance(existing.get("items"), list):
        items = existing["items"]

    run: Dict[str, Any] = existing or {
        "created_at": _utc_now_iso(),
        "endpoint": ENDPOINT,
        "model": args.model,
        "parameters": {
            "n": args.n,
            "size": args.size,
            "negative_prompt": args.negative_prompt,
            "prompt_extend": args.prompt_extend,
            "watermark": args.watermark,
        },
        "items": items,
    }
    run["updated_at"] = _utc_now_iso()

    submitted = 0
    skipped = 0

    _log(f"[OUT] json={out_path} images_dir={images_dir}", quiet=args.quiet)

    for idx, image_ref in enumerate(refs, start=1):
        existing_item = next(
            (
                it
                for it in items
                if isinstance(it, dict) and it.get("image_url") == image_ref
            ),
            None,
        )
        if args.resume and isinstance(existing_item, dict) and _already_downloaded(existing_item):
            skipped += 1
            _log(f"[SKIP] {idx}/{len(refs)} already downloaded: {image_ref}", quiet=args.quiet)
            continue

        base_name = _basename_from_input_ref(image_ref)
        _log(f"[REQ] {idx}/{len(refs)} image={image_ref}", quiet=args.quiet)

        if args.dry_run:
            item = {
                "image_url": image_ref,
                "submitted_at": _utc_now_iso(),
                "ok": True,
                "http_status": 200,
                "request_id": "DRY_RUN",
                "response": {"output": {"choices": [{"message": {"content": [{"image": "DRY_RUN"}]}}]}},
                "downloaded": [],
            }
            items.append(item)
            run["items"] = items
            run["updated_at"] = _utc_now_iso()
            _atomic_write_json(out_path, run)
            continue

        result = submit_one(
            token=token,
            image_ref=image_ref,
            text=args.text,
            model=args.model,
            n=args.n,
            size=args.size,
            negative_prompt=args.negative_prompt,
            prompt_extend=args.prompt_extend,
            watermark=args.watermark,
            timeout_s=args.timeout,
            max_retries=args.max_retries,
            backoff_base_s=args.backoff_base,
            backoff_jitter_s=args.backoff_jitter,
        )

        response = result.get("response") or {}
        request_id = response.get("request_id")
        _log(
            f"[RESP] {idx}/{len(urls)} http={result.get('http_status')} ok={result.get('ok')} request_id={request_id}",
            quiet=args.quiet,
        )
        if args.log_response:
            _log(f"[RESP_JSON] {_short_json(response)}", quiet=args.quiet)

        output_urls = _extract_output_image_urls(response) if result.get("ok") else []
        downloaded: List[Dict[str, Any]] = []

        for j, out_url in enumerate(output_urls):
            ext = _guess_ext_from_url(out_url, fallback="png")
            suffix = "" if j == 0 else f"_{j+1}"
            out_file = os.path.join(images_dir, f"{base_name}{suffix}.{ext}")

            if os.path.exists(out_file):
                downloaded.append({"url": out_url, "path": out_file, "skipped": True})
                _log(f"[HAVE] {out_file}", quiet=args.quiet)
                continue

            _log(f"[DL]   {out_url} -> {out_file}", quiet=args.quiet)
            status, data, headers = download_one(
                url=out_url,
                timeout_s=args.timeout,
                max_retries=args.max_retries,
                backoff_base_s=args.backoff_base,
                backoff_jitter_s=args.backoff_jitter,
            )
            if not (200 <= status < 300):
                downloaded.append(
                    {
                        "url": out_url,
                        "path": out_file,
                        "ok": False,
                        "http_status": status,
                        "headers": headers,
                        "bytes": len(data),
                    }
                )
                _log(f"[FAIL] download http={status} bytes={len(data)}", quiet=args.quiet)
                continue

            with open(out_file, "wb") as f:
                f.write(data)

            sha256 = hashlib.sha256(data).hexdigest()
            downloaded.append(
                {
                    "url": out_url,
                    "path": out_file,
                    "ok": True,
                    "http_status": status,
                    "bytes": len(data),
                    "sha256": sha256,
                }
            )
            _log(f"[OK]   saved bytes={len(data)} sha256={sha256[:10]}...", quiet=args.quiet)

        item = {
            "image_url": image_ref,
            "submitted_at": _utc_now_iso(),
            "ok": bool(result.get("ok")),
            "http_status": result.get("http_status"),
            "request_id": request_id,
            "response": response,
            "downloaded": downloaded,
        }
        items.append(item)
        run["items"] = items
        run["updated_at"] = _utc_now_iso()
        _atomic_write_json(out_path, run)

        submitted += 1
        if args.sleep > 0:
            time.sleep(args.sleep)

    _log(
        f"Done. wrote={out_path} images_dir={images_dir} submitted={submitted} skipped={skipped} total_items={len(items)}",
        quiet=args.quiet,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
