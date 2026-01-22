import os
import time
import requests
from io import BytesIO

# Optional: WEBP -> JPG conversion
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# -----------------------
# Settings
# -----------------------
OUTPUT_DIR = "st08_images"
START = 1
END = 8                 # keep small while debugging; raise after it works
MAX_ALT = 1
DOWNLOAD_ALT_ARTS = True

SLEEP_SEC = 0.2
DEBUG = True

BASE_URL = "https://www.gundam-gcg.com/en/images/cards/card/"

# Try multiple query strings (some sites require/benefit from cache busters)
QUERY_CANDIDATES = [
    "",                 # try plain URL first
    "?26011601",        # your known working example
    f"?{int(time.time())}",  # dynamic cache buster
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.gundam-gcg.com/en/cards/index.php",
}

# -----------------------
def log(msg: str) -> None:
    if DEBUG:
        print(msg)

def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)

def sniff_response(r: requests.Response) -> str:
    ct = (r.headers.get("content-type") or "").lower()
    head = ""
    try:
        head = r.text[:140].replace("\n", " ").replace("\r", " ")
    except Exception:
        head = "<binary>"
    return f"status={r.status_code} final_url={r.url} ct={ct} head={head!r}"

def looks_like_webp(data: bytes) -> bool:
    # WEBP starts with RIFF....WEBP
    return len(data) >= 12 and data[0:4] == b"RIFF" and data[8:12] == b"WEBP"

def download_bytes(session: requests.Session, url: str) -> bytes | None:
    try:
        r = session.get(url, timeout=30, allow_redirects=True)
        if r.status_code != 200:
            log(f"[FAIL] {url} ({sniff_response(r)})")
            return None

        data = r.content
        ct = (r.headers.get("content-type") or "").lower()

        # accept if server says image/* OR bytes look like webp
        if "image" in ct or looks_like_webp(data):
            log(f"[OK]  {url} (status=200 ct={ct})")
            return data

        log(f"[FAIL] {url} (not an image) ({sniff_response(r)})")
        return None

    except Exception as e:
        log(f"[ERR] {url} -> {e}")
        return None

def save_file(path: str, data: bytes) -> None:
    with open(path, "wb") as f:
        f.write(data)

def webp_to_jpg(webp_path: str, jpg_path: str) -> bool:
    """
    Convert .webp to .jpg using Pillow.
    """
    if not PIL_AVAILABLE:
        log("[SKIP] Pillow not installed; can't convert WEBP -> JPG")
        return False

    try:
        img = Image.open(webp_path)

        # JPG doesn't support alpha; convert safely
        if img.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        else:
            img = img.convert("RGB")

        img.save(jpg_path, "JPEG", quality=95, optimize=True)
        log(f"[JPG] saved {jpg_path}")
        return True
    except Exception as e:
        log(f"[ERR] convert {webp_path} -> {jpg_path}: {e}")
        return False

def download_card(session: requests.Session, code: str) -> bool:
    """
    Download a card WEBP and optionally convert to JPG.
    """
    webp_name = f"{code}.webp"
    jpg_name = f"{code}.jpg"

    webp_path = os.path.join(OUTPUT_DIR, webp_name)
    jpg_path = os.path.join(OUTPUT_DIR, jpg_name)

    # If already have both, skip
    if os.path.exists(webp_path) and (os.path.exists(jpg_path) or not PIL_AVAILABLE):
        log(f"[HAVE] {code}")
        return True

    # Try different query strings
    for q in QUERY_CANDIDATES:
        url = f"{BASE_URL}{webp_name}{q}"
        log(f"[TRY] {url}")

        data = download_bytes(session, url)
        if not data:
            time.sleep(0.05)
            continue

        # Save WEBP
        save_file(webp_path, data)
        log(f"[WEBP] saved {webp_path}")

        # Convert to JPG
        if PIL_AVAILABLE:
            webp_to_jpg(webp_path, jpg_path)

        return True

    log(f"[MISS] {code} (no working URL)")
    return False

def main() -> None:
    ensure_dir(OUTPUT_DIR)

    session = requests.Session()
    session.headers.update(HEADERS)

    # Optional warm-up
    try:
        idx = session.get("https://www.gundam-gcg.com/en/cards/index.php", timeout=30)
        log(f"[INDEX] {sniff_response(idx)}")
    except Exception as e:
        log(f"[INDEX ERR] {e}")

    for n in range(START, END + 1):
        base_code = f"ST08-{n:03d}"
        log(f"\n=== {base_code} ===")
        download_card(session, base_code)
        time.sleep(SLEEP_SEC)

        if DOWNLOAD_ALT_ARTS:
            for p in range(1, MAX_ALT + 1):
                alt_code = f"{base_code}_p{p}"
                log(f"\n--- {alt_code} ---")
                download_card(session, alt_code)
                time.sleep(SLEEP_SEC)

if __name__ == "__main__":
    main()
