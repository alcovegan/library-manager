/**
 * Utility functions for book covers
 */

import { Paths, Directory } from 'expo-file-system';

/**
 * Get the local URI for a book cover
 * @param coverPath - The cover filename (from book.coverPath)
 * @returns The full local file URI or null if no cover
 */
export function getCoverUri(coverPath: string | null): string | null {
  if (!coverPath) return null;

  const coversDir = new Directory(Paths.document, 'covers');
  // coverPath might be just filename or path like "covers/filename.jpg"
  const filename = coverPath.includes('/')
    ? coverPath.split('/').pop()
    : coverPath;

  if (!filename) return null;

  return `${coversDir.uri}/${filename}`;
}
