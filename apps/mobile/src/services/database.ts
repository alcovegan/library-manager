/**
 * Database service using expo-sqlite
 * Uses shared schema from @library-manager/shared
 */

import * as SQLite from 'expo-sqlite';
import { SCHEMA_VERSION, SCHEMA_SQL, MIGRATIONS } from '@library-manager/shared';
import type { Book, BookWithAuthors, Author, ReadingSession, StorageLocation, Collection } from '../types';

// Debug: verify shared module loaded correctly
console.log('[DB] Shared module loaded:', {
  SCHEMA_VERSION,
  SCHEMA_SQL_LENGTH: SCHEMA_SQL?.length ?? 'undefined',
  MIGRATIONS_KEYS: MIGRATIONS ? Object.keys(MIGRATIONS) : 'undefined',
});

/**
 * Generate a unique ID for new records
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Initialize and get database instance
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  // Prevent multiple simultaneous initializations
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[DB] Opening database...');
    try {
      db = await SQLite.openDatabaseAsync('library.db');
      console.log('[DB] Database opened, initializing schema...');
      await initializeSchema();
      console.log('[DB] Schema initialized successfully');
      return db;
    } catch (error) {
      console.error('[DB] Failed to initialize database:', error);
      db = null;
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Initialize database schema and run migrations
 */
async function initializeSchema(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  // Check current schema version
  let currentVersion = 0;
  try {
    const result = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'schema_version'"
    );
    if (result) {
      currentVersion = parseInt(result.value, 10);
    }
    console.log(`[DB] Current schema version: ${currentVersion}`);
  } catch (e) {
    // Meta table doesn't exist, fresh database
    console.log('[DB] Fresh database, will create schema');
    currentVersion = 0;
  }

  if (currentVersion === 0) {
    // Fresh database - apply full schema
    console.log('[DB] Applying full schema...');
    try {
      // Remove SQL comments and split into statements
      const cleanedSQL = SCHEMA_SQL
        .split('\n')
        .map((line: string) => {
          // Remove inline comments
          const commentIndex = line.indexOf('--');
          return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
        })
        .join('\n');

      const statements = cleanedSQL
        .split(';')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      console.log(`[DB] Executing ${statements.length} statements...`);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const preview = stmt.replace(/\s+/g, ' ').substring(0, 60);
        console.log(`[DB] Statement ${i + 1}/${statements.length}: ${preview}...`);
        await db.execAsync(stmt);
      }

      await db.runAsync(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)",
        [SCHEMA_VERSION.toString()]
      );
      console.log(`[DB] Database initialized with schema version ${SCHEMA_VERSION}`);
    } catch (error) {
      console.error('[DB] Failed to apply schema:', error);
      throw error;
    }
  } else if (currentVersion < SCHEMA_VERSION) {
    // Run migrations
    console.log(`[DB] Migrating from v${currentVersion} to v${SCHEMA_VERSION}...`);
    for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
      const migration = MIGRATIONS[v];
      if (migration) {
        console.log(`[DB] Running migration to version ${v}`);
        try {
          await db.execAsync(migration);
        } catch (error) {
          console.error(`[DB] Migration to v${v} failed:`, error);
          throw error;
        }
      }
    }
    await db.runAsync(
      "UPDATE meta SET value = ? WHERE key = 'schema_version'",
      [SCHEMA_VERSION.toString()]
    );
    console.log(`[DB] Database migrated to version ${SCHEMA_VERSION}`);
  } else {
    console.log('[DB] Schema is up to date');
  }
}

/**
 * Helper to attach authors to books (avoids N+1 queries)
 */
async function attachAuthorsToBooks(database: SQLite.SQLiteDatabase, books: Book[]): Promise<BookWithAuthors[]> {
  if (books.length === 0) return [];

  // Get all book IDs
  const bookIds = books.map(b => b.id);

  // Fetch all authors for all books in one query
  const placeholders = bookIds.map(() => '?').join(',');
  const authorsData = await database.getAllAsync<{ bookId: string; authorId: string; name: string }>(`
    SELECT ba.bookId, a.id as authorId, a.name
    FROM book_authors ba
    JOIN authors a ON a.id = ba.authorId
    WHERE ba.bookId IN (${placeholders})
  `, bookIds);

  // Group authors by book ID
  const authorsByBook = new Map<string, Author[]>();
  for (const row of authorsData) {
    if (!authorsByBook.has(row.bookId)) {
      authorsByBook.set(row.bookId, []);
    }
    authorsByBook.get(row.bookId)!.push({ id: row.authorId, name: row.name });
  }

  // Attach authors to books
  return books.map(book => ({
    ...book,
    authors: authorsByBook.get(book.id) || [],
  }));
}

/**
 * Get all books with their authors
 */
export async function getAllBooks(): Promise<BookWithAuthors[]> {
  const database = await getDatabase();

  const books = await database.getAllAsync<Book>(`
    SELECT * FROM books ORDER BY updatedAt DESC
  `);

  return attachAuthorsToBooks(database, books);
}

