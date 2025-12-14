# Library Manager

[Русская версия](README.ru.md)

Desktop application for managing personal book collections. Built with Electron.

## Features

### Book Management

- **Full CRUD**: Create, view, edit, and delete books
- **Rich metadata**: Title, authors, series, year, publisher, ISBN, language, format
- **Ratings**: Personal rating (1-5 stars with half-star support) and Goodreads rating integration
- **Cover images**: Upload local covers or search online via Google Books
- **Tags & genres**: Organize books with multiple tags and genres
- **Notes**: Add personal notes to any book

### Reading Status Tracking

Track your reading progress with statuses:
- Want to Read
- Reading (auto-sets start date)
- Finished (auto-sets finish date)
- Re-reading
- Abandoned
- On Hold

Reading session history is preserved for each book.

### Storage Locations & Lending

- **Physical storage tracking**: Define locations (shelves, rooms, boxes) with custom codes
- **Book lending**: Record who borrowed a book and when
- **Movement history**: Full timeline of where each book has been
- **Return tracking**: Log when books come back with optional notes

### Collections

- **Static collections**: Manually curated book lists
- **Filter-based collections**: Dynamic collections based on search criteria
- **Visual badges**: See collection membership on book cards

### Search & Filtering

- **Fuzzy search**: Find books by title or author with typo tolerance (Fuse.js)
- **Advanced filters**: Author, format, year range, Goodreads rating, genres, tags, reading status
- **Boolean operators**: Use `AND`, `OR`, `NOT` in search queries
- **Field-specific search**: `title:`, `author:`, `tag:`, `genre:`, `year>=`, `rating>=`
- **Filter presets**: Save and quickly apply filter combinations

### Import & Export

- **CSV/TSV import**: Bulk import with auto-delimiter detection, column mapping, preview
- **JSON backup**: Full library export/import with embedded cover images
- **Activity log export**: Export history as JSON

### Cloud Sync (S3)

- **Multi-device sync**: Synchronize library across computers via S3-compatible storage
- **Selective sync**: Database, settings, and cover images
- **Version protection**: Prevents older app from overwriting newer schema
- **Device tracking**: See which device last synced

### AI-Powered Features

- **ISBN lookup**: Find ISBN by book title and author using AI (OpenAI or Perplexity)
- **Goodreads enrichment**: Auto-fetch ratings, review counts, and original titles
- **Result caching**: 30-day cache to minimize API calls
- **Strict mode**: Configurable confidence thresholds to reduce false positives

### Cover Search

- **Google Books**: Primary source for book covers
- **DuckDuckGo fallback**: Alternative image search
- **Quality filter**: Minimum 500px width to ensure good quality
- **Preview & select**: Choose from multiple cover options

### Activity History

- **Full audit trail**: All operations logged with timestamps
- **Tracked actions**: Book CRUD, storage moves, lending, collections, sync, imports
- **Browsable history**: Filter by type, search, paginate
- **Export capability**: Save history as JSON

### Vocabulary Management

- **Auto-suggestions**: Autocomplete for authors, series, publishers, genres, tags
- **Bulk rename**: Rename a value across all books at once
- **Custom entries**: Add new vocabulary values manually

### Settings

- **API keys**: ISBNdb, Google Books, OpenAI, Perplexity
- **AI provider**: Choose between OpenAI and Perplexity for enrichment
- **S3 configuration**: Endpoint, region, bucket, credentials
- **Theme**: Light and dark mode
- **Auto-sync**: Enable automatic cloud synchronization

## Installation

### From Release

Download the latest release for your platform:
- **macOS**: `.dmg` or `.zip`
- **Windows**: `.exe` (installer) or portable
- **Linux**: `.AppImage` or `.deb`

### From Source

Requirements: Node.js 20+

```bash
git clone <repository-url>
cd library-manager
npm install
npm start
```

### Build

```bash
npm run dist          # Build for current platform
npm run publish       # Build and publish to GitHub Releases
```

## Configuration

Create a `.env` file in the project root (not committed to git):

```env
# ISBN lookup (optional)
ISBNDB_API_KEY=your_key

# Cover search (optional, increases limits)
GOOGLE_BOOKS_API_KEY=your_key

# AI enrichment - choose one or both
OPENAI_API_KEY=your_key
PERPLEXITY_API_KEY=your_key

# S3 sync (optional)
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=your-bucket
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key

# Auto-update from private GitHub repo (optional)
GH_TOKEN=your_github_token
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `N` | New book |
| `Enter` | Save form |
| `Delete` | Delete selected book |
| `Escape` | Close modal |

Shortcuts are disabled when typing in input fields.

## Tech Stack

- **Framework**: Electron 38
- **Database**: SQLite via sql.js (WebAssembly)
- **Search**: Fuse.js
- **CSV parsing**: PapaParse
- **Cloud storage**: AWS SDK (S3-compatible)
- **AI**: OpenAI SDK (supports OpenAI & Perplexity)
- **Auto-updates**: electron-updater

## Data Storage

All data is stored locally in the user data directory:
- **macOS**: `~/Library/Application Support/Library Manager/`
- **Windows**: `%APPDATA%/Library Manager/`
- **Linux**: `~/.config/Library Manager/`

Contents:
- `data/library.db` — SQLite database
- `data/covers/` — Book cover images
- `data/settings.json` — Application settings

## Testing

```bash
npm run test:unit     # Run unit tests (Vitest)
npm run test:watch    # Watch mode
npm run test:e2e      # Run E2E tests (Playwright)
```

## License

ISC
