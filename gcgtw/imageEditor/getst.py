import csv
import re
import time
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Optional, Set

# -------------------------------
# Config
# -------------------------------
PACKAGE_ID = "616007"          # ST07 (Celestial Drive)
NUM_PAGES = 5                 # ST07 shows 32 cards, usually 2 pages; keep 5 for safety
OUTPUT_CSV = "st07_cards.csv"

DEBUG = True
SAVE_HTML = False             # set True to save index/detail HTML files
SLEEP_SEC = 0.2               # small delay to be polite

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

# -------------------------------
# Helpers
# -------------------------------
def log(msg: str) -> None:
    if DEBUG:
        print(msg)

def save_text(path: str, text: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)

def normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

# -------------------------------
# Fetch + Parse
# -------------------------------
def get_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s

def fetch_html(session: requests.Session, url: str) -> Optional[str]:
    try:
        resp = session.get(url, timeout=30)
        log(f"[GET] {resp.status_code} {resp.url} len={len(resp.text)} ct={resp.headers.get('content-type','')}")
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        log(f"[ERR] Fetch failed: {url} -> {e}")
        return None

def extract_codes_from_index_html(html: str) -> List[str]:
    """
    Extract card codes from any *.webp filenames in the page:
    ST07-001.webp, ST07-001_p1.webp, etc.
    """
    # Capture both GDxx and STxx just in case the page includes extras
    # then we can filter by prefix if desired
    codes = re.findall(r"\b((?:GD\d{2}|ST\d{2})-\d{3}(?:_p\d+)?)\.webp\b", html)
    return codes

def parse_detail_page(session: requests.Session, code: str) -> Optional[Dict[str, str]]:
    """
    Fetch detail.php for a card code and parse requested fields.
    """
    url = f"https://www.gundam-gcg.com/en/cards/detail.php?detailSearch={code}"
    html = fetch_html(session, url)
    if not html:
        return None

    if SAVE_HTML:
        save_text(f"detail_{code}.html", html)

    soup = BeautifulSoup(html, "html.parser")

    # Quick detection: if we got cookie wall / consent overlay instead of card data
    low = soup.get_text(" ", strip=True).lower()
    if "privacy preference center" in low or "onetrust" in low:
        log(f"[WARN] Detail page looks like cookie wall for {code}")
        # continue anyway; fields will likely be empty

    out: Dict[str, str] = {k: "" for k in FIELDS}
    out["Code"] = code

    # Name
    h1 = soup.find("h1", class_="cardName")
    if h1:
        out["CardName"] = h1.get_text(strip=True)
    else:
        # fallback: sometimes name appears elsewhere; keep minimal fallback
        title = soup.title.get_text(strip=True) if soup.title else ""
        out["CardName"] = title.replace(" | GUNDAM CARD GAME Official Website", "").strip()

    ap_val = ""
    hp_val = ""

    # Data rows
    for row in soup.find_all("div", class_="cardDataRow"):
        for dl in row.find_all("dl", class_="dataBox"):
            dt = dl.find("dt", class_="dataTit")
            dd = dl.find("dd", class_="dataTxt")
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

    # -------------------------------
    # Extract abilities (robust)
    # -------------------------------

    abilities = ""

    # 1) Most common: a dl where dt is "Abilities"
    for dl in soup.select("dl.dataBox"):
        dt = dl.select_one("dt.dataTit")
        dd = dl.select_one("dd.dataTxt")
        if not dt or not dd:
            continue
        if dt.get_text(strip=True).lower() == "abilities":
            abilities = dd.get_text(" ", strip=True)
            break

    # 2) Fallback: known effect text containers (site varies by template)
    if not abilities:
        for sel in [
            "div.cardText",      # common pattern on similar Bandai sites
            "div.cardEffect",
            "div.cardAbility",
            "div.effectText",
            "p.cardText",
            "p.effectText",
        ]:
            node = soup.select_one(sel)
            if node:
                abilities = node.get_text(" ", strip=True)
                break

    # 3) Last resort: grab any text block near the card image area
    # (kept conservative to avoid dumping the whole page)
    if not abilities:
        main = soup.select_one("main") or soup.body
        if main:
            text = main.get_text("\n", strip=True)
            # Try to locate between "TYPE" and "Zone" sections (often where rules text is)
            m = re.search(r"TYPE\s*\n.*?\n(.*?)\nZone\s*\n", text, flags=re.S)
            if m:
                abilities = m.group(1).strip()

    out["Abilities"] = re.sub(r"\s+", " ", abilities)

    # Some pages show code in a separate div; if present override
    code_div = soup.find("div", class_="cardNo")
    if code_div:
        out["Code"] = code_div.get_text(strip=True)

    # If we failed to get core fields, log a snippet for troubleshooting
    if not out["CardName"] or not out["Type"]:
        snippet = normalize_ws(soup.get_text(" ", strip=True)[:220])
        log(f"[WARN] Parsed weak data for {code}: name='{out['CardName']}', type='{out['Type']}' snippet='{snippet}'")

    return out

