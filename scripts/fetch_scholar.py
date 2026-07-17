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
    p = (publication or "").lower().strip()
    # Empty / unknown venue → treat as unpublished so the wip filter drops it.
    # Scholar leaves `publication` blank for under-review / draft entries; if
    # a legit published paper is missing metadata, force-include it via an
    # explicit `venue_type` in overrides.json.
    if not p:
        return "wip"
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
def preprint_venue_short(publication, ov):
    """Compact venue label for the preprints list. Override wins; else derive
    from Scholar's publication string (arXiv / Preprint / Under Review)."""
    if ov.get("venue_short"):
        return ov["venue_short"]
    p = (publication or "").lower()
    if "arxiv" in p:
        return "arXiv"
    if p.strip():
        return "Preprint"
    return "Under Review"


def preprint_url(cid, ov, author_id):
    """Preferred click target for a preprint row: override link > Scholar link."""
    for l in ov.get("links", []):
        if l.get("url"):
            return l["url"]
    if cid:
        return SCHOLAR_CITATION_URL.format(user=author_id, cid=cid)
    return None


def title_key(title):
    """Stable key for matching a manually curated publication to Scholar."""
    return re.sub(r"\s+", " ", (title or "").strip()).lower()


def transform(articles, overrides, author_id):
    """Split first-author articles into (publications, preprints).

    Published venues (journal/conference) → full-detail pubs list.
    arXiv preprints / under-review entries → slim preprints list.
    Everything else (non-first-author) is dropped entirely.
    """
    full_names = {name_key(k): v
                  for k, v in (overrides.get("author_full_names") or {}).items()}
    me_keys = {name_key(a) for a in overrides.get("author_aliases", []) if name_key(a)}
    journals = {k.lower(): v for k, v in (overrides.get("journals") or {}).items()}
    pub_over = overrides.get("publications") or {}
    manual_publications = [p for p in (overrides.get("manual_publications") or [])
                           if isinstance(p, dict) and p.get("title")]

    pubs = []
    preprints = []
    for art in articles:
        cid = art.get("citation_id") or ""
        ov = pub_over.get(cid, {})

        # Corresponding-author marks are per-paper only — no global default.
        # If a paper's override doesn't list `corresponding`, no author is marked.
        corr_keys = {name_key(a) for a in ov.get("corresponding", [])}

        if ov.get("authors"):
            authors = authors_from_override(ov["authors"], full_names, me_keys, corr_keys)
        else:
            authors = build_authors(art.get("authors"), full_names, me_keys, corr_keys)

        # Filter: only sync papers where I'm first author. Applies to BOTH
        # the published list and the preprints list.
        if not authors or not authors[0].get("me"):
            continue

        publication = art.get("publication") or ""
        year = parse_year(art)
        jmeta = journals.get(publication.split(",")[0].strip().lower()) if publication else None

        venue_type = ov.get("venue_type") or (jmeta.get("type") if jmeta else None) \
            or guess_venue_type(publication)

        # Preprint / under-review → slim entry in the separate preprints list.
        if venue_type == "wip":
            preprints.append({
                "citation_id": cid,
                "title": art.get("title") or "",
                "year": year,
                "venue_short": preprint_venue_short(publication, ov),
                "url": preprint_url(cid, ov, author_id),
            })
            continue

        # Published venue → full entry in the main pubs list.
        venue_tag = ov.get("venue_tag") or {
            "journal": "Journal", "conf": "Conference"
        }.get(venue_type, "Article")
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
        if isinstance(ov.get("venue_mark"), dict):
            pub["venue_mark"] = dict(ov["venue_mark"])
        if ov.get("status"):
            pub["status"] = ov["status"]
        pubs.append(pub)

    # Accepted papers can appear on arXiv before Scholar exposes conference
    # metadata. Keep those entries in the published list, then merge with the
    # Scholar version automatically once it arrives (matched by exact title).
    for manual in manual_publications:
        manual_title_key = title_key(manual.get("title"))
        corr_keys = {name_key(a) for a in manual.get("corresponding", [])}
        manual_authors = authors_from_override(
            manual.get("authors") or [], full_names, me_keys, corr_keys
        )
        if not manual_authors or not manual_authors[0].get("me"):
            continue

        # If Scholar still calls the work a preprint, the accepted manual entry
        # replaces it so the paper never appears in both sections.
        preprints = [p for p in preprints if title_key(p.get("title")) != manual_title_key]
        existing = next(
            (p for p in pubs if title_key(p.get("title")) == manual_title_key), None
        )
        manual_links = [dict(l) for l in manual.get("links", [])]

        if existing:
            existing["authors"] = manual_authors
            for field in ("venue_tag", "venue_type", "venue_short", "year", "status"):
                if manual.get(field) is not None:
                    existing[field] = manual[field]
            if isinstance(manual.get("venue_mark"), dict):
                existing["venue_mark"] = dict(manual["venue_mark"])
            existing["links"] = manual_links + [
                link for link in existing.get("links", [])
                if link.get("url") not in {item.get("url") for item in manual_links}
            ]
            continue

        manual_pub = {
            "citation_id": manual.get("citation_id") or "manual:" + manual_title_key,
            "title": manual.get("title") or "",
            "authors": manual_authors,
            "et_al": bool(manual.get("et_al", False)),
            "venue_tag": manual.get("venue_tag") or "Conference",
            "venue_type": manual.get("venue_type") or "conf",
            "venue_short": manual.get("venue_short") or "—",
            "year": int(manual.get("year") or 0),
            "cited_by": int(manual.get("cited_by") or 0),
            "links": manual_links,
        }
        if isinstance(manual.get("venue_mark"), dict):
            manual_pub["venue_mark"] = dict(manual["venue_mark"])
        if manual.get("status"):
            manual_pub["status"] = manual["status"]
        pubs.append(manual_pub)

    # Ordering: explicit overrides.order first for both, then newest.
    # pubs additionally use cited_by as tiebreak; preprints don't have citations.
    order = overrides.get("order") or []
    idx = {cid: i for i, cid in enumerate(order)}
    manual_ids_by_title = {
        title_key(p.get("title")): p.get("citation_id")
        for p in manual_publications if p.get("citation_id")
    }

    def publication_order(p):
        direct = idx.get(p["citation_id"], 10 ** 6)
        manual = idx.get(manual_ids_by_title.get(title_key(p.get("title"))), 10 ** 6)
        return min(direct, manual)

    pubs.sort(key=lambda p: (publication_order(p),
                             -(p["year"] or 0), -(p["cited_by"] or 0)))
    preprints.sort(key=lambda p: (idx.get(p["citation_id"], 10 ** 6),
                                  -(p["year"] or 0)))
    return pubs, preprints


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

    pubs, preprints = transform(articles, overrides, args.author_id)
    result = {
        "meta": {
            "scholar_user": args.author_id,
            "source": "serpapi",
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "count": len(pubs),
            "preprint_count": len(preprints),
            "note": "Auto-generated by scripts/fetch_scholar.py. Tweak data/overrides.json, not this file.",
        },
        "publications": pubs,
        "preprints": preprints,
    }

    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.dry_run:
        print(text)
    else:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
        print("Wrote {} ({} publications, {} preprints from {} articles).".format(
            args.output, len(pubs), len(preprints), len(articles)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
