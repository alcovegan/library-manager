/**
 * Database operations for entity-level sync
 * Exports all entities to SyncPayload and imports with merge
 */

import { getDatabase } from '../database';
import { SCHEMA_VERSION } from '@library-manager/shared';
import type {
  SyncPayload,
  SyncBook,
  SyncAuthor,
  SyncCollection,
  SyncStorageLocation,
  SyncReadingSession,
  SyncFilterPreset,
  SyncVocabCustom,
  SyncBookStorageHistory,
  SyncBookAuthor,
  SyncCollectionBook,
  MergeResult,
  MergeSummary,
  MergeStats,
} from '@library-manager/shared/src/sync/syncPayload';
import {
  mergeEntityCollection,
  mergeBookAuthors,
  mergeCollectionBooks,
  createMergedMap,
} from '@library-manager/shared/src/sync/mergeUtils';

// Sync payload version
const SYNC_PAYLOAD_VERSION = 1;

/**
 * Export all database entities to SyncPayload
 */
export async function exportDatabaseToPayload(
  deviceId: string,
  deviceName: string,
  platform: string
): Promise<SyncPayload> {
  const database = await getDatabase();

  // Export all entities including soft-deleted ones
  const books = await database.getAllAsync<SyncBook>('SELECT * FROM books');
  const authors = await database.getAllAsync<SyncAuthor>('SELECT * FROM authors');
  const bookAuthors = await database.getAllAsync<SyncBookAuthor>('SELECT * FROM book_authors');
  const collections = await database.getAllAsync<SyncCollection>('SELECT * FROM collections');
  const collectionBooks = await database.getAllAsync<SyncCollectionBook>(
    'SELECT * FROM collection_books'
  );
  const storageLocations = await database.getAllAsync<SyncStorageLocation>(
    'SELECT * FROM storage_locations'
  );
  const bookStorageHistory = await database.getAllAsync<SyncBookStorageHistory>(
    'SELECT * FROM book_storage_history'
  );
  const readingSessions = await database.getAllAsync<SyncReadingSession>(
    'SELECT * FROM reading_sessions'
  );
  const filterPresets = await database.getAllAsync<SyncFilterPreset>(
    'SELECT * FROM filter_presets'
  );
  const vocabCustom = await database.getAllAsync<SyncVocabCustom>('SELECT * FROM vocab_custom');

  return {
    version: SYNC_PAYLOAD_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    deviceId,
    deviceName,
    platform,
    entities: {
      books,
      authors,
      bookAuthors,
      collections,
      collectionBooks,
      storageLocations,
      bookStorageHistory,
      readingSessions,
      filterPresets,
      vocabCustom,
    },
  };
}

/**
 * Import SyncPayload with merge into local database
 * Uses Last-Write-Wins strategy based on updatedAt
 */
