/**
 * Database operations for entity-level sync (Desktop)
 * Exports all entities to SyncPayload and imports with merge
 */

const { SCHEMA_VERSION } = require('@library-manager/shared');

// Sync payload version
const SYNC_PAYLOAD_VERSION = 1;

/**
 * Export all database entities to SyncPayload
 * @param {object} ctx - Database context with db property
 * @param {string} deviceId - Device identifier
 * @param {string} deviceName - Device display name
 * @param {string} platform - Platform identifier
 * @returns {object} SyncPayload
 */
function exportDatabaseToPayload(ctx, deviceId, deviceName, platform) {
  const { db } = ctx;

  // Helper to run query and get all rows
  const getAll = (sql) => {
    const stmt = db.prepare(sql);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  };

  // Export all entities including soft-deleted ones
  const books = getAll('SELECT * FROM books');
  const authors = getAll('SELECT * FROM authors');
  const bookAuthors = getAll('SELECT * FROM book_authors');
  const collections = getAll('SELECT * FROM collections');
  const collectionBooks = getAll('SELECT * FROM collection_books');
  const storageLocations = getAll('SELECT * FROM storage_locations');
  const bookStorageHistory = getAll('SELECT * FROM book_storage_history');
  const readingSessions = getAll('SELECT * FROM reading_sessions');
  const filterPresets = getAll('SELECT * FROM filter_presets');
  const vocabCustom = getAll('SELECT * FROM vocab_custom');

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
 * @param {object} ctx - Database context with db property
 * @param {object} remotePayload - SyncPayload from cloud
 * @returns {object} MergeSummary
 */
function importPayloadWithMerge(ctx, remotePayload) {
  const { db } = ctx;

  // Helper to run query and get all rows
  const getAll = (sql) => {
    const stmt = db.prepare(sql);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  };

  // Export current local state
  const localBooks = getAll('SELECT * FROM books');
  const localAuthors = getAll('SELECT * FROM authors');
  const localBookAuthors = getAll('SELECT * FROM book_authors');
  const localCollections = getAll('SELECT * FROM collections');
  const localCollectionBooks = getAll('SELECT * FROM collection_books');
  const localStorageLocations = getAll('SELECT * FROM storage_locations');
  const localBookStorageHistory = getAll('SELECT * FROM book_storage_history');
  const localReadingSessions = getAll('SELECT * FROM reading_sessions');
  const localFilterPresets = getAll('SELECT * FROM filter_presets');
  const localVocabCustom = getAll('SELECT * FROM vocab_custom');

  // Merge each entity type
  const booksMerge = mergeEntityCollection(localBooks, remotePayload.entities.books);
  const authorsMerge = mergeEntityCollection(localAuthors, remotePayload.entities.authors);
  const collectionsMerge = mergeEntityCollection(localCollections, remotePayload.entities.collections);
  const storageLocationsMerge = mergeEntityCollection(localStorageLocations, remotePayload.entities.storageLocations);
  const readingSessionsMerge = mergeEntityCollection(localReadingSessions, remotePayload.entities.readingSessions);
  const filterPresetsMerge = mergeEntityCollection(localFilterPresets, remotePayload.entities.filterPresets);
  const vocabCustomMerge = mergeEntityCollection(localVocabCustom, remotePayload.entities.vocabCustom);

  // For book_storage_history, use simpler merge (no updatedAt, just add missing)
  const bookStorageHistoryMerge = mergeBookStorageHistory(localBookStorageHistory, remotePayload.entities.bookStorageHistory);

  // Create merged maps for relationship merging
  const mergedBooksMap = createMergedMap(booksMerge, localBooks);
  const mergedAuthorsMap = createMergedMap(authorsMerge, localAuthors);
  const mergedCollectionsMap = createMergedMap(collectionsMerge, localCollections);

  // Merge M:N relationships
  const mergedBookAuthors = mergeBookAuthorsRelations(
    localBookAuthors,
    remotePayload.entities.bookAuthors,
    mergedBooksMap,
    mergedAuthorsMap
  );
  const mergedCollectionBooks = mergeCollectionBooksRelations(
    localCollectionBooks,
    remotePayload.entities.collectionBooks,
    mergedCollectionsMap,
    mergedBooksMap
  );

  // Apply changes in a transaction
  db.run('BEGIN TRANSACTION');

  try {
    // Apply books merge
    applyMerge(db, 'books', booksMerge, getBookColumns());

    // Apply authors merge
    applyMerge(db, 'authors', authorsMerge, getAuthorColumns());

    // Apply collections merge
    applyMerge(db, 'collections', collectionsMerge, getCollectionColumns());

    // Apply storage locations merge
    applyMerge(db, 'storage_locations', storageLocationsMerge, getStorageLocationColumns());

    // Apply reading sessions merge
    applyMerge(db, 'reading_sessions', readingSessionsMerge, getReadingSessionColumns());

    // Apply filter presets merge
    applyMerge(db, 'filter_presets', filterPresetsMerge, getFilterPresetColumns());

    // Apply vocab custom merge
    applyMerge(db, 'vocab_custom', vocabCustomMerge, getVocabCustomColumns());

    // Apply book storage history merge
    applyBookStorageHistoryMerge(db, bookStorageHistoryMerge);

    // Rebuild M:N relationships
    rebuildBookAuthors(db, mergedBookAuthors);
    rebuildCollectionBooks(db, mergedCollectionBooks);

    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  // Build summary
  const summary = {
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
      booksMerge.toInsert.length + booksMerge.toUpdate.length + booksMerge.toDelete.length +
      authorsMerge.toInsert.length + authorsMerge.toUpdate.length +
      collectionsMerge.toInsert.length + collectionsMerge.toUpdate.length,
  };

  console.log('📊 Merge summary:', JSON.stringify(summary));
  return summary;
}

// ===== Merge utilities (inline since we can't import TS from JS easily) =====

function mergeEntity(local, remote) {
  if (!local && !remote) {
    return { result: null, action: 'skip' };
  }
  if (!local && remote) {
    if (remote.deleted_at) {
      return { result: null, action: 'skip' };
    }
    return { result: remote, action: 'insert' };
  }
  if (local && !remote) {
    return { result: local, action: 'keep' };
  }
  // Both exist - compare timestamps (LWW)
  const localTime = new Date(local.updatedAt || local.updated_at || 0).getTime();
  const remoteTime = new Date(remote.updatedAt || remote.updated_at || 0).getTime();

  if (remoteTime > localTime) {
    if (remote.deleted_at) {
      return { result: remote, action: 'delete' };
    }
    return { result: remote, action: 'update' };
  }
  return { result: local, action: 'keep' };
}

function mergeEntityCollection(localEntities, remoteEntities) {
  const localMap = new Map(localEntities.map(e => [e.id, e]));
  const remoteMap = new Map(remoteEntities.map(e => [e.id, e]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  const result = {
    toInsert: [],
    toUpdate: [],
    toDelete: [],
    unchanged: [],
  };

  for (const id of allIds) {
    const local = localMap.get(id) || null;
    const remote = remoteMap.get(id) || null;
    const { result: merged, action } = mergeEntity(local, remote);

    switch (action) {
      case 'insert':
        result.toInsert.push(merged);
        break;
      case 'update':
        result.toUpdate.push(merged);
        break;
      case 'delete':
        result.toDelete.push(merged);
        break;
      case 'keep':
      case 'skip':
        if (local && !local.deleted_at) {
          result.unchanged.push(local);
        }
        break;
    }
  }

  return result;
}

function mergeBookStorageHistory(local, remote) {
  const localIds = new Set(local.map(h => h.id));
  const toInsert = remote.filter(h => !localIds.has(h.id) && !h.deleted_at);
  return { toInsert, unchanged: local };
}

function createMergedMap(mergeResult, localEntities) {
  const map = new Map();
  for (const entity of localEntities) {
    if (!entity.deleted_at) {
      map.set(entity.id, entity);
    }
  }
  for (const entity of mergeResult.toInsert) {
    map.set(entity.id, entity);
  }
  for (const entity of mergeResult.toUpdate) {
    map.set(entity.id, entity);
  }
  for (const entity of mergeResult.toDelete) {
    map.set(entity.id, entity);
  }
  return map;
}

function mergeBookAuthorsRelations(local, remote, booksMap, authorsMap) {
  const result = [];
  const seen = new Set();
  const all = [...local, ...remote];

  for (const rel of all) {
    const key = `${rel.bookId}:${rel.authorId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const book = booksMap.get(rel.bookId);
    const author = authorsMap.get(rel.authorId);
    if (book && !book.deleted_at && author && !author.deleted_at) {
      result.push(rel);
    }
  }
  return result;
}

function mergeCollectionBooksRelations(local, remote, collectionsMap, booksMap) {
  const result = [];
  const seen = new Set();
  const all = [...local, ...remote];

  for (const rel of all) {
    const key = `${rel.collectionId}:${rel.bookId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const collection = collectionsMap.get(rel.collectionId);
    const book = booksMap.get(rel.bookId);
    if (collection && !collection.deleted_at && book && !book.deleted_at) {
      result.push(rel);
    }
  }
  return result;
}

function toStats(result) {
  return {
    inserted: result.toInsert.length,
    updated: result.toUpdate.length,
    deleted: result.toDelete.length,
    unchanged: result.unchanged.length,
  };
}

// ===== Apply merge to database =====

function applyMerge(db, table, merge, columns) {
  // Insert new records
  for (const entity of merge.toInsert) {
    const values = columns.map(col => entity[col] ?? null);
    const placeholders = columns.map(() => '?').join(', ');
    const stmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
    stmt.run(values);
    stmt.free();
  }

  // Update existing records
  for (const entity of merge.toUpdate) {
    const values = columns.map(col => entity[col] ?? null);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const stmt = db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`);
    stmt.run([...values, entity.id]);
    stmt.free();
  }

  // Soft delete records
  // Determine the correct column name for updated timestamp (some tables use snake_case)
  const updatedAtCol = columns.includes('updated_at') ? 'updated_at' : 'updatedAt';
  for (const entity of merge.toDelete) {
    const deletedAt = entity.deleted_at;
    const updatedAt = entity.updatedAt || entity.updated_at;
    const stmt = db.prepare(`UPDATE ${table} SET deleted_at = ?, ${updatedAtCol} = ? WHERE id = ?`);
    stmt.run([deletedAt, updatedAt, entity.id]);
    stmt.free();
  }
}

function applyBookStorageHistoryMerge(db, merge) {
  const columns = ['id', 'bookId', 'fromLocationId', 'toLocationId', 'action', 'person', 'note', 'created_at', 'deleted_at'];
  for (const entity of merge.toInsert) {
    const values = columns.map(col => entity[col] ?? null);
    const placeholders = columns.map(() => '?').join(', ');
    const stmt = db.prepare(`INSERT OR REPLACE INTO book_storage_history (${columns.join(', ')}) VALUES (${placeholders})`);
    stmt.run(values);
    stmt.free();
  }
}

function rebuildBookAuthors(db, relations) {
  db.run('DELETE FROM book_authors');
  const stmt = db.prepare('INSERT INTO book_authors (bookId, authorId) VALUES (?, ?)');
  for (const rel of relations) {
    stmt.run([rel.bookId, rel.authorId]);
  }
  stmt.free();
}

function rebuildCollectionBooks(db, relations) {
  db.run('DELETE FROM collection_books');
  const stmt = db.prepare('INSERT INTO collection_books (collectionId, bookId) VALUES (?, ?)');
  for (const rel of relations) {
    stmt.run([rel.collectionId, rel.bookId]);
  }
  stmt.free();
}

// ===== Column definitions =====

function getBookColumns() {
  return [
    'id', 'title', 'coverPath', 'createdAt', 'updatedAt', 'deleted_at',
    'series', 'seriesIndex', 'year', 'publisher', 'isbn', 'language',
    'rating', 'notes', 'tags', 'titleAlt', 'authorsAlt', 'format', 'genres',
    'storageLocationId', 'goodreadsRating', 'goodreadsRatingsCount',
    'goodreadsReviewsCount', 'goodreadsUrl', 'originalTitleEn',
    'originalAuthorsEn', 'goodreadsFetchedAt', 'currentReadingSessionId',
  ];
}

function getAuthorColumns() {
  return ['id', 'name', 'updatedAt', 'deleted_at'];
}

function getCollectionColumns() {
  return ['id', 'name', 'type', 'filters', 'created_at', 'updated_at', 'deleted_at'];
}

function getStorageLocationColumns() {
  return ['id', 'code', 'title', 'note', 'is_active', 'sort_order', 'created_at', 'updated_at', 'deleted_at'];
}

function getReadingSessionColumns() {
  return ['id', 'bookId', 'status', 'startedAt', 'finishedAt', 'notes', 'createdAt', 'updatedAt', 'deleted_at'];
}

function getFilterPresetColumns() {
  return ['id', 'name', 'slug', 'filters', 'created_at', 'updated_at', 'deleted_at'];
}

function getVocabCustomColumns() {
  return ['id', 'domain', 'value', 'createdAt', 'updatedAt', 'deleted_at'];
}

module.exports = {
  exportDatabaseToPayload,
  importPayloadWithMerge,
  SYNC_PAYLOAD_VERSION,
};