/**
 * Get a single book by ID with authors
 */
export async function getBookById(id: string): Promise<BookWithAuthors | null> {
  const database = await getDatabase();

  const book = await database.getFirstAsync<Book>(
    'SELECT * FROM books WHERE id = ?',
    [id]
  );

  if (!book) return null;

  const booksWithAuthors = await attachAuthorsToBooks(database, [book]);
  return booksWithAuthors[0] || null;
}

/**
 * Search/filter options
 */
export interface BookFilters {
  query?: string;
  author?: string;
  format?: string;
  status?: string;
  language?: string;
  yearFrom?: number;
  yearTo?: number;
  hasRating?: boolean;
  goodreadsMin?: number;
  goodreadsMax?: number;
  genres?: string[];
  tags?: string[];
}

/**
 * Search and filter books
 */
export async function searchBooks(query: string): Promise<BookWithAuthors[]> {
  return filterBooks({ query });
}

/**
 * Get books with filters
 * Note: Text search is done in JavaScript because SQLite's LOWER() doesn't work with Cyrillic
 */
export async function filterBooks(filters: BookFilters): Promise<BookWithAuthors[]> {
  const database = await getDatabase();

  let sql = `
    SELECT DISTINCT b.* FROM books b
    LEFT JOIN book_authors ba ON ba.bookId = b.id
    LEFT JOIN authors a ON a.id = ba.authorId
    LEFT JOIN reading_sessions rs ON rs.id = b.currentReadingSessionId
  `;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Author filter
  if (filters.author) {
    conditions.push('a.name = ?');
    params.push(filters.author);
  }

  // Format filter
  if (filters.format) {
    conditions.push('b.format = ?');
    params.push(filters.format);
  }

  // Reading status filter
  if (filters.status) {
    if (filters.status === 'no_status') {
      conditions.push('(rs.status IS NULL OR b.currentReadingSessionId IS NULL)');
    } else {
      conditions.push('rs.status = ?');
      params.push(filters.status);
    }
  }

  // Language filter
  if (filters.language) {
    conditions.push('b.language = ?');
    params.push(filters.language);
  }

  // Year range
  if (filters.yearFrom) {
    conditions.push('b.year >= ?');
    params.push(filters.yearFrom);
  }
  if (filters.yearTo) {
    conditions.push('b.year <= ?');
    params.push(filters.yearTo);
  }

  // Rating filter
  if (filters.hasRating) {
    conditions.push('b.rating IS NOT NULL');
  }

  // Goodreads rating range
  if (filters.goodreadsMin !== undefined) {
    conditions.push('b.goodreadsRating >= ?');
    params.push(filters.goodreadsMin);
  }
  if (filters.goodreadsMax !== undefined) {
    conditions.push('b.goodreadsRating <= ?');
    params.push(filters.goodreadsMax);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY b.updatedAt DESC';

  const books = await database.getAllAsync<Book>(sql, params);

  // Fetch authors for all books in one query
  let booksWithAuthors = await attachAuthorsToBooks(database, books);

  // Text search in JavaScript (SQLite LOWER() doesn't work with Cyrillic)
  if (filters.query && filters.query.trim()) {
    const query = filters.query.toLowerCase();
    booksWithAuthors = booksWithAuthors.filter((book) => {
      const title = book.title?.toLowerCase() || '';
      const titleAlt = book.titleAlt?.toLowerCase() || '';
      const series = book.series?.toLowerCase() || '';
      const authorsStr = book.authors.map(a => a.name.toLowerCase()).join(' ');

      return (
        title.includes(query) ||
        titleAlt.includes(query) ||
        series.includes(query) ||
        authorsStr.includes(query)
      );
    });
  }

  // Genres filter in JavaScript
  if (filters.genres && filters.genres.length > 0) {
    booksWithAuthors = booksWithAuthors.filter((book) => {
      if (!book.genres) return false;
      const bookGenres = book.genres.toLowerCase();
      return filters.genres!.every(g => bookGenres.includes(g.toLowerCase()));
    });
  }

  // Tags filter in JavaScript
  if (filters.tags && filters.tags.length > 0) {
    booksWithAuthors = booksWithAuthors.filter((book) => {
      if (!book.tags) return false;
      const bookTags = book.tags.toLowerCase();
      return filters.tags!.every(t => bookTags.includes(t.toLowerCase()));
    });
  }

  return booksWithAuthors;
}

/**
 * Get unique authors list
 */
export async function getAuthors(): Promise<string[]> {
  const database = await getDatabase();
  const result = await database.getAllAsync<{ name: string }>(
    'SELECT DISTINCT name FROM authors ORDER BY name'
  );
  return result.map(r => r.name);
}

/**
 * Get unique formats list
 */
export async function getFormats(): Promise<string[]> {
  const database = await getDatabase();
  const result = await database.getAllAsync<{ format: string }>(
    'SELECT DISTINCT format FROM books WHERE format IS NOT NULL ORDER BY format'
  );
  return result.map(r => r.format);
}

/**
 * Get unique languages list
 */
export async function getLanguages(): Promise<string[]> {
  const database = await getDatabase();
  const result = await database.getAllAsync<{ language: string }>(
    'SELECT DISTINCT language FROM books WHERE language IS NOT NULL ORDER BY language'
  );
  return result.map(r => r.language);
}

/**
 * Get reading sessions for a book
 */
export async function getReadingSessions(bookId: string): Promise<ReadingSession[]> {
  const database = await getDatabase();

  return database.getAllAsync<ReadingSession>(
    'SELECT * FROM reading_sessions WHERE bookId = ? ORDER BY createdAt DESC',
    [bookId]
  );
}

/**
 * Get all storage locations
 */
export async function getStorageLocations(): Promise<StorageLocation[]> {
  const database = await getDatabase();

  return database.getAllAsync<StorageLocation>(
    'SELECT * FROM storage_locations WHERE is_active = 1 ORDER BY sort_order'
  );
}

/**
 * Get books count
 */
export async function getBooksCount(): Promise<number> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM books'
  );
  return result?.count ?? 0;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
    initPromise = null;
  }
}

