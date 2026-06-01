#!/usr/bin/env python3
"""
Regenerate data/publications.json from Google Scholar via SerpApi.

Scholar gives us the objective metadata (title, authors, venue, year,
citation count, link). data/overrides.json supplies everything Scholar
does NOT expose (impact factors, corresponding-author marks, full author
names, rich venue text, extra links). This script fetches the former and
merges the latter.

Usage (CI / online):
    SERPAPI_KEY=xxxxx python scripts/fetch_scholar.py

Usage (offline test against a saved SerpApi response, no key needed):
    python scripts/fetch_scholar.py --input-json tests/sample_serpapi.json --dry-run

Design notes:
  * Zero third-party deps (urllib only) so the GitHub Action needs no install.
  * If the fetch yields zero articles (rate-limited / bad key / network error)
    the script exits non-zero WITHOUT touching publications.json, so the last
    good data stays live on the site.
"""

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

SERPAPI_ENDPOINT = "https://serpapi.com/search.json"
DEFAULT_AUTHOR_ID = "Q7Ybs-gAAAAJ"
SCHOLAR_CITATION_URL = (
    "https://scholar.google.com/citations?view_op=view_citation&hl=en"
    "&user={user}&citation_for_view={cid}"
)


# --------------------------------------------------------------------------- #
# Name handling
# --------------------------------------------------------------------------- #
def name_key(name):
    """Normalize a name to 'firstinitial lastname' so Scholar's abbreviated
    'Q Guan' matches your 'Qiang Guan'. Non-Latin chars (e.g. 张钰奇) drop out."""
    s = re.sub(r"[^A-Za-z\s.\-]", " ", name or "")
    parts = [p for p in re.split(r"[\s.]+", s.strip()) if p]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0].lower()
    return parts[0][0].lower() + " " + parts[-1].lower()


