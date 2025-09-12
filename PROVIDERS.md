## ISBN Providers Architecture

This document describes the pluggable provider architecture used to fetch and apply book metadata by ISBN.

### Goals
- Simple, swappable provider API.
- Caching to minimize external calls and improve responsiveness.
- Safe main-process networking with a narrow, typed IPC surface.
- Consistent normalization of provider payloads into the app’s schema.

### Components
- Aggregator: `src/main/providers/isbn.js`
  - Normalizes ISBN input (strip non-digits, allow X for ISBN-10).
  - Checks cache (`isbn_cache`) with TTL.
  - Calls providers in order until results are found.
  - Returns a normalized list of candidates.
- Providers (per-source): `src/main/providers/<provider>.js`
  - Implement `async byIsbn(isbn)` and return normalized candidates.
  - Current: `openlibrary.js`.
- Cache (DB): `isbn_cache` in `src/main/db.js`
  - Helpers: `getIsbnCache`, `setIsbnCache`.
- IPC: exposed from `src/main.js`
  - `meta:byIsbn` → lookup candidates.
  - `covers:download` → download external cover into local `covers/`.
- Bridge: `src/preload.js`
  - `api.metaByIsbn(isbn)`, `api.downloadCover(url)`.
- UI: `src/renderer.js`
  - Search button in the details modal, renders candidates, applies selection to fields and downloads cover.

### Normalized Candidate Shape
Providers must return an array of plain objects with these fields:
- `title: string`
- `authors: string[]`
- `publisher: string | null`
- `year: number | null` (extract year if source returns full date)
- `isbn: string` (normalized, digits and optional X)
- `language: string | null` (BCP‑47 or ISO code when available)
- `tags: string[]` (subjects/categories, trimmed)
- `notes: string | null` (optional description)
- `coverUrl: string | null` (HTTP(S) URL, if available)
- `source: 'openlibrary' | 'googlebooks' | 'isbandb' | ...`

### Provider Interface
Each provider module exports:
- `async byIsbn(isbn: string): Promise<Candidate[]>`

Notes:
- Providers must not perform any disk I/O. Network happens in main process; the aggregator or IPC will handle cover file writing via `covers:download`.
- Keep timeouts conservative and validate JSON shapes defensively.

### Aggregator Flow (`isbn.js`)
- `normalizeIsbn(input)` → uppercase, strip non `[0-9X]`.
- Check cache: `getIsbnCache(ctx, isbn)`. If fresh (default TTL 14 days), return cached payload.
- Try providers in order (currently: Open Library). On first success, cache `provider` + `payload` via `setIsbnCache`.
- Return accumulated candidates (usually from the first provider).

### Cache Schema (v3 migration)
Table `isbn_cache`:
- `isbn TEXT PRIMARY KEY`
- `provider TEXT`
- `payload TEXT NOT NULL` (stringified JSON array of candidates)
- `fetchedAt TEXT NOT NULL` (ISO timestamp)

Helpers in `src/main/db.js`:
- `getIsbnCache(ctx, isbn)` → `{ provider, payload, fetchedAt } | null`
- `setIsbnCache(ctx, isbn, provider, payload)` → upsert + persist

### IPC Surface
- `meta:byIsbn (isbn)` → `{ ok, results?, error? }`
- `covers:download (url)` → `{ ok, path?, error? }` (downloads to `userData/data/covers/`)

### Adding a New Provider
1) Create `src/main/providers/googlebooks.js` (example):
   - Export `async byIsbn(isbn)`.
   - Call Google Books `volumes?q=isbn:{isbn}` with API key (from env or config).
   - Map response to the normalized candidate shape.
2) Register in aggregator `isbn.js` (add to the providers list after cache check).
3) Respect ToS/attribution. Add source string to `candidate.source` and show it in UI if required.
4) Optionally extend UI to display multiple sources or “Try another source” fallback.

### Cover Handling
- The UI uses `api.downloadCover(url)` which calls IPC `covers:download`.
- Main process downloads the image and writes it under `covers/`, returning the local file path.
- Renderer sets `state.modal.coverSourcePath` and previews via a `file://` URL.

### Configuration & Secrets
- Place provider keys (e.g., Google Books) in environment variables or a settings UI stored under `userData`.
- Do not expose secrets to the renderer. Read them in the main process only.

### Getting API Keys

#### Open Library
- No API key required.

#### Google Books API (recommended as fallback)
- Create (or use) a Google account and open Google Cloud Console: console.cloud.google.com
- Create a Project (or select an existing one).
- Enable API: APIs & Services → Library → search “Books API” → Enable.
- Create credentials: APIs & Services → Credentials → Create Credentials → API key.
- Restrict key (recommended): open the key → Application restrictions = None (desktop app) or appropriate server IP; API restrictions = Restrict key → select “Books API” → Save.
- Test:
  - macOS/Linux: curl "https://www.googleapis.com/books/v1/volumes?q=isbn:9780140328721&key=YOUR_KEY"
- Provide to app at runtime:
  - macOS/Linux: `GOOGLE_BOOKS_API_KEY=YOUR_KEY npm start`
  - Windows (PowerShell): `$env:GOOGLE_BOOKS_API_KEY='YOUR_KEY'; npm start`

Suggested env var: `GOOGLE_BOOKS_API_KEY`.

#### ISBNdb (optional, paid)
- Sign up at https://isbndb.com/ and copy the API key from your dashboard.
- Test:
  - curl -H "Authorization: YOUR_KEY" "https://api2.isbndb.com/book/9780140328721"
- Provide to app at runtime:
  - macOS/Linux: `ISBNDB_API_KEY=YOUR_KEY npm start`

Suggested env var: `ISBNDB_API_KEY`.

#### WorldCat / OCLC (optional; requires affiliation)
- Create an OCLC developer account and request a WSKey for WorldCat APIs: https://developer.api.oclc.org/
- Some services require institution credentials; review ToS and access requirements.

Suggested env var: `WORLDCAT_WSKEY`.

### Error Handling & Resilience
- Network timeouts and non‑200: provider returns `[]`.
- Aggregator catches provider errors, logs, and falls back to the next provider or empty list.
- Cache stores negative results (`provider: 'none'`) to avoid repeated failed lookups within TTL.

### Testing Tips
- Unit test provider normalizers with recorded fixtures.
- Use a deterministic ISBN set for manual verification.
- Mock `fetch` in main for offline tests.

### Roadmap Enhancements
- Add Google Books provider and source preference order.
- Expose “Try another source”/“Refresh” in UI ignoring cache.
- Add cache TTL control and manual clear.
- De‑dup candidates and choose best by language/region.