/**
 * Reset database state (for sync)
 */
export function resetDatabase(): void {
  db = null;
  initPromise = null;
}

// ============ Collections ============

/**
 * Collection with book count
 */
export interface CollectionWithCount extends Collection {
  bookCount: number;
}

/**
 * Get all collections with book counts
 */
export async function getAllCollections(): Promise<CollectionWithCount[]> {
  const database = await getDatabase();

  const collections = await database.getAllAsync<CollectionWithCount>(`
    SELECT c.*,
      (SELECT COUNT(*) FROM collection_books cb WHERE cb.collectionId = c.id) as bookCount
    FROM collections c
    ORDER BY c.name COLLATE NOCASE
  `);

  return collections;
}

/**
 * Get a single collection by ID
 */
export async function getCollectionById(id: string): Promise<Collection | null> {
  const database = await getDatabase();

  return database.getFirstAsync<Collection>(
    'SELECT * FROM collections WHERE id = ?',
    [id]
  );
}

/**
 * Get books in a collection
 */
export async function getCollectionBooks(collectionId: string): Promise<BookWithAuthors[]> {
  const database = await getDatabase();

  const collection = await getCollectionById(collectionId);
  if (!collection) return [];

  if (collection.type === 'filter' && collection.filters) {
    // Dynamic filter collection - parse filters and apply
    try {
      const filters = JSON.parse(collection.filters) as BookFilters;
      return filterBooks(filters);
    } catch (e) {
      console.error('[DB] Failed to parse collection filters:', e);
      return [];
    }
  }

  // Static collection - fetch books by junction table
  const books = await database.getAllAsync<Book>(`
    SELECT b.* FROM books b
    JOIN collection_books cb ON cb.bookId = b.id
    WHERE cb.collectionId = ?
    ORDER BY b.title COLLATE NOCASE
  `, [collectionId]);

  return attachAuthorsToBooks(database, books);
}

/**
 * Get collections count
 */
export async function getCollectionsCount(): Promise<number> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM collections'
  );
  return result?.count ?? 0;
}

/**
 * Create a new collection
 */
export async function createCollection(
  name: string,
  type: 'static' | 'filter' = 'static',
  filters: string | null = null
): Promise<string> {
  const database = await getDatabase();
  const id = generateId();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO collections (id, name, type, filters, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, type, filters, now, now]
  );

  return id;
}

/**
 * Update a collection
 */
export async function updateCollection(
  id: string,
  updates: { name?: string; filters?: string | null }
): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();

  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | null)[] = [now];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.filters !== undefined) {
    setClauses.push('filters = ?');
    values.push(updates.filters);
  }

  values.push(id);

  await database.runAsync(
    `UPDATE collections SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Delete a collection
 */
export async function deleteCollection(id: string): Promise<void> {
  const database = await getDatabase();

  // Delete junction table entries first
  await database.runAsync(
    'DELETE FROM collection_books WHERE collectionId = ?',
    [id]
  );

  // Delete the collection
  await database.runAsync(
    'DELETE FROM collections WHERE id = ?',
    [id]
  );
}

/**
 * Add a book to a static collection
 */
export async function addBookToCollection(
  collectionId: string,
  bookId: string
): Promise<void> {
  const database = await getDatabase();

  // Check if already exists
  const existing = await database.getFirstAsync<{ collectionId: string }>(
    'SELECT collectionId FROM collection_books WHERE collectionId = ? AND bookId = ?',
    [collectionId, bookId]
  );

  if (!existing) {
    await database.runAsync(
      'INSERT INTO collection_books (collectionId, bookId) VALUES (?, ?)',
      [collectionId, bookId]
    );
  }
}

/**
 * Remove a book from a static collection
 */
export async function removeBookFromCollection(
  collectionId: string,
  bookId: string
): Promise<void> {
  const database = await getDatabase();

  await database.runAsync(
    'DELETE FROM collection_books WHERE collectionId = ? AND bookId = ?',
    [collectionId, bookId]
  );
}
