# yuqizhang.me — Personal site

Static GitHub Pages site. The **Publications** section auto-syncs from Google Scholar.

## How the auto-sync works

```
Google Scholar ──(SerpApi)──► scripts/fetch_scholar.py ──► data/publications.json ──► assets/pubs.js ──► page
                                        ▲
                          data/overrides.json  (the bits Scholar can't give)
```

- A weekly GitHub Action (`.github/workflows/update-publications.yml`) scrapes Scholar through SerpApi, merges your supplements, writes `data/publications.json`, and commits it — GitHub Pages then redeploys on its own.
- The browser renders that JSON via `assets/pubs.js`. If the fetch ever fails, the static `<li>` items in `index.html` stay visible as a fallback.

## One-time setup (needed for auto-sync)

1. **Get a free SerpApi key** → https://serpapi.com/ (free tier = 100 searches/month; the weekly sync uses ~4).
2. **Add it as a repo secret**: GitHub repo → *Settings → Secrets and variables → Actions → New repository secret*
   - Name: `SERPAPI_KEY`
   - Value: *your key*
3. **Let the Action push**: *Settings → Actions → General → Workflow permissions → Read and write permissions*.
4. **Kick off the first run**: *Actions tab → “Update publications from Google Scholar” → Run workflow* (or just wait for Monday).

After that it updates itself weekly.

## What you maintain: `data/overrides.json`

Scholar does **not** expose impact factors, corresponding-author marks, full author names, or rich venue text — you supply those here. Common edits:

- **New journal / impact factor** → add under `journals`:
  ```json
  "nature communications": { "type": "journal", "impact_factor": 16.6 }
  ```
- **A collaborator showing up as initials** (e.g. `J Smith`) → add under `author_full_names` so it expands to the full name:
  ```json
  "John Smith": "John Smith"
  ```
- **A specific paper** (corresponding authors, venue prose, code links, “Under Review”, *et al.*) → add an entry under `publications`, keyed by its **`citation_id`** — the string after `citation_for_view=` in that paper's Scholar link.

Everything else — titles, authors, year, **citation counts**, ordering, and bolding your own name — is automatic.

**Sync policy** (enforced in `scripts/fetch_scholar.py`, not configurable via overrides):

- Only papers where **you are the first author** are kept — in both sections.
- **Published journal/conference** entries render as full-detail cards under **Publications**.
- **arXiv preprints and under-review** entries render as compact rows under **Preprints & Working Papers** (title + venue + year only; no authors, citations, or corresponding marks).
- Corresponding-author marks (Publications only) are **per-paper**. If a paper's `publications` entry doesn't list `corresponding`, no author is marked.

## Run / test

```bash
# Test the transform offline, no key needed (uses a saved sample response):
python3 scripts/fetch_scholar.py --input-json tests/sample_serpapi.json --dry-run

# Real fetch locally:
SERPAPI_KEY=xxxxx python3 scripts/fetch_scholar.py

# Preview the site locally:
python3 -m http.server 4321   # then open http://localhost:4321
```

## Files

| Path | Purpose |
|------|---------|
| `index.html` | The page. `#pub-list` is filled in by JS. |
| `assets/pubs.js` | Fetches `data/publications.json` and renders the list. |
| `data/publications.json` | Auto-generated publication data — **don't hand-edit**. |
| `data/overrides.json` | **Your** supplements (IF, corresponding authors, venue text, links). |
| `scripts/fetch_scholar.py` | Scholar → JSON fetcher (standard library only, zero deps). |
| `.github/workflows/update-publications.yml` | Weekly auto-update job. |
| `tests/sample_serpapi.json` | Mock SerpApi response for offline testing. |

## If a sync fails

The fetcher exits **without** overwriting `data/publications.json` when Scholar returns nothing (bad/missing key, quota exhausted, network blip), so the last good list stays live. Check the Actions log — the usual cause is a missing or used-up `SERPAPI_KEY`.
