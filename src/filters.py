from __future__ import annotations

from typing import Iterable, List, Optional, Set, Dict, Any


def filter_vtcs(
    all_vtcs: Iterable[Dict[str, Any]],
    *,
    busy_ids: Iterable[int] | Set[int],
    allowed_statuses: List[str],
    game: Optional[str] = None,               # "ets2" | "ats" | "both" | None
    recruitment_only_open: bool = False,
    min_members: Optional[int] = None,
    language_filter: Optional[str] = None,    # substring match, lowercased
) -> List[Dict[str, Any]]:
    """
    Filter VTCs by:
      - not busy in the selected events
      - status (verified / validated / normal)
      - game(s) they support (ETS2 / ATS / both)
      - recruitment status (Open vs any)
      - minimum members (0 or None = no minimum; 0 members = unknown)
      - language substring (e.g. 'en', 'es', 'tr')
    """
    # Normalize busy IDs
    busy_set: Set[int] = {int(b) for b in busy_ids}
    allowed = {s.lower() for s in allowed_statuses}
    lang_sub = language_filter.lower() if language_filter else None

    results: List[Dict[str, Any]] = []

    for raw_vtc in all_vtcs:
        vtc = dict(raw_vtc)  # make a copy so we can safely tweak fields

        # --- Busy filter ---
        vid_raw = vtc.get("id")
        try:
            vid = int(vid_raw) if vid_raw is not None else 0
        except (TypeError, ValueError):
            vid = 0

        if vid in busy_set:
            continue

        # --- Status filter ---
        status = str(vtc.get("status", "normal")).lower()
        if status not in allowed:
            continue

        # --- Game filter ---
        games = vtc.get("games") or {}
        ets2 = bool(games.get("ets2"))
        ats = bool(games.get("ats"))

        if game == "ets2" and not ets2:
            continue
        if game == "ats" and not ats:
            continue
        if game == "both" and not (ets2 and ats):
            continue

        # --- Recruitment filter ---
        recruitment = str(vtc.get("recruitment") or "").strip().lower()
        if recruitment_only_open:
            # If we know it's closed, skip. Unknown stays included.
            if recruitment and recruitment not in ("open", "opened"):
                continue

        # --- Members filter ---
        if min_members is not None and min_members > 0:
            members_raw = vtc.get("members", 0)
            try:
                members = int(members_raw)
            except (TypeError, ValueError):
                members = 0

            # members == 0 => treat as unknown, keep them
            if members > 0 and members < min_members:
                continue

        # --- Language filter ---
        if lang_sub:
            lang = str(vtc.get("language") or "").lower()
            if lang_sub not in lang:
                continue

        # Normalize status_class for display if not present
        vtc["status_class"] = status
        results.append(vtc)

    return results
