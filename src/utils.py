from urllib.parse import urlparse


def extract_event_id(url: str) -> int:
    """
    Extract TruckersMP event ID from URLs such as:
      https://truckersmp.com/events/31728
      https://truckersmp.com/events/31728-some-name
      https://truckersmp.com/events/31728-kässbohrer-group-opening-convoy

    Logic:
    1. Remove URL prefix
    2. Find the part after /events/
    3. Take digits until the first non-digit
    """
    parsed = urlparse(url)
    path = parsed.path  # e.g. '/events/31728-käss...'
    parts = path.strip("/").split("/")  # ['events', '31728-käss...']

    if len(parts) >= 2 and parts[0].lower() == "events":
        remainder = parts[1]

        event_id_str = ""
        for ch in remainder:
            if ch.isdigit():
                event_id_str += ch
            else:
                break

        if event_id_str:
            return int(event_id_str)

    raise ValueError(f"Invalid TruckersMP event URL: {url}")


def parse_comma_separated_urls(raw: str) -> list[str]:
    """
    Split a comma-separated string of URLs into a clean list.
    Example input:
        '  url1 , url2, url3 '

    Output:
        ['url1', 'url2', 'url3']
    """
    return [u.strip() for u in raw.split(",") if u.strip()]
