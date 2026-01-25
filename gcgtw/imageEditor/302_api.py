"""
Submit batches of card images to 302.ai's `qwen-image-edit-plus` endpoint and
save each response `request_id` to a JSON file under `./302/`.

Examples
--------
Submit ST01-001..016:
    python3 302_api.py --param-a ST01 --b-start 1 --b-end 16 --out-name ST01.json

Submit a custom list:
    python3 302_api.py --image-url https://.../ST01-001.webp --image-url https://.../ST01-002.webp --out-name custom.json

Auth
----
Provide a token via `--token` or env var `API_302_TOKEN` (preferred).



API_302_TOKEN=sk-bmNvnq1tleywOOjOhYZyDfyuAbJ77BGjLsLxVkeTT4bAFh0R python3 302_api.py --param-a ST05 --b-start 1 --b-end 16 --out-name ST05.json

"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import os
import random
import sys
import time
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


ENDPOINT = "https://api.302.ai/302/submit/qwen-image-edit-plus"
DEFAULT_URL_TEMPLATE = "https://www.gundam-gcg.com/en/images/cards/card/{paramA}-{paramB}.webp"


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
    out: List[str] = []
    for param_b in param_b_values:
        out.append(url_template.format(paramA=param_a, paramB=param_b))
    return out


def _load_image_urls_from_file(path: str) -> List[str]:
    urls: List[str] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            urls.append(s)
    return urls


def _get_token(cli_token: Optional[str]) -> str:
    token = cli_token or os.getenv("API_302_TOKEN") or os.getenv("AI302_TOKEN")
    if not token:
        raise SystemExit(
            "Missing token. Provide `--token ...` or set env `API_302_TOKEN`."
        )
    return token.strip()


def _sleep_backoff(attempt: int, base: float, jitter: float) -> None:
    # exponential backoff with jitter: base * 2^attempt + U(0, jitter)
    delay = base * (2**attempt) + random.random() * jitter
    time.sleep(delay)


def _http_post_json(
    *,
    url: str,
    headers: Dict[str, str],
    payload: Dict[str, Any],
    timeout_s: float,
) -> Tuple[int, Dict[str, Any]]:
    """
    Post JSON and return (status_code, parsed_json).
    Uses `requests` if available, otherwise falls back to stdlib `urllib`.
    """
    try:
        import requests  # type: ignore

        resp = requests.post(url, headers=headers, json=payload, timeout=timeout_s)
        status = int(resp.status_code)
        try:
            data = resp.json()
        except Exception:
            data = {"raw_text": resp.text}
        return status, data
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
        except urllib.error.HTTPError as e:  # has response body
            raw = e.read().decode("utf-8", errors="replace")
            try:
                data = json.loads(raw)
            except Exception:
                data = {"raw_text": raw}
            return int(e.code), data


@dataclasses.dataclass(frozen=True)
class SubmitConfig:
    prompt: str
    negative_prompt: str
    width: int
    height: int
    num_inference_steps: int
    guidance_scale: float
    output_format: str


def submit_one(
    *,
    token: str,
    image_url: str,
    cfg: SubmitConfig,
    timeout_s: float,
    max_retries: int,
    backoff_base_s: float,
    backoff_jitter_s: float,
) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload: Dict[str, Any] = {
        "prompt": cfg.prompt,
        "image_urls": [image_url],
        "image_size": {"width": cfg.width, "height": cfg.height},
        "num_inference_steps": cfg.num_inference_steps,
        "guidance_scale": cfg.guidance_scale,
        "output_format": cfg.output_format,
        "negative_prompt": cfg.negative_prompt,
    }

    last_status: Optional[int] = None
    last_data: Optional[Dict[str, Any]] = None

    for attempt in range(max_retries + 1):
        status, data = _http_post_json(
            url=ENDPOINT, headers=headers, payload=payload, timeout_s=timeout_s
        )
        last_status, last_data = status, data

        if 200 <= status < 300:
            return {
                "ok": True,
                "http_status": status,
                "response": data,
            }

        # Retry on common transient failures
        if status in {408, 429} or 500 <= status <= 599:
            if attempt < max_retries:
                _sleep_backoff(attempt, backoff_base_s, backoff_jitter_s)
                continue

        return {
            "ok": False,
            "http_status": status,
            "response": data,
        }

    return {
        "ok": False,
        "http_status": last_status,
        "response": last_data,
    }


def _existing_request_ids(existing: Optional[Dict[str, Any]]) -> Dict[str, str]:
    if not existing:
        return {}
    out: Dict[str, str] = {}
    for item in existing.get("items", []) or []:
        if not isinstance(item, dict):
            continue
        image_url = item.get("image_url")
        request_id = item.get("request_id")
        if isinstance(image_url, str) and isinstance(request_id, str) and request_id:
            out[image_url] = request_id
    return out


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser()

    # URL generation
    p.add_argument("--url-template", default=DEFAULT_URL_TEMPLATE)
    p.add_argument("--param-a", help="e.g. ST01")
    p.add_argument("--b-start", type=int)
    p.add_argument("--b-end", type=int)
    p.add_argument("--b-width", type=int, default=3)
    p.add_argument("--b-values", help="comma-separated explicit paramB values (e.g. 001,002,016)")

    p.add_argument("--image-url", action="append", default=[], help="repeatable")
    p.add_argument("--image-url-file", help="text file with one URL per line")

    # API auth + behavior
    p.add_argument("--token", help="or set env API_302_TOKEN")
    p.add_argument("--sleep", type=float, default=0.0, help="seconds between submissions")
    p.add_argument("--timeout", type=float, default=60.0)
    p.add_argument("--max-retries", type=int, default=3)
    p.add_argument("--backoff-base", type=float, default=0.6)
    p.add_argument("--backoff-jitter", type=float, default=0.4)
    p.add_argument("--dry-run", action="store_true", help="do not call the API")
    p.add_argument(
        "--resume",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="skip URLs already in output file (default: true)",
    )

    # Request body knobs
    p.add_argument(
        "--prompt",
        default="remove the watermark SAMPLE in the image",
    )
    p.add_argument("--negative-prompt", default="blurry, ugly")
    p.add_argument("--width", type=int, default=600)
    p.add_argument("--height", type=int, default=838)
    p.add_argument("--num-inference-steps", type=int, default=30)
    p.add_argument("--guidance-scale", type=float, default=4.0)
    p.add_argument("--output-format", default="png")

    # Output
    p.add_argument("--out-dir", default="302")
    p.add_argument(
        "--out-name",
        help="e.g. ST01.json (saved under --out-dir). Defaults to {paramA}.json if --param-a is set.",
    )

    args = p.parse_args(argv)

    token = _get_token(args.token) if not args.dry_run else "dry-run"

    image_urls = list(args.image_url)
    if args.image_url_file:
        image_urls.extend(_load_image_urls_from_file(args.image_url_file))

    if image_urls:
        urls = list(dict.fromkeys(image_urls))  # stable dedupe
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

    out_name = args.out_name or (f"{args.param_a}.json" if args.param_a else None)
    if not out_name:
        print("Missing --out-name (or provide --param-a so it can default).", file=sys.stderr)
        return 2

    _ensure_dir(args.out_dir)
    out_path = os.path.join(args.out_dir, out_name)

    existing = _load_json_if_exists(out_path) if args.resume else None
    already = _existing_request_ids(existing)

    cfg = SubmitConfig(
        prompt=args.prompt,
        negative_prompt=args.negative_prompt,
        width=args.width,
        height=args.height,
        num_inference_steps=args.num_inference_steps,
        guidance_scale=args.guidance_scale,
        output_format=args.output_format,
    )

    run: Dict[str, Any] = existing or {
        "created_at": _utc_now_iso(),
        "endpoint": ENDPOINT,
        "config": dataclasses.asdict(cfg),
        "items": [],
    }
    if "updated_at" not in run:
        run["updated_at"] = _utc_now_iso()

    items: List[Dict[str, Any]] = run.get("items") or []

    submitted = 0
    skipped = 0
    for image_url in urls:
        if args.resume and image_url in already:
            skipped += 1
            continue

        if args.dry_run:
            item = {
                "image_url": image_url,
                "submitted_at": _utc_now_iso(),
                "request_id": "DRY_RUN",
                "status": "DRY_RUN",
            }
        else:
            result = submit_one(
                token=token,
                image_url=image_url,
                cfg=cfg,
                timeout_s=args.timeout,
                max_retries=args.max_retries,
                backoff_base_s=args.backoff_base,
                backoff_jitter_s=args.backoff_jitter,
            )
            response = result.get("response") or {}
            request_id = response.get("request_id")
            status = response.get("status")

            item = {
                "image_url": image_url,
                "submitted_at": _utc_now_iso(),
                "ok": bool(result.get("ok")),
                "http_status": result.get("http_status"),
                "request_id": request_id,
                "status": status,
                "response": response,
            }

        items.append(item)
        run["items"] = items
        run["updated_at"] = _utc_now_iso()
        _atomic_write_json(out_path, run)

        submitted += 1
        if args.sleep > 0:
            time.sleep(args.sleep)

    print(
        f"Wrote {len(items)} total items to {out_path} (submitted={submitted}, skipped={skipped})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
