/**
 * Merge Utilities for Entity-Level Sync
 *
 * Implements Last-Write-Wins (LWW) merge strategy based on updatedAt timestamps.
 * Handles soft deletes through deleted_at field.
 */

import type {
  SyncEntity,
  EntityMergeResult,
  MergeResult,
  MergeAction,
  SyncBookAuthor,
  SyncCollectionBook,
  SyncBook,
  SyncAuthor,
} from './syncPayload';

/**
 * Compare two ISO timestamp strings
 * Returns: positive if a > b, negative if a < b, 0 if equal
 */
export function compareTimestamps(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return new Date(a).getTime() - new Date(b).getTime();
}

/**
 * Get the updatedAt timestamp from an entity, handling both camelCase and snake_case
 */
function getUpdatedAt(entity: SyncEntity | Record<string, unknown>): string | undefined {
  return (entity as Record<string, unknown>).updatedAt as string | undefined
    || (entity as Record<string, unknown>).updated_at as string | undefined;
}

/**
 * Merge a single entity using Last-Write-Wins strategy
 *
 * Rules:
 * - Both null → skip
 * - Only remote exists → insert (if not deleted)
 * - Only local exists → keep (remote doesn't know about it yet)
 * - Both exist → compare updatedAt, newer wins
 * - If remote is deleted and newer → mark local as deleted
 */
export function mergeEntity<T extends SyncEntity>(
  local: T | null,
  remote: T | null
): EntityMergeResult<T> {
  // Both absent - nothing to do
  if (!local && !remote) {
    return { result: null, action: 'skip' };
  }

  // Only remote exists
  if (!local && remote) {
    // If remote is already deleted, no need to insert
    if (remote.deleted_at) {
      return { result: null, action: 'skip' };
    }
    return { result: remote, action: 'insert' };
  }

  // Only local exists - keep it (remote will get it on next sync up)
  if (local && !remote) {
    return { result: local, action: 'keep' };
  }

  // Both exist - compare timestamps (LWW)
  // Handle both updatedAt (camelCase) and updated_at (snake_case)
  const localTime = new Date(getUpdatedAt(local!) || 0).getTime();
  const remoteTime = new Date(getUpdatedAt(remote!) || 0).getTime();

  if (remoteTime > localTime) {
    // Remote is newer
    if (remote!.deleted_at) {
      // Remote was deleted - propagate deletion
      return { result: remote, action: 'delete' };
    }
    return { result: remote, action: 'update' };
  }

  // Local is newer or equal - keep local
  return { result: local, action: 'keep' };
}

/**
 * Merge a collection of entities using LWW strategy
 *
 * Creates a unified view by comparing each entity by ID
 */
export function mergeEntityCollection<T extends SyncEntity>(
  localEntities: T[],
  remoteEntities: T[]
): MergeResult<T> {
  const localMap = new Map(localEntities.map((e) => [e.id, e]));
  const remoteMap = new Map(remoteEntities.map((e) => [e.id, e]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  const result: MergeResult<T> = {
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
        result.toInsert.push(merged!);
        break;
      case 'update':
        result.toUpdate.push(merged!);
        break;
      case 'delete':
        result.toDelete.push(merged!);
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

/**
 * Merge M:N relationships (book_authors, collection_books)
 *
 * Strategy: A relationship exists if:
 * 1. It exists in either local or remote
 * 2. Both referenced entities exist and are not deleted
 *
 * For book_authors: keep if both book and author are alive
 * For collection_books: keep if both collection and book are alive
 */
export function mergeBookAuthors(
  localRelations: SyncBookAuthor[],
  remoteRelations: SyncBookAuthor[],
  mergedBooks: Map<string, SyncBook>,
  mergedAuthors: Map<string, SyncAuthor>
): SyncBookAuthor[] {
  const result: SyncBookAuthor[] = [];
  const seen = new Set<string>();

  const allRelations = [...localRelations, ...remoteRelations];

  for (const rel of allRelations) {
    const key = `${rel.bookId}:${rel.authorId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const book = mergedBooks.get(rel.bookId);
    const author = mergedAuthors.get(rel.authorId);

    // Keep relation only if both entities exist and are not deleted
    if (book && !book.deleted_at && author && !author.deleted_at) {
      result.push(rel);
    }
  }

  return result;
}

/**
 * Merge collection_books relationships
 */
export function mergeCollectionBooks<
  TCollection extends SyncEntity,
  TBook extends SyncEntity,
>(
  localRelations: SyncCollectionBook[],
  remoteRelations: SyncCollectionBook[],
  mergedCollections: Map<string, TCollection>,
  mergedBooks: Map<string, TBook>
): SyncCollectionBook[] {
  const result: SyncCollectionBook[] = [];
  const seen = new Set<string>();

  const allRelations = [...localRelations, ...remoteRelations];

  for (const rel of allRelations) {
    const key = `${rel.collectionId}:${rel.bookId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const collection = mergedCollections.get(rel.collectionId);
    const book = mergedBooks.get(rel.bookId);

    // Keep relation only if both entities exist and are not deleted
    if (collection && !collection.deleted_at && book && !book.deleted_at) {
      result.push(rel);
    }
  }

  return result;
}

/**
 * Create a map from merged results for easy lookup
 */
export function createMergedMap<T extends SyncEntity>(
  mergeResult: MergeResult<T>,
  localEntities: T[]
): Map<string, T> {
  const map = new Map<string, T>();

  // Add all unchanged local entities
  for (const entity of localEntities) {
    if (!entity.deleted_at) {
      map.set(entity.id, entity);
    }
  }

  // Override with merge results
  for (const entity of mergeResult.toInsert) {
    map.set(entity.id, entity);
  }
  for (const entity of mergeResult.toUpdate) {
    map.set(entity.id, entity);
  }
  for (const entity of mergeResult.toDelete) {
    // Mark as deleted in map
    map.set(entity.id, entity);
  }

  return map;
}

/**
 * Count changes in merge result
 */
export function countMergeChanges<T>(result: MergeResult<T>): number {
  return result.toInsert.length + result.toUpdate.length + result.toDelete.length;
}
