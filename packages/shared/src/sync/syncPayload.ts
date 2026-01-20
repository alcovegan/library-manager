/**
 * Sync Payload Types for Entity-Level Merge Sync
 *
 * Instead of syncing the entire database file, we export entities as JSON
 * and merge them based on updatedAt timestamps (Last-Write-Wins strategy).
 */

// Current payload format version
export const SYNC_PAYLOAD_VERSION = 1;

/**
 * Base interface for syncable entities
 * All entities must have id, updatedAt for LWW, and deleted_at for soft delete
 */
export interface SyncEntity {
  id: string;
  updatedAt: string;      // ISO timestamp - key for LWW comparison
  deleted_at: string | null;
}

/**
 * Book entity for sync
 */
export interface SyncBook extends SyncEntity {
  title: string;
  coverPath: string | null;
  createdAt: string;
  series: string | null;
  seriesIndex: number | null;
  year: number | null;
  publisher: string | null;
  isbn: string | null;
  language: string | null;
  rating: number | null;
  notes: string | null;
  tags: string | null;          // JSON array as string
  titleAlt: string | null;
  authorsAlt: string | null;    // JSON array as string
  format: string | null;
  genres: string | null;        // JSON array as string
  storageLocationId: string | null;
  goodreadsRating: number | null;
  goodreadsRatingsCount: number | null;
  goodreadsReviewsCount: number | null;
  goodreadsUrl: string | null;
  originalTitleEn: string | null;
  originalAuthorsEn: string | null;
  goodreadsFetchedAt: string | null;
  currentReadingSessionId: string | null;
}

/**
 * Author entity for sync
 */
export interface SyncAuthor extends SyncEntity {
  name: string;
}

/**
 * Collection entity for sync
 */
export interface SyncCollection extends SyncEntity {
  name: string;
  type: 'static' | 'filter';
  filters: string | null;       // JSON as string
  created_at: string;
  updated_at: string;
}

/**
 * Storage location entity for sync
 */
export interface SyncStorageLocation extends SyncEntity {
  code: string;
  title: string | null;
  note: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Reading session entity for sync
 */
export interface SyncReadingSession extends SyncEntity {
  bookId: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  notes: string | null;
  createdAt: string;
}

/**
 * Filter preset entity for sync
 */
export interface SyncFilterPreset extends SyncEntity {
  name: string;
  slug: string | null;
  filters: string;              // JSON as string
  created_at: string;
  updated_at: string;
}

/**
 * Custom vocabulary entity for sync
 */
export interface SyncVocabCustom extends SyncEntity {
  domain: string;
  value: string;
  createdAt: string;
}

/**
 * Book storage history entity for sync
 */
export interface SyncBookStorageHistory {
  id: string;
  bookId: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  action: string;
  person: string | null;
  note: string | null;
  created_at: string;
  deleted_at: string | null;
}

/**
 * M:N relationship: Book <-> Author
 */
export interface SyncBookAuthor {
  bookId: string;
  authorId: string;
}

/**
 * M:N relationship: Collection <-> Book
 */
export interface SyncCollectionBook {
  collectionId: string;
  bookId: string;
}

/**
 * Full sync payload containing all entities
 */
export interface SyncPayload {
  // Payload metadata
  version: number;              // SYNC_PAYLOAD_VERSION
  schemaVersion: number;        // DB schema version
  exportedAt: string;           // ISO timestamp when payload was created
  deviceId: string;
  deviceName: string;
  platform: string;

  // Entity collections
  entities: {
    books: SyncBook[];
    authors: SyncAuthor[];
    bookAuthors: SyncBookAuthor[];
    collections: SyncCollection[];
    collectionBooks: SyncCollectionBook[];
    storageLocations: SyncStorageLocation[];
    bookStorageHistory: SyncBookStorageHistory[];
    readingSessions: SyncReadingSession[];
    filterPresets: SyncFilterPreset[];
    vocabCustom: SyncVocabCustom[];
  };
}

/**
 * Result of merging a single entity
 */
export type MergeAction = 'insert' | 'update' | 'delete' | 'keep' | 'skip';

export interface EntityMergeResult<T> {
  result: T | null;
  action: MergeAction;
}

/**
 * Result of merging an entity collection
 */
export interface MergeResult<T> {
  toInsert: T[];
  toUpdate: T[];
  toDelete: T[];    // Entities to soft delete (set deleted_at)
  unchanged: T[];
}

/**
 * Summary of the entire merge operation
 */
export interface MergeSummary {
  books: MergeStats;
  authors: MergeStats;
  collections: MergeStats;
  storageLocations: MergeStats;
  readingSessions: MergeStats;
  filterPresets: MergeStats;
  vocabCustom: MergeStats;
  bookStorageHistory: MergeStats;
  totalChanges: number;
}

export interface MergeStats {
  inserted: number;
  updated: number;
  deleted: number;
  unchanged: number;
}
