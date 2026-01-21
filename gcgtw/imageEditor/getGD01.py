import csv
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from typing import Optional, Dict, List

# -------------------------------
# Configuration
# -------------------------------

# Package IDs:
# 616101 -> GD01 (Newtype Rising)
# 616102 -> GD02 (Bravery & Pilots)
# 616103 -> GD03 (Steel Requiem)
PACKAGE_ID = "614004"
NUM_PAGES = 10  # Adjust based on the number of pages for the chosen package
OUTPUT_CSV = "st04_cards.csv"

# Decide whether to include the Pack field in the CSV.
INCLUDE_PACK_FIELD = False

# -------------------------------
# Data label mapping
# -------------------------------

DT_MAPPING = {
    "Lv.": "Level",
    "COST": "Cost",
    "COLOR": "Color",
    "TYPE": "Type",
    "Zone": "Zone",
    "Trait": "Trait",
    "Link": "Link",
    "Source Title": "Source Title",
    "Where to get it": "Pack",
    "AP": "AP",
    "HP": "HP",
}

CSV_FIELDS = [
    "CardName", "Code", "Level", "Cost", "Color", "Type",
    "Abilities", "Zone", "Trait", "Link", "AP/HP", "Source Title"
]
if INCLUDE_PACK_FIELD:
    CSV_FIELDS.append("Pack")

# -------------------------------
# Parsing functions
# -------------------------------

def parse_detail_page(url: str) -> Optional[Dict[str, str]]:
    """
    Fetch a card detail page and extract relevant fields.
    Returns a dictionary or None if parsing fails.
    """
    result: Dict[str, str] = {key: "" for key in CSV_FIELDS}
    if INCLUDE_PACK_FIELD:
        result["Pack"] = ""

    try:
        resp = requests.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
        return None

    # Card code
    code_div = soup.find("div", class_="cardNo")
    if code_div:
        result["Code"] = code_div.get_text(strip=True)

    # Card name
    name_h1 = soup.find("h1", class_="cardName")
    if name_h1:
        result["CardName"] = name_h1.get_text(strip=True)

    # Parse data boxes (Level, Cost, etc.)
    for row in soup.find_all("div", class_="cardDataRow"):
        for dl in row.find_all("dl", class_="dataBox"):
            dt = dl.find("dt", class_="dataTit")
            dd = dl.find("dd", class_="dataTxt")
            if dt and dd:
                label = dt.get_text(strip=True)
                value = dd.get_text(" ", strip=True)
                key = DT_MAPPING.get(label)
                if key == "AP":
                    result["AP"] = value
                elif key == "HP":
                    result["HP"] = value
                elif key and key in result:
                    result[key] = value

    # Combine AP and HP
    ap = result.pop("AP", "")
    hp = result.pop("HP", "")
    if ap or hp:
        result["AP/HP"] = f"{ap}/{hp}".strip("/")

    # Extract abilities
    overview = soup.find("div", class_="cardDataRow overview")
    if overview:
        ability_text = overview.get_text(" ", strip=True)
        result["Abilities"] = re.sub(r"\s+", " ", ability_text)

    if not INCLUDE_PACK_FIELD and "Pack" in result:
        result.pop("Pack", None)

    return result

# -------------------------------
# Main scraping loop
# -------------------------------

def scrape_cards(package_id: str, num_pages: int) -> List[Dict[str, str]]:
    visited_codes = set()
    results: List[Dict[str, str]] = []

    for page in range(1, num_pages + 1):
        idx_url = f"https://www.gundam-gcg.com/en/cards/index.php?package={package_id}&page={page}"
        try:
            idx_resp = requests.get(idx_url)
            idx_resp.raise_for_status()
            idx_soup = BeautifulSoup(idx_resp.text, "html.parser")
        except Exception as e:
            print(f"Failed to fetch index page {page}: {e}")
            continue

        for a in idx_soup.find_all("a", attrs={"data-fancybox": "cards"}):
            data_src = a.get("data-src")
            if not data_src:
                continue
            m = re.search(r"detailSearch=(GD\d{2}-\d{3}(?:_p\d+)?)", data_src)
            if not m:
                continue
            full_code = m.group(1)
            base_code = full_code.split("_")[0]
            if base_code in visited_codes:
                continue
            visited_codes.add(base_code)

            detail_url = urljoin("https://www.gundam-gcg.com/en/cards/", data_src)
            card_info = parse_detail_page(detail_url)
            if card_info:
                results.append(card_info)
                print(f"Fetched {base_code}")
            else:
                print(f"Skipped {base_code} due to parse failure")

    return results

# -------------------------------
# Entry point
# -------------------------------

def main() -> None:
    cards = scrape_cards(PACKAGE_ID, NUM_PAGES)
    if not cards:
        print("No cards were scraped.")
        return

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for card in cards:
            writer.writerow(card)

    print(f"Wrote {len(cards)} unique cards to {OUTPUT_CSV}")

if __name__ == "__main__":
    main()
