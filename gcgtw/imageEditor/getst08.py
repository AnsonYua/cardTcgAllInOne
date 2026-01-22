import csv
import re
import time
import requests
from bs4 import BeautifulSoup
from typing import Dict, Optional, List

OUTPUT_CSV = "st08_cards.csv"
SLEEP_SEC = 0.2
DEBUG = True

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

FIELDS = [
    "CardName", "Code", "Level", "Cost", "Color", "Type",
    "Abilities", "Zone", "Trait", "Link", "AP/HP", "Source Title"
]

DT_MAPPING = {
    "Lv.": "Level",
    "COST": "Cost",
    "COLOR": "Color",
    "TYPE": "Type",
    "Zone": "Zone",
    "Trait": "Trait",
    "Link": "Link",
    "Source Title": "Source Title",
    "AP": "AP",
    "HP": "HP",
}

def log(msg: str) -> None:
    if DEBUG:
        print(msg)

def normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def fetch(session: requests.Session, url: str) -> Optional[str]:
    try:
        r = session.get(url, timeout=30)
        log(f"[GET] {r.status_code} {r.url} len={len(r.text)} ct={r.headers.get('content-type','')}")
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.text
    except Exception as e:
        log(f"[ERR] {url}: {e}")
        return None

def parse_card(session: requests.Session, code: str) -> Optional[Dict[str, str]]:
    url = f"https://www.gundam-gcg.com/en/cards/detail.php?detailSearch={code}"
    html = fetch(session, url)
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text(" ", strip=True).lower()

    # cookie wall detection
    if "privacy preference center" in page_text or "onetrust" in page_text:
        log(f"[WARN] Cookie wall instead of card detail for {code}")
        return None

    out: Dict[str, str] = {k: "" for k in FIELDS}
    out["Code"] = code

    # Name
    h1 = soup.find("h1", class_="cardName")
    if h1:
        out["CardName"] = h1.get_text(strip=True)

    ap_val, hp_val = "", ""

    # Data boxes
    for dl in soup.select("dl.dataBox"):
        dt = dl.select_one("dt.dataTit")
        dd = dl.select_one("dd.dataTxt")
        if not dt or not dd:
            continue
        label = dt.get_text(strip=True)
        value = dd.get_text(" ", strip=True)
        key = DT_MAPPING.get(label)

        if key == "AP":
            ap_val = value
        elif key == "HP":
            hp_val = value
        elif key in out:
            out[key] = value

    out["AP/HP"] = f"{ap_val}/{hp_val}".strip("/")

    # Abilities (robust)
    abilities = ""

    abilities = extract_abilities_fallback(soup)
    out["Abilities"] = re.sub(r"\s+", " ", abilities).strip()

    # If still empty, make it explicit (some cards truly have none)
    if not out["Abilities"]:
        out["Abilities"] = "(none)"


    # prefer in-page code if present
    code_div = soup.find("div", class_="cardNo")
    if code_div:
        out["Code"] = code_div.get_text(strip=True)

    # sanity check: Type must exist for a real card
    if not out["Type"]:
        log(f"[SKIP] {code}: no Type found (not a real card page?)")
        return None

    return out
def extract_abilities_fallback(soup: BeautifulSoup) -> str:
    """
    Extract ability text even when the page doesn't have a labeled 'Abilities' field.
    Strategy:
      1) If there's a dataBox labeled Abilities, use it.
      2) Otherwise, grab the text between TYPE block and Zone label in the main content text.
    """
    # 1) Preferred: labeled Abilities field (if exists)
    for dl in soup.select("dl.dataBox"):
        dt = dl.select_one("dt.dataTit")
        dd = dl.select_one("dd.dataTxt")
        if dt and dd and dt.get_text(strip=True).lower() == "abilities":
            return dd.get_text(" ", strip=True)

    # 2) Fallback: text between TYPE and Zone in the page main text
    main = soup.select_one("main") or soup.body
    if not main:
        return ""

    text = main.get_text("\n", strip=True)

    # normalize weird spacing
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)

    # Many pages render like:
    # Lv.
    # 5
    # COST
    # 3
    # COLOR
    # Red
    # TYPE
    # UNIT
    # <ability text here>
    # Zone
    # Space Earth
    m = re.search(r"\bTYPE\b\s*\n.*?\n(.*?)\n\bZone\b\s*\n", text, flags=re.S)
    if not m:
        return ""

    abil = m.group(1).strip()
    return abil

def main() -> None:
    session = requests.Session()
    session.headers.update(HEADERS)

    cards: List[Dict[str, str]] = []

    # Starter decks usually have 16 unique STxx-001..016
    for n in range(1, 17):
        code = f"ST08-{n:03d}"
        log(f"=== {code} ===")
        card = parse_card(session, code)
        if card:
            cards.append(card)
            log(f"[OK] {code} {card.get('CardName','')}")
        time.sleep(SLEEP_SEC)

    if not cards:
        print("No cards were scraped (likely cookie wall or codes not published yet).")
        return

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(cards)

    print(f"✅ Wrote {len(cards)} cards to {OUTPUT_CSV}")

if __name__ == "__main__":
    main()
