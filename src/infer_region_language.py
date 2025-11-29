import json
from pathlib import Path
from typing import Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent
VTC_SOURCE_FILE = (PROJECT_ROOT / "vtcs_source.json").resolve()


# Very simple heuristic rules based on VTC name keywords.
# You can extend this over time as you see more patterns.
REGION_LANGUAGE_HINTS = [
    # Turkey
    ("turk", ("TR", "tr")),
    ("türk", ("TR", "tr")),
    ("turkiye", ("TR", "tr")),
    ("türkiye", ("TR", "tr")),

    # Poland
    ("poland", ("PL", "pl")),
    ("polska", ("PL", "pl")),

    # Germany
    ("german", ("DE", "de")),
    ("deutsch", ("DE", "de")),
    ("deutschland", ("DE", "de")),

    # Spain
    ("spain", ("ES", "es")),
    ("españa", ("ES", "es")),
    ("espana", ("ES", "es")),

    # France
    ("france", ("FR", "fr")),
    ("français", ("FR", "fr")),
    ("francais", ("FR", "fr")),

    # Italy
    ("italy", ("IT", "it")),
    ("italia", ("IT", "it")),

    # Portugal / Brazil
    ("portugal", ("PT", "pt")),
    ("portuguese", ("PT", "pt")),
    ("brasil", ("BR", "pt")),
    ("brazil", ("BR", "pt")),

    # UK / English
    ("uk ", ("UK", "en")),
    ("united kingdom", ("UK", "en")),
    ("england", ("UK", "en")),
    ("scotland", ("UK", "en")),
    ("wales", ("UK", "en")),

    # China
    ("china", ("CN", "zh")),
    ("中国", ("CN", "zh")),

    # Philippines
    ("philippines", ("PH", "en")),
    ("philippine", ("PH", "en")),

    # India
    ("india", ("IN", "en")),

    # Arabic world (very rough)
    ("arab", ("ARAB", "ar")),
    ("saudi", ("SA", "ar")),
    ("egypt", ("EG", "ar")),

    # Generic "EU"
    ("europe", ("EU", "en")),
    ("european", ("EU", "en")),
]


def infer_region_language_from_name(name: str) -> Tuple[str, str]:
    """
    Try to guess region + language from the VTC name.
    Returns (region_code, language_code) or ("", "") if unsure.
    """
    text = name.lower()

    for key, (region, lang) in REGION_LANGUAGE_HINTS:
        if key in text:
            return region, lang

    return "", ""


def main() -> None:
    print(f"[INFO] infer_region_language.py started")
    print(f"[INFO] vtcs_source.json: {VTC_SOURCE_FILE}")

    if not VTC_SOURCE_FILE.exists():
        print("Error: vtcs_source.json not found. Run your generators first.")
        return

    try:
        data = json.loads(VTC_SOURCE_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Error reading vtcs_source.json: {e}")
        return

    updated = 0
    total = len(data)

    for v in data:
        name = str(v.get("name", "")).strip()
        if not name:
            continue

        # Skip if region already set
        if v.get("region") and v.get("language"):
            continue

        region, lang = infer_region_language_from_name(name)
        if region:
            if not v.get("region"):
                v["region"] = region
            if lang and not v.get("language"):
                v["language"] = lang
            updated += 1

    print(f"[INFO] Updated region/language for {updated} out of {total} VTC(s).")

    VTC_SOURCE_FILE.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"[INFO] Saved updated vtcs_source.json")


if __name__ == "__main__":
    main()