# -------------------------------
# Index scraping strategies
# -------------------------------
def gather_codes_for_package(session: requests.Session, package_id: str, num_pages: int) -> List[str]:
    """
    Try multiple URL patterns because the site sometimes changes params.
    """
    url_patterns = [
        # Pattern A (common)
        "https://www.gundam-gcg.com/en/cards/index.php?package={pid}&page={p}",
        # Pattern B (often used for search)
        "https://www.gundam-gcg.com/en/cards/?search=true&package={pid}&page={p}",
        # Pattern C (some deployments use included_in)
        "https://www.gundam-gcg.com/en/cards/index.php?search=true&package={pid}&page={p}",
    ]

    all_codes: List[str] = []

    for p in range(1, num_pages + 1):
        page_codes: List[str] = []
        html_used = None

        for pat in url_patterns:
            url = pat.format(pid=package_id, p=p)
            html = fetch_html(session, url)
            if not html:
                continue

            codes = extract_codes_from_index_html(html)
            # Keep only codes relevant to the selected deck by prefix ST07 or whatever is present
            # If you want to hard-lock to ST07, uncomment:
            # codes = [c for c in codes if c.startswith("ST07-")]

            if DEBUG:
                log(f"[INDEX] pattern hit page={p}, found_codes={len(codes)}")

            # if we see ST07 codes, accept this HTML
            if any(c.startswith("ST07-") for c in codes):
                html_used = html
                page_codes = codes
                break

            # otherwise keep best attempt
            if len(codes) > len(page_codes):
                html_used = html
                page_codes = codes

        if SAVE_HTML and html_used:
            save_text(f"index_page_{p}.html", html_used)

        # Add page codes
        all_codes.extend(page_codes)
        time.sleep(SLEEP_SEC)

    # Dedupe alt-art and duplicates by base code (drop _pX)
    base_seen: Set[str] = set()
    unique_base_codes: List[str] = []

    for c in all_codes:
        base = c.split("_")[0]
        # Prefer only ST07 in this run
        if not base.startswith("ST07-"):
            continue
        if base in base_seen:
            continue
        base_seen.add(base)
        unique_base_codes.append(base)

    log(f"[DONE] unique base codes collected: {len(unique_base_codes)}")
    return unique_base_codes

# -------------------------------
# Main
# -------------------------------
def main() -> None:
    session = get_session()

    codes = gather_codes_for_package(session, PACKAGE_ID, NUM_PAGES)
    if not codes:
        log("❌ No codes found from index pages.")
        log("   Turn SAVE_HTML=True and inspect index_page_1.html for cookie wall or missing .webp codes.")
        return

    cards: List[Dict[str, str]] = []
    for i, code in enumerate(codes, 1):
        log(f"[{i}/{len(codes)}] Fetch detail {code}")
        card = parse_detail_page(session, code)
        if card:
            cards.append(card)
        time.sleep(SLEEP_SEC)

    if not cards:
        print("No cards were scraped.")
        return

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        for c in cards:
            w.writerow(c)

    print(f"✅ Wrote {len(cards)} cards to {OUTPUT_CSV}")

if __name__ == "__main__":
    main()
