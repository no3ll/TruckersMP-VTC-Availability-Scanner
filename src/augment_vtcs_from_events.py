# src/augment_vtcs_from_events.py

"""
augment_vtcs_from_events.py

- Asks you for one or more TruckersMP event URLs.
- Scrapes the event pages to find attending VTC IDs.
- For each VTC ID, scrapes the VTC page on truckersmp.com to extract:
    - id
    - name
    - status (verified / validated / normal)  [best-effort from HTML]
    - recruitment status (open / closed / unknown)
    - games (ETS2 / ATS)
    - tmp_url
    - discord_invites (list of discord invite links)

- Merges these entries into vtcs_source.json.
- Caches already-known VTCs so they are NOT re-scraped on the next run.
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import requests
from bs4 import BeautifulSoup

BASE_SITE_URL = "https://truckersmp.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36 "
        "EventVTCFinder/0.1"
    )
}


def get_project_root() -> Path:
    """Return the project root (one level above src/)."""
    return Path(__file__).resolve().parents[1]


def get_vtc_source_file() -> Path:
    """Path to vtcs_source.json in the project root."""
    return get_project_root() / "vtcs_source.json"


def extract_event_id(event_url: str) -> Optional[int]:
    """
    Extract the numeric event ID from a TruckersMP event URL.
    Example: https://truckersmp.com/events/30724-tccr-monthly-convoy -> 30724
    """
    m = re.search(r"/events/(\d+)", event_url)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def get_attending_vtcs_html(event_id: int) -> Set[int]:
    """
    Scrape the TruckersMP event page and extract all VTC IDs
    that appear as /vtc/<id> links anywhere on the page.
    """
    url = f"{BASE_SITE_URL}/events/{event_id}"
    print(f"[INFO] Fetching attending VTCs for event {event_id}...")
    print(f"[DEBUG] Fetching real attending VTCs for event {event_id}...")
    print(f"[DEBUG] Requesting event page: {url}")

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
    except requests.RequestException as e:
        print(f"[WARN] Failed to fetch event page {url}: {e}")
        return set()

    if resp.status_code != 200:
        print(f"[WARN] HTTP {resp.status_code} when fetching {url}")
        return set()

    soup = BeautifulSoup(resp.text, "html.parser")
    vtc_ids: Set[int] = set()

    for a in soup.find_all("a", href=True):
        href = a.get("href")
        if not isinstance(href, str):
            continue
        m = re.search(r"/vtc/(\d+)", href)
        if m:
            try:
                vtc_ids.add(int(m.group(1)))
            except ValueError:
                continue

    print(f"[DEBUG] Found {len(vtc_ids)} VTC(s) linked on the event page.")
    return vtc_ids


def load_existing_vtcs(path: Path) -> List[Dict[str, Any]]:
    """Load existing VTC entries from vtcs_source.json (if it exists)."""
    if not path.exists():
        print(f"[INFO] {path} does not exist, starting with an empty list.")
        return []

    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            print(f"[INFO] Loaded {len(data)} existing VTC(s) from {path}.")
            return data
        else:
            print(f"[WARN] {path} did not contain a JSON list, ignoring.")
            return []
    except Exception as e:
        print(f"[WARN] Could not load {path}: {e}")
        return []


def parse_vtc_page(vtc_id: int) -> Optional[Dict[str, Any]]:
    """
    Scrape a TruckersMP VTC page and extract:
      - id
      - name
      - status (verified / validated / normal)
      - recruitment status
      - games (ETS2 / ATS)
      - tmp_url
      - discord_invites (list)

    Returns None if the page can't be fetched or parsed at all.
    """
    url = f"{BASE_SITE_URL}/vtc/{vtc_id}"
    print(f"[SCRAPE] VTC {vtc_id}: {url}")
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
    except requests.RequestException as e:
        print(f"[WARN] Failed to fetch VTC page {url}: {e}")
        return None

    if resp.status_code != 200:
        print(f"[WARN] HTTP {resp.status_code} when fetching {url}")
        return None

    html = resp.text
    soup = BeautifulSoup(html, "html.parser")

    # --- Name (fallback to <title> if needed) ---
    name = None
    for sel in [
        "h1",
        ".vtc-name h1",
        ".page-title h1",
    ]:
        el = soup.select_one(sel)
        if el and el.get_text(strip=True):
            name = el.get_text(strip=True)
            break

    if not name:
        title_el = soup.find("title")
        if title_el and title_el.get_text(strip=True):
            title_text = title_el.get_text(strip=True)
            name = re.sub(r"\s*-\s*Virtual Trucking Company.*$", "", title_text).strip()

    if not name:
        name = f"VTC {vtc_id}"

    # Use both plain text and raw HTML (lowercase) for detection
    page_text = soup.get_text(" ", strip=True).lower()
    html_lower = html.lower()

    # --- Status: verified / validated / normal ---
    status = "normal"
    # Try to detect "Verified VTC" and "Validated VTC" in HTML (covers attributes + text)
    if "verified vtc" in html_lower or "badge-verified" in html_lower or "vtc--verified" in html_lower:
        status = "verified"
    elif "validated vtc" in html_lower or "badge-validated" in html_lower or "vtc--validated" in html_lower:
        status = "validated"

    # --- Recruitment status ---
    recruitment = "unknown"
    m = re.search(r"recruitment\s*[:\-]?\s*(open|closed)", page_text)
    if m:
        recruitment = m.group(1).lower()

    # --- Games (ETS2 / ATS) ---
    games: List[str] = []
    if "euro truck simulator 2" in page_text or "ets2" in page_text:
        games.append("ETS2")
    if "american truck simulator" in page_text or "ats" in page_text:
        games.append("ATS")
    games = sorted(set(games))

    # --- Discord invite links ---
    discord_invites: List[str] = []
    for a in soup.find_all("a", href=True):
        href = a.get("href")
        if not isinstance(href, str):
            continue
        h = href.strip()
        if ("discord.gg/" in h) or ("discord.com/invite" in h):
            if h not in discord_invites:
                discord_invites.append(h)

    entry: Dict[str, Any] = {
        "id": vtc_id,
        "name": name,
        "status": status,           # verified / validated / normal
        "recruitment": recruitment, # open / closed / unknown
        "games": games,             # e.g. ["ETS2", "ATS"]
        "tmp_url": url,
        "discord_invites": discord_invites,
    }

    return entry


def main() -> None:
    print("[INFO] augment_vtcs_from_events.py started")

    project_root = get_project_root()
    vtc_file = get_vtc_source_file()

    print(f"[INFO] Project root: {project_root}")
    print(f"[INFO] VTC source file: {vtc_file}")

    existing_list = load_existing_vtcs(vtc_file)

    # Build a dict indexed by int(id) safely
    existing_by_id: Dict[int, Dict[str, Any]] = {}
    for v in existing_list:
        vid_raw = v.get("id")
        vid_int: Optional[int] = None
        if isinstance(vid_raw, int):
            vid_int = vid_raw
        elif isinstance(vid_raw, str):
            try:
                vid_int = int(vid_raw)
            except ValueError:
                vid_int = None

        if vid_int is None:
            continue
        existing_by_id[vid_int] = v

    print(f"[INFO] Loaded {len(existing_by_id)} existing VTC(s) from vtcs_source.json.\n")

    # --- Ask user for event URLs ---
    print("Enter TruckersMP event URLs (comma separated).")
    print("VTCs attending these events will be added/enriched.")
    event_urls_str = input("> ").strip()
    if not event_urls_str:
        print("[INFO] No event URLs provided. Exiting.")
        return

    event_urls = [u.strip() for u in event_urls_str.split(",") if u.strip()]
    event_ids: List[int] = []

    for url in event_urls:
        eid = extract_event_id(url)
        if eid is None:
            print(f"[WARN] Could not extract event ID from URL: {url}")
        else:
            event_ids.append(eid)

    if not event_ids:
        print("[INFO] No valid event IDs extracted. Exiting.")
        return

    # --- Collect attending VTC IDs from all events ---
    attending_ids: Set[int] = set()
    for eid in event_ids:
        vtc_ids = get_attending_vtcs_html(eid)
        print(f"[INFO] Event {eid}: found {len(vtc_ids)} VTC(s).")
        attending_ids.update(vtc_ids)

    print(f"\n[INFO] Total unique attending VTC IDs from these events: {len(attending_ids)}")

    # Merge with existing IDs
    all_ids: Set[int] = set(existing_by_id.keys()) | attending_ids
    print(f"[INFO] Total unique VTC IDs to enrich (existing + attending): {len(all_ids)}\n")

    # --- Enrich all IDs, with caching (skip re-scraping known VTCs) ---
    updated_by_id: Dict[int, Dict[str, Any]] = {}

    sorted_ids = sorted(all_ids)
    for idx, vid in enumerate(sorted_ids, start=1):
        if vid in existing_by_id:
            # Reuse cached entry
            if vid not in updated_by_id:
                updated_by_id[vid] = existing_by_id[vid]
            print(f"\n[ENRICH] ({idx}/{len(sorted_ids)}) VTC {vid} (cached, no scrape)")
            continue

        # Scrape fresh
        print(f"\n[ENRICH] ({idx}/{len(sorted_ids)}) VTC {vid}")
        entry = parse_vtc_page(vid)
        if entry is None:
            print("[ENRICH] No data for this VTC (scrape failed), skipping.")
            continue

        updated_by_id[vid] = entry

        # Politeness delay (tweak if needed)
        time.sleep(0.4)

    print(f"\n[INFO] Enriched {len(updated_by_id)} VTC(s).")

    # --- Save merged data back to vtcs_source.json ---
    out_list = sorted(updated_by_id.values(), key=lambda v: int(v.get("id", 0)))
    try:
        with vtc_file.open("w", encoding="utf-8") as f:
            json.dump(out_list, f, ensure_ascii=False, indent=2)
        print(f"[INFO] Saved {len(out_list)} VTC entries to {vtc_file}")
    except Exception as e:
        print(f"[ERROR] Failed to write {vtc_file}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
