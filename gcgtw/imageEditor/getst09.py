import csv
import html
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple


PACKAGE_ID = "616009"
PACKAGE_LABEL = "ST09"
EXPECTED_CARD_COUNT = 26
SLEEP_SEC = 0.2
DEBUG = True

OUTPUT_CSV = (
    Path(__file__).resolve().parents[2]
    / "cardBackend"
    / "requirement"
    / "cardData"
    / "st09_cards.csv"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

FIELDS = [
    "CardName",
    "Code",
    "Level",
    "Cost",
    "Color",
    "Type",
    "Abilities",
    "Zone",
    "Trait",
    "Link",
    "AP/HP",
    "Source Title",
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

FILTERED_INDEX_URL = "https://www.gundam-gcg.com/en/cards/index.php"


def log(message: str) -> None:
    if DEBUG:
        print(message)


def fetch_html(url: str, data: Optional[bytes] = None) -> Optional[str]:
    request = urllib.request.Request(url, data=data, headers=HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read().decode("utf-8", errors="ignore")
        log(f"[GET] {url} len={len(payload)}")
        return payload
    except Exception as exc:
        log(f"[ERR] {url}: {exc}")
        return None


def strip_tags(raw_html: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", raw_html, flags=re.I)
    text = re.sub(r"</?(?:div|p|li|dt|dd|dl|section|article|main|h1|h2|h3|tr|td|th)[^>]*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def normalize_code_list(raw_codes: Sequence[str]) -> List[str]:
    deduped: List[str] = []
    seen = set()
    for code in raw_codes:
        base_code = code.split("_")[0]
        if base_code in seen:
            continue
        seen.add(base_code)
        deduped.append(base_code)
    return deduped


def extract_codes_from_filtered_page(document: str) -> List[str]:
    matches = re.findall(r"detailSearch=([A-Z0-9-]+(?:_p\d+)?)", document)
    return normalize_code_list(matches)


def gather_codes_for_package(package_id: str) -> List[str]:
    payload = urllib.parse.urlencode({"package": package_id}).encode("utf-8")
    document = fetch_html(FILTERED_INDEX_URL, data=payload)
    if not document:
        return []

    count_match = re.search(r'<span class="num">(\d+)</span>\s*cards found\.', document, flags=re.I)
    if count_match:
        log(f"[INDEX] reported cards found: {count_match.group(1)}")

    deduped = extract_codes_from_filtered_page(document)
    log(f"[DONE] unique package codes collected: {len(deduped)}")
    return deduped


def parse_data_boxes(document: str) -> List[Tuple[str, str]]:
    pairs = re.findall(
        r'<dt[^>]*class="dataTit"[^>]*>(.*?)</dt>\s*<dd[^>]*class="dataTxt"[^>]*>(.*?)</dd>',
        document,
        flags=re.I | re.S,
    )
    return [(strip_tags(label), strip_tags(value)) for label, value in pairs]


def extract_abilities(document: str, pairs: Sequence[Tuple[str, str]]) -> str:
    for label, value in pairs:
        if label.lower() == "abilities":
            return value

    text = strip_tags(document)
    match = re.search(r"\bTYPE\b\s*\n.*?\n(.*?)\n\bZone\b\s*\n", text, flags=re.I | re.S)
    if not match:
        return ""
    return match.group(1).strip()


def parse_detail_page(code: str) -> Optional[Dict[str, str]]:
    url = f"https://www.gundam-gcg.com/en/cards/detail.php?detailSearch={code}"
    document = fetch_html(url)
    if not document:
        return None

    page_text = strip_tags(document).lower()
    if "privacy preference center" in page_text or "onetrust" in page_text:
        log(f"[WARN] Cookie wall detected for {code}")
        return None

    row: Dict[str, str] = {field: "" for field in FIELDS}
    row["Code"] = code

    name_match = re.search(r'<h1[^>]*class="cardName"[^>]*>(.*?)</h1>', document, flags=re.I | re.S)
    if name_match:
        row["CardName"] = strip_tags(name_match.group(1))

    code_match = re.search(r'<div[^>]*class="cardNo"[^>]*>(.*?)</div>', document, flags=re.I | re.S)
    if code_match:
        row["Code"] = strip_tags(code_match.group(1))

    pairs = parse_data_boxes(document)
    ap_val = ""
    hp_val = ""
    for label, value in pairs:
        key = DT_MAPPING.get(label)
        if key == "AP":
            ap_val = value
        elif key == "HP":
            hp_val = value
        elif key in row:
            row[key] = value

    row["AP/HP"] = f"{ap_val}/{hp_val}".strip("/")

    abilities = re.sub(r"\s+", " ", extract_abilities(document, pairs)).strip()
    row["Abilities"] = abilities if abilities else "-"

    if not row["CardName"] or not row["Type"]:
        log(f"[WARN] Parsed weak data for {code}: name='{row['CardName']}' type='{row['Type']}'")
        return None

    return row


def main() -> None:
    codes = gather_codes_for_package(PACKAGE_ID)
    if not codes:
        raise SystemExit(f"No package cards found for package {PACKAGE_ID}")

    cards: List[Dict[str, str]] = []
    for index, code in enumerate(codes, start=1):
        log(f"[{index}/{len(codes)}] Fetch detail {code}")
        card = parse_detail_page(code)
        if card:
            cards.append(card)
        time.sleep(SLEEP_SEC)

    if not cards:
        raise SystemExit(f"No {PACKAGE_LABEL} package card detail pages were parsed successfully")

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(cards)

    if len(cards) != EXPECTED_CARD_COUNT:
        log(f"[WARN] Expected {EXPECTED_CARD_COUNT} cards for {PACKAGE_LABEL}, scraped {len(cards)}")

    print(f"✅ Wrote {len(cards)} cards to {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