export async function importPayloadWithMerge(remotePayload: SyncPayload): Promise<MergeSummary> {
  const database = await getDatabase();

  // Export current local state
  const localBooks = await database.getAllAsync<SyncBook>('SELECT * FROM books');
  const localAuthors = await database.getAllAsync<SyncAuthor>('SELECT * FROM authors');
  const localBookAuthors = await database.getAllAsync<SyncBookAuthor>(
    'SELECT * FROM book_authors'
  );
  const localCollections = await database.getAllAsync<SyncCollection>('SELECT * FROM collections');
  const localCollectionBooks = await database.getAllAsync<SyncCollectionBook>(
    'SELECT * FROM collection_books'
  );
  const localStorageLocations = await database.getAllAsync<SyncStorageLocation>(
    'SELECT * FROM storage_locations'
  );
  const localBookStorageHistory = await database.getAllAsync<SyncBookStorageHistory>(
    'SELECT * FROM book_storage_history'
  );
  const localReadingSessions = await database.getAllAsync<SyncReadingSession>(
    'SELECT * FROM reading_sessions'
  );
  const localFilterPresets = await database.getAllAsync<SyncFilterPreset>(
    'SELECT * FROM filter_presets'
  );
  const localVocabCustom = await database.getAllAsync<SyncVocabCustom>(
    'SELECT * FROM vocab_custom'
  );

  // Merge each entity type
  const booksMerge = mergeEntityCollection(localBooks, remotePayload.entities.books);
  const authorsMerge = mergeEntityCollection(localAuthors, remotePayload.entities.authors);
  const collectionsMerge = mergeEntityCollection(
    localCollections,
    remotePayload.entities.collections
  );
  const storageLocationsMerge = mergeEntityCollection(
    localStorageLocations,
    remotePayload.entities.storageLocations
  );
  const readingSessionsMerge = mergeEntityCollection(
    localReadingSessions,
    remotePayload.entities.readingSessions
  );
  const filterPresetsMerge = mergeEntityCollection(
    localFilterPresets,
    remotePayload.entities.filterPresets
  );
  const vocabCustomMerge = mergeEntityCollection(
    localVocabCustom,
    remotePayload.entities.vocabCustom
  );

  // For book_storage_history, use simpler merge (no updatedAt, just add missing)
  const bookStorageHistoryMerge = mergeBookStorageHistory(
    localBookStorageHistory,
    remotePayload.entities.bookStorageHistory
  );

  // Create merged maps for relationship merging
  const mergedBooksMap = createMergedMap(booksMerge, localBooks);
  const mergedAuthorsMap = createMergedMap(authorsMerge, localAuthors);
  const mergedCollectionsMap = createMergedMap(collectionsMerge, localCollections);

  // Merge M:N relationships
  const mergedBookAuthors = mergeBookAuthors(
    localBookAuthors,
    remotePayload.entities.bookAuthors,
    mergedBooksMap,
    mergedAuthorsMap
  );
  const mergedCollectionBooks = mergeCollectionBooks(
    localCollectionBooks,
    remotePayload.entities.collectionBooks,
    mergedCollectionsMap,
    mergedBooksMap
  );

  // Apply changes in a transaction
  await database.execAsync('BEGIN TRANSACTION');

  try {
    // Apply books merge
    await applyMerge(database, 'books', booksMerge, getBookColumns());

    // Apply authors merge
    await applyMerge(database, 'authors', authorsMerge, getAuthorColumns());

    // Apply collections merge
    await applyMerge(database, 'collections', collectionsMerge, getCollectionColumns());

    // Apply storage locations merge
    await applyMerge(
      database,
      'storage_locations',
      storageLocationsMerge,
      getStorageLocationColumns()
    );

    // Apply reading sessions merge
    await applyMerge(
      database,
      'reading_sessions',
      readingSessionsMerge,
      getReadingSessionColumns()
    );

    // Apply filter presets merge
    await applyMerge(database, 'filter_presets', filterPresetsMerge, getFilterPresetColumns());

    // Apply vocab custom merge
    await applyMerge(database, 'vocab_custom', vocabCustomMerge, getVocabCustomColumns());

    // Apply book storage history merge
    await applyBookStorageHistoryMerge(database, bookStorageHistoryMerge);

    // Rebuild M:N relationships
    await rebuildBookAuthors(database, mergedBookAuthors);
    await rebuildCollectionBooks(database, mergedCollectionBooks);

    await database.execAsync('COMMIT');
  } catch (error) {
    await database.execAsync('ROLLBACK');
    throw error;
  }

  // Build summary
  const summary: MergeSummary = {
    books: toStats(booksMerge),
    authors: toStats(authorsMerge),
    collections: toStats(collectionsMerge),
    storageLocations: toStats(storageLocationsMerge),
    readingSessions: toStats(readingSessionsMerge),
    filterPresets: toStats(filterPresetsMerge),
    vocabCustom: toStats(vocabCustomMerge),
    bookStorageHistory: {
      inserted: bookStorageHistoryMerge.toInsert.length,
      updated: 0,
      deleted: 0,
      unchanged: bookStorageHistoryMerge.unchanged.length,
    },
    totalChanges:
      booksMerge.toInsert.length +
      booksMerge.toUpdate.length +
      booksMerge.toDelete.length +
      authorsMerge.toInsert.length +
      authorsMerge.toUpdate.length +
      collectionsMerge.toInsert.length +
      collectionsMerge.toUpdate.length,
  };

  console.log('[SyncDB] Merge summary:', JSON.stringify(summary));
  return summary;
}

// Helper to convert MergeResult to MergeStats
function toStats<T>(result: MergeResult<T>): MergeStats {
  return {
    inserted: result.toInsert.length,
    updated: result.toUpdate.length,
    deleted: result.toDelete.length,
    unchanged: result.unchanged.length,
  };
}

// Merge book_storage_history (no updatedAt, just add missing by ID)
function mergeBookStorageHistory(
  local: SyncBookStorageHistory[],
  remote: SyncBookStorageHistory[]
): { toInsert: SyncBookStorageHistory[]; unchanged: SyncBookStorageHistory[] } {
  const localIds = new Set(local.map((h) => h.id));
  const toInsert = remote.filter((h) => !localIds.has(h.id) && !h.deleted_at);
  return { toInsert, unchanged: local };
}