def escape_html(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_authors(raw_authors, full_names, me_keys, corr_keys):
    """Turn Scholar's 'Y Zhang, Q Guan' string into structured author entries,
    expanding abbreviations to full names and flagging me / corresponding."""
    out = []
    for raw in [a.strip() for a in (raw_authors or "").split(",") if a.strip()]:
        k = name_key(raw)
        entry = {"name": full_names.get(k, raw)}
        if k and k in me_keys:
            entry["me"] = True
        if k and k in corr_keys:
            entry["corresponding"] = True
        out.append(entry)
    return out


def authors_from_override(author_list, full_names, me_keys, corr_keys):
    """Build authors from an explicit per-paper override list (strings or objects)."""
    out = []
    for a in author_list:
        if isinstance(a, dict):
            entry = {"name": a.get("name", "")}
            k = name_key(entry["name"])
            if a.get("me") or k in me_keys:
                entry["me"] = True
            if a.get("corresponding") or k in corr_keys:
                entry["corresponding"] = True
        else:
            k = name_key(a)
            entry = {"name": full_names.get(k, a)}
            if k in me_keys:
                entry["me"] = True
            if k in corr_keys:
                entry["corresponding"] = True
        out.append(entry)
    return out


# --------------------------------------------------------------------------- #
# Venue handling
# --------------------------------------------------------------------------- #
def guess_venue_type(publication):
    p = (publication or "").lower()
    if "arxiv" in p or "preprint" in p:
        return "wip"
    conf_kw = ["proceedings", "conference", "symposium", "workshop",
               "supercomputing", "sc '", "sc'"]
    if any(k in p for k in conf_kw):
        return "conf"
    return "journal"


def auto_venue_short(publication):
    """Short, plain venue name for the compact card layout (no IF, no pages, no long titles)."""
    name = (publication or "").split(",")[0].strip()
    return name or "—"


# Common conferences whose Scholar `publication` strings are long Proceedings names;
# map them to a short canonical acronym for the compact card.
CONFERENCE_ALIASES = (
    ("supercomputing", "Supercomputing"),
    ("high performance computing", "SC"),
    ("neurips", "NeurIPS"),
    ("icml", "ICML"),
    ("iclr", "ICLR"),
)


def shorten_conference(publication):
    p = (publication or "").lower()
    for needle, short in CONFERENCE_ALIASES:
        if needle in p:
            return short
    return None


# --------------------------------------------------------------------------- #
# SerpApi fetch
# --------------------------------------------------------------------------- #
def fetch_articles(api_key, author_id):
    """Page through the SerpApi Google Scholar Author API; return all articles."""
    articles = []
    start, page_size = 0, 100
    while True:
        params = {
            "engine": "google_scholar_author",
            "author_id": author_id,
            "api_key": api_key,
            "num": page_size,
            "start": start,
            "sort": "pubdate",
        }
        url = SERPAPI_ENDPOINT + "?" + urllib.parse.urlencode(params)
        with urllib.request.urlopen(url, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if isinstance(data, dict) and data.get("error"):
            raise RuntimeError("SerpApi error: " + str(data["error"]))
        page = data.get("articles", []) or []
        articles.extend(page)
        if len(page) < page_size:
            break
        start += page_size
        if start > 1000:  # safety cap
            break
    return articles


def load_serpapi_from_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f).get("articles", []) or []


def parse_year(article):
    try:
        return int(str(article.get("year"))[:4])
    except (TypeError, ValueError):
        return 0


def cited_by_count(article):
    cb = article.get("cited_by") or {}
    try:
        return int(cb.get("value") or 0)
    except (TypeError, ValueError):
        return 0


# --------------------------------------------------------------------------- #
# Merge
# --------------------------------------------------------------------------- #
def transform(articles, overrides, author_id):
    full_names = {name_key(k): v
                  for k, v in (overrides.get("author_full_names") or {}).items()}
    me_keys = {name_key(a) for a in overrides.get("author_aliases", []) if name_key(a)}
    default_corr = {name_key(a) for a in overrides.get("default_corresponding_authors", [])}
    journals = {k.lower(): v for k, v in (overrides.get("journals") or {}).items()}
    pub_over = overrides.get("publications") or {}

    pubs = []
    for art in articles:
        cid = art.get("citation_id") or ""
        ov = pub_over.get(cid, {})

        # corresponding: per-paper override beats the global default
        if "corresponding" in ov:
            corr_keys = {name_key(a) for a in ov.get("corresponding", [])}
        else:
            corr_keys = default_corr

        if ov.get("authors"):
            authors = authors_from_override(ov["authors"], full_names, me_keys, corr_keys)
        else:
            authors = build_authors(art.get("authors"), full_names, me_keys, corr_keys)

        publication = art.get("publication") or ""
        year = parse_year(art)
        jmeta = journals.get(publication.split(",")[0].strip().lower()) if publication else None

        venue_type = ov.get("venue_type") or (jmeta.get("type") if jmeta else None) \
            or guess_venue_type(publication)
        # Big category label on the card (Journal / Conference / Preprint / Under Review)
        venue_tag = ov.get("venue_tag") or {
            "journal": "Journal", "conf": "Conference", "wip": "Preprint"
        }.get(venue_type, "Article")
        # Short venue name shown under the title (no IF, no pages, no long titles)
        venue_short = ov.get("venue_short") \
            or shorten_conference(publication) \
            or auto_venue_short(publication)

        # links: your override extras first, then the auto Scholar link
        links = [dict(l) for l in ov.get("links", [])]
        if cid:
            scholar_url = SCHOLAR_CITATION_URL.format(user=author_id, cid=cid)
            if not any(l.get("url") == scholar_url for l in links):
                links.append({"label": "Google Scholar", "url": scholar_url, "style": "gray"})

        pub = {
            "citation_id": cid,
            "title": art.get("title") or "",
            "authors": authors,
            "et_al": bool(ov.get("et_al", False)),
            "venue_tag": venue_tag,
            "venue_type": venue_type,
            "venue_short": venue_short,
            "year": year,
            "cited_by": cited_by_count(art),
            "links": links,
        }
        if ov.get("status"):
            pub["status"] = ov["status"]
        pubs.append(pub)

    # ordering: explicit overrides.order first, then newest + most-cited
    order = overrides.get("order") or []
    idx = {cid: i for i, cid in enumerate(order)}
    pubs.sort(key=lambda p: (idx.get(p["citation_id"], 10 ** 6),
                             -(p["year"] or 0), -(p["cited_by"] or 0)))
    return pubs


# --------------------------------------------------------------------------- #
# Entrypoint
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(description="Regenerate publications.json from Google Scholar.")
    ap.add_argument("--author-id", default=os.environ.get("SCHOLAR_AUTHOR_ID", DEFAULT_AUTHOR_ID))
    ap.add_argument("--api-key", default=os.environ.get("SERPAPI_KEY"))
    ap.add_argument("--overrides", default="data/overrides.json")
    ap.add_argument("--output", default="data/publications.json")
    ap.add_argument("--input-json", help="Read a saved SerpApi response instead of calling the API.")
    ap.add_argument("--dry-run", action="store_true", help="Print result; do not write the output file.")
    args = ap.parse_args()

    with open(args.overrides, "r", encoding="utf-8") as f:
        overrides = json.load(f)

    if args.input_json:
        articles = load_serpapi_from_file(args.input_json)
    else:
        if not args.api_key:
            print("ERROR: no SERPAPI_KEY (set env var or pass --api-key).", file=sys.stderr)
            return 2
        try:
            articles = fetch_articles(args.api_key, args.author_id)
        except Exception as exc:  # noqa: BLE001 - want any failure to preserve old data
            print("ERROR: fetch failed (" + str(exc) + "); keeping existing data.", file=sys.stderr)
            return 1

    if not articles:
        print("ERROR: zero articles returned; keeping existing publications.json.", file=sys.stderr)
        return 1

    pubs = transform(articles, overrides, args.author_id)
    result = {
        "meta": {
            "scholar_user": args.author_id,
            "source": "serpapi",
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "count": len(pubs),
            "note": "Auto-generated by scripts/fetch_scholar.py. Tweak data/overrides.json, not this file.",
        },
        "publications": pubs,
    }

    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.dry_run:
        print(text)
    else:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
        print("Wrote {} ({} publications from {} articles).".format(
            args.output, len(pubs), len(articles)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
