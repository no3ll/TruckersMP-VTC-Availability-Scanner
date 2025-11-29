"""
generate_vtcs_json.py
HTML-only TruckersMP VTC scraper.
Collects VTC IDs from the public /vtc?page=N directory pages.

It does NOT call the TruckersMP API (avoids 403 errors).
"""

import json
import re
import time
from typing import List, Set
import requests
from bs4 import BeautifulSoup
from pathlib import Path

BASE_SITE_URL = "https://truckersmp.com"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = PROJECT_ROOT / "vtcs_source.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; VTC-Finder/1.0; +https://truckersmp.com)"
}


def fetch_html(url: str) -> str | None:
    """Fetch a webpage with safe error handling."""
    try:
        print(f"[HTTP] GET {url}")
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            print(f"[HTTP] Status {resp.status_code} for {url}")
            return None
        return resp.text
    except Exception as ex:
        print(f"[HTTP] ERROR fetching {url}: {ex}")
        return None


def scrape_vtc_ids_from_page(page: int) -> List[int]:
    """
    Scrape a /vtc?page=N directory page.
    Matches patterns like:
       /vtc/7265
       /vtc/7265-fox-log-group
    Works even if the link is a full URL (https://truckersmp.com/vtc/7265).
    """
    url = f"{BASE_SITE_URL}/vtc?page={page}"
    print(f"[SCRAPE] Directory page {page}: {url}")

    html = fetch_html(url)
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")

    ids: Set[int] = set()

    # Inspect all anchor tags
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not isinstance(href, str):
            continue

        # FIXED: use search instead of match, works for any URL format
        m = re.search(r"/vtc/(\d+)", href)
        if m:
            try:
                vid_int = int(m.group(1))  # convert safely
                ids.add(vid_int)
            except Exception:
                continue  # skip bad casts

    ids_list = sorted(ids)
    print(f"[SCRAPE] Found {len(ids_list)} VTC ID(s) on page {page}.")
    return ids_list


def scrape_all_vtc_ids(limit_pages: int = 50) -> List[int]:
    """
    Scrape multiple VTC directory pages until no IDs are found.
    """
    all_ids: List[int] = []
    seen: Set[int] = set()

    for page in range(1, limit_pages + 1):
        ids = scrape_vtc_ids_from_page(page)

        if not ids:
            # No IDs found on this page → stop
            print(f"[SCRAPE] No IDs found on page {page}, stopping.")
            break

        # Add only new ones
        new = [i for i in ids if i not in seen]
        if not new:
            print(f"[SCRAPE] No new IDs on page {page}, stopping.")
            break

        seen.update(new)
        all_ids.extend(new)
        print(f"[SCRAPE] Total unique IDs so far: {len(seen)}")

        time.sleep(1)  # polite delay

    return all_ids


def main():
    print("[INFO] generate_vtcs_json.py (HTML-only) started")
    print(f"[INFO] Project root: {PROJECT_ROOT}")
    print(f"[INFO] Output file: {OUTPUT_FILE}")

    vtc_ids = scrape_all_vtc_ids(limit_pages=200)

    if not vtc_ids:
        print("[INFO] No VTC IDs collected. Exiting.")
        return

    # Save raw ID list (NO API CALLS HERE)
    data = {
        "count": len(vtc_ids),
        "vtcs": [{"id": vid, "name": None, "status": None, "games": [], "recruitment": None}
                 for vid in vtc_ids]
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

    print(f"[INFO] Saved {len(vtc_ids)} VTC IDs to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