// Apply merge results to a table
async function applyMerge<T extends { id: string }>(
  database: Awaited<ReturnType<typeof getDatabase>>,
  table: string,
  merge: MergeResult<T>,
  columns: string[]
): Promise<void> {
  // Insert new records
  for (const entity of merge.toInsert) {
    const values = columns.map((col) => (entity as Record<string, unknown>)[col]);
    const placeholders = columns.map(() => '?').join(', ');
    await database.runAsync(
      `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      values as (string | number | null)[]
    );
  }

  // Update existing records
  for (const entity of merge.toUpdate) {
    const values = columns.map((col) => (entity as Record<string, unknown>)[col]);
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    await database.runAsync(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [
      ...(values as (string | number | null)[]),
      entity.id,
    ]);
  }

  // Soft delete records
  for (const entity of merge.toDelete) {
    const deletedAt = (entity as Record<string, unknown>).deleted_at as string;
    const updatedAt = (entity as Record<string, unknown>).updatedAt as string;
    await database.runAsync(`UPDATE ${table} SET deleted_at = ?, updatedAt = ? WHERE id = ?`, [
      deletedAt,
      updatedAt,
      entity.id,
    ]);
  }
}

// Apply book storage history merge
async function applyBookStorageHistoryMerge(
  database: Awaited<ReturnType<typeof getDatabase>>,
  merge: { toInsert: SyncBookStorageHistory[]; unchanged: SyncBookStorageHistory[] }
): Promise<void> {
  const columns = [
    'id',
    'bookId',
    'fromLocationId',
    'toLocationId',
    'action',
    'person',
    'note',
    'created_at',
    'deleted_at',
  ];

  for (const entity of merge.toInsert) {
    const values = columns.map((col) => (entity as Record<string, unknown>)[col]);
    const placeholders = columns.map(() => '?').join(', ');
    await database.runAsync(
      `INSERT OR REPLACE INTO book_storage_history (${columns.join(', ')}) VALUES (${placeholders})`,
      values as (string | number | null)[]
    );
  }
}

// Rebuild book_authors table
async function rebuildBookAuthors(
  database: Awaited<ReturnType<typeof getDatabase>>,
  relations: SyncBookAuthor[]
): Promise<void> {
  await database.runAsync('DELETE FROM book_authors');
  for (const rel of relations) {
    await database.runAsync('INSERT INTO book_authors (bookId, authorId) VALUES (?, ?)', [
      rel.bookId,
      rel.authorId,
    ]);
  }
}

// Rebuild collection_books table
async function rebuildCollectionBooks(
  database: Awaited<ReturnType<typeof getDatabase>>,
  relations: SyncCollectionBook[]
): Promise<void> {
  await database.runAsync('DELETE FROM collection_books');
  for (const rel of relations) {
    await database.runAsync('INSERT INTO collection_books (collectionId, bookId) VALUES (?, ?)', [
      rel.collectionId,
      rel.bookId,
    ]);
  }
}

// Column definitions for each table
function getBookColumns(): string[] {
  return [
    'id',
    'title',
    'coverPath',
    'createdAt',
    'updatedAt',
    'deleted_at',
    'series',
    'seriesIndex',
    'year',
    'publisher',
    'isbn',
    'language',
    'rating',
    'notes',
    'tags',
    'titleAlt',
    'authorsAlt',
    'format',
    'genres',
    'storageLocationId',
    'goodreadsRating',
    'goodreadsRatingsCount',
    'goodreadsReviewsCount',
    'goodreadsUrl',
    'originalTitleEn',
    'originalAuthorsEn',
    'goodreadsFetchedAt',
    'currentReadingSessionId',
  ];
}

function getAuthorColumns(): string[] {
  return ['id', 'name', 'updatedAt', 'deleted_at'];
}

function getCollectionColumns(): string[] {
  return ['id', 'name', 'type', 'filters', 'created_at', 'updated_at', 'deleted_at'];
}

function getStorageLocationColumns(): string[] {
  return [
    'id',
    'code',
    'title',
    'note',
    'is_active',
    'sort_order',
    'created_at',
    'updated_at',
    'deleted_at',
  ];
}

function getReadingSessionColumns(): string[] {
  return [
    'id',
    'bookId',
    'status',
    'startedAt',
    'finishedAt',
    'notes',
    'createdAt',
    'updatedAt',
    'deleted_at',
  ];
}

function getFilterPresetColumns(): string[] {
  return ['id', 'name', 'slug', 'filters', 'created_at', 'updated_at', 'deleted_at'];
}

function getVocabCustomColumns(): string[] {
  return ['id', 'domain', 'value', 'createdAt', 'updatedAt', 'deleted_at'];
}
