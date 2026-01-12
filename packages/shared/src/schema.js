/**
 * Database schema definitions and migrations
 * Current schema version: 16
 */

const SCHEMA_VERSION = 16;

/**
 * Initial schema (v1) SQL
 */
const SCHEMA_V1 = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    coverPath TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS authors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS book_authors (
    bookId TEXT NOT NULL,
    authorId TEXT NOT NULL,
    PRIMARY KEY(bookId, authorId)
  );

  CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
`;

/**
 * Migration definitions
 * Each migration transforms the database from version N to version N+1
 */
const MIGRATIONS = {
  // v1 -> v2: Add book metadata fields
  2: `
    ALTER TABLE books ADD COLUMN series TEXT;
    ALTER TABLE books ADD COLUMN seriesIndex INTEGER;
    ALTER TABLE books ADD COLUMN year INTEGER;
    ALTER TABLE books ADD COLUMN publisher TEXT;
    ALTER TABLE books ADD COLUMN isbn TEXT;
    ALTER TABLE books ADD COLUMN language TEXT;
    ALTER TABLE books ADD COLUMN rating REAL;
    ALTER TABLE books ADD COLUMN notes TEXT;
    ALTER TABLE books ADD COLUMN tags TEXT;
    CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
  `,

  // v2 -> v3: ISBN cache table
  3: `
    CREATE TABLE IF NOT EXISTS isbn_cache (
      isbn TEXT PRIMARY KEY,
      provider TEXT,
      payload TEXT NOT NULL,
      fetchedAt TEXT NOT NULL
    );
  `,

  // v3 -> v4: Alt title/authors fields
  4: `
    ALTER TABLE books ADD COLUMN titleAlt TEXT;
    ALTER TABLE books ADD COLUMN authorsAlt TEXT;
  `,

  // v4 -> v5: AI ISBN cache
  5: `
    CREATE TABLE IF NOT EXISTS ai_isbn_cache (
      key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      fetchedAt TEXT NOT NULL
    );
  `,

  // v5 -> v6: Format and genres
  6: `
    ALTER TABLE books ADD COLUMN format TEXT;
    ALTER TABLE books ADD COLUMN genres TEXT;
  `,

  // v6 -> v7: Cover path normalization (handled in code)
  7: null, // Migration handled in code

  // v7 -> v8: Storage locations
  8: `
    CREATE TABLE IF NOT EXISTS storage_locations (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT,
      note TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    ALTER TABLE books ADD COLUMN storageLocationId TEXT;
    CREATE TABLE IF NOT EXISTS book_storage_history (
      id TEXT PRIMARY KEY,
      bookId TEXT NOT NULL,
      fromLocationId TEXT,
      toLocationId TEXT,
      action TEXT NOT NULL,
      person TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_books_storageLocationId ON books(storageLocationId);
    CREATE INDEX IF NOT EXISTS idx_history_bookId ON book_storage_history(bookId);
    CREATE INDEX IF NOT EXISTS idx_history_created_at ON book_storage_history(created_at DESC);
  `,

  // v8 -> v9: Activity log
  9: `
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      actor TEXT,
      origin TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      summary TEXT,
      payload TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);
    CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
  `,

  // v9 -> v10: Collections
  10: `
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      filters TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collection_books (
      collectionId TEXT NOT NULL,
      bookId TEXT NOT NULL,
      PRIMARY KEY(collectionId, bookId)
    );
    CREATE INDEX IF NOT EXISTS idx_collection_name ON collections(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_collection_books_book ON collection_books(bookId);
  `,

  // v10 -> v11: Filter presets
  11: `
    CREATE TABLE IF NOT EXISTS filter_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      filters TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_filter_presets_name_unique ON filter_presets(name COLLATE NOCASE) WHERE slug IS NULL;
  `,

  // v11 -> v12: Goodreads fields
  12: `
    ALTER TABLE books ADD COLUMN goodreadsRating REAL;
    ALTER TABLE books ADD COLUMN goodreadsRatingsCount INTEGER;
    ALTER TABLE books ADD COLUMN goodreadsReviewsCount INTEGER;
    ALTER TABLE books ADD COLUMN goodreadsUrl TEXT;
    ALTER TABLE books ADD COLUMN originalTitleEn TEXT;
    ALTER TABLE books ADD COLUMN originalAuthorsEn TEXT;
  `,

  // v12 -> v13: Goodreads fetch timestamp
  13: `
    ALTER TABLE books ADD COLUMN goodreadsFetchedAt TEXT;
  `,

  // v13 -> v14: Custom vocabulary
  14: `
    CREATE TABLE IF NOT EXISTS vocab_custom (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      value TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(domain, value)
    );
  `,

  // v14 -> v15: Reading sessions
  15: `
    CREATE TABLE IF NOT EXISTS reading_sessions (
      id TEXT PRIMARY KEY,
      bookId TEXT NOT NULL,
      status TEXT NOT NULL,
      startedAt TEXT,
      finishedAt TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(bookId) REFERENCES books(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_book ON reading_sessions(bookId);
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_status ON reading_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_started ON reading_sessions(startedAt);
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_finished ON reading_sessions(finishedAt);

    ALTER TABLE books ADD COLUMN currentReadingSessionId TEXT;
    CREATE INDEX IF NOT EXISTS idx_books_reading_session ON books(currentReadingSessionId);
  `,

  // v15 -> v16: Soft delete support for entity-level sync
  16: `
    -- Add deleted_at to books
    ALTER TABLE books ADD COLUMN deleted_at TEXT;
    CREATE INDEX IF NOT EXISTS idx_books_deleted_at ON books(deleted_at);

    -- Add deleted_at and updatedAt to authors (authors didn't have updatedAt before)
    ALTER TABLE authors ADD COLUMN updatedAt TEXT;
    ALTER TABLE authors ADD COLUMN deleted_at TEXT;
    CREATE INDEX IF NOT EXISTS idx_authors_deleted_at ON authors(deleted_at);

    -- Add deleted_at to collections
    ALTER TABLE collections ADD COLUMN deleted_at TEXT;
    CREATE INDEX IF NOT EXISTS idx_collections_deleted_at ON collections(deleted_at);

    -- Add deleted_at to storage_locations
    ALTER TABLE storage_locations ADD COLUMN deleted_at TEXT;
    CREATE INDEX IF NOT EXISTS idx_storage_locations_deleted_at ON storage_locations(deleted_at);

    -- Add deleted_at to reading_sessions
    ALTER TABLE reading_sessions ADD COLUMN deleted_at TEXT;
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_deleted_at ON reading_sessions(deleted_at);

    -- Add deleted_at to filter_presets
    ALTER TABLE filter_presets ADD COLUMN deleted_at TEXT;
    CREATE INDEX IF NOT EXISTS idx_filter_presets_deleted_at ON filter_presets(deleted_at);

    -- Add deleted_at to vocab_custom
    ALTER TABLE vocab_custom ADD COLUMN deleted_at TEXT;
    CREATE INDEX IF NOT EXISTS idx_vocab_custom_deleted_at ON vocab_custom(deleted_at);

    -- Add deleted_at to book_storage_history
    ALTER TABLE book_storage_history ADD COLUMN deleted_at TEXT;
  `,
};

/**
 * Full current schema SQL (for fresh databases)
 */
const SCHEMA_SQL = `
  -- Meta table
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

  -- Books table
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    coverPath TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deleted_at TEXT,
    series TEXT,
    seriesIndex INTEGER,
    year INTEGER,
    publisher TEXT,
    isbn TEXT,
    language TEXT,
    rating REAL,
    notes TEXT,
    tags TEXT,
    titleAlt TEXT,
    authorsAlt TEXT,
    format TEXT,
    genres TEXT,
    storageLocationId TEXT,
    goodreadsRating REAL,
    goodreadsRatingsCount INTEGER,
    goodreadsReviewsCount INTEGER,
    goodreadsUrl TEXT,
    originalTitleEn TEXT,
    originalAuthorsEn TEXT,
    goodreadsFetchedAt TEXT,
    currentReadingSessionId TEXT
  );

  -- Authors table
  CREATE TABLE IF NOT EXISTS authors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    updatedAt TEXT,
    deleted_at TEXT
  );

  -- Book-Authors relationship
  CREATE TABLE IF NOT EXISTS book_authors (
    bookId TEXT NOT NULL,
    authorId TEXT NOT NULL,
    PRIMARY KEY(bookId, authorId)
  );

  -- ISBN cache
  CREATE TABLE IF NOT EXISTS isbn_cache (
    isbn TEXT PRIMARY KEY,
    provider TEXT,
    payload TEXT NOT NULL,
    fetchedAt TEXT NOT NULL
  );

  -- AI ISBN cache
  CREATE TABLE IF NOT EXISTS ai_isbn_cache (
    key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    fetchedAt TEXT NOT NULL
  );

  -- Storage locations
  CREATE TABLE IF NOT EXISTS storage_locations (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT,
    note TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  -- Book storage history
  CREATE TABLE IF NOT EXISTS book_storage_history (
    id TEXT PRIMARY KEY,
    bookId TEXT NOT NULL,
    fromLocationId TEXT,
    toLocationId TEXT,
    action TEXT NOT NULL,
    person TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    deleted_at TEXT
  );

  -- Activity log
  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    actor TEXT,
    origin TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    summary TEXT,
    payload TEXT
  );

  -- Collections
  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    filters TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  -- Collection-Books relationship
  CREATE TABLE IF NOT EXISTS collection_books (
    collectionId TEXT NOT NULL,
    bookId TEXT NOT NULL,
    PRIMARY KEY(collectionId, bookId)
  );

  -- Filter presets
  CREATE TABLE IF NOT EXISTS filter_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    filters TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  -- Custom vocabulary
  CREATE TABLE IF NOT EXISTS vocab_custom (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    value TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deleted_at TEXT,
    UNIQUE(domain, value)
  );

  -- Reading sessions
  CREATE TABLE IF NOT EXISTS reading_sessions (
    id TEXT PRIMARY KEY,
    bookId TEXT NOT NULL,
    status TEXT NOT NULL,
    startedAt TEXT,
    finishedAt TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY(bookId) REFERENCES books(id) ON DELETE CASCADE
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
  CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
  CREATE INDEX IF NOT EXISTS idx_books_storageLocationId ON books(storageLocationId);
  CREATE INDEX IF NOT EXISTS idx_books_reading_session ON books(currentReadingSessionId);
  CREATE INDEX IF NOT EXISTS idx_books_deleted_at ON books(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_authors_deleted_at ON authors(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_history_bookId ON book_storage_history(bookId);
  CREATE INDEX IF NOT EXISTS idx_history_created_at ON book_storage_history(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);
  CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_collection_name ON collections(name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_collection_books_book ON collection_books(bookId);
  CREATE INDEX IF NOT EXISTS idx_collections_deleted_at ON collections(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_storage_locations_deleted_at ON storage_locations(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_reading_sessions_book ON reading_sessions(bookId);
  CREATE INDEX IF NOT EXISTS idx_reading_sessions_status ON reading_sessions(status);
  CREATE INDEX IF NOT EXISTS idx_reading_sessions_started ON reading_sessions(startedAt);
  CREATE INDEX IF NOT EXISTS idx_reading_sessions_finished ON reading_sessions(finishedAt);
  CREATE INDEX IF NOT EXISTS idx_reading_sessions_deleted_at ON reading_sessions(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_filter_presets_deleted_at ON filter_presets(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_vocab_custom_deleted_at ON vocab_custom(deleted_at);
`;

module.exports = {
  SCHEMA_VERSION,
  SCHEMA_V1,
  SCHEMA_SQL,
  MIGRATIONS,
};
