/**
 * Sync Manager for mobile app
 * Handles downloading data from S3 and importing into local SQLite
 */

import { SCHEMA_VERSION } from '@library-manager/shared';
import {
  initializeS3,
  testConnection,
  downloadJson,
  downloadBinary,
  listFiles,
  uploadJson,
  isConfigured,
  S3Config,
} from './s3Client';
import { emit, AppEvents } from './events';
import {
  loadS3Config,
  saveS3Config,
  getDeviceId,
  saveLastSync,
  getLastSync,
} from './settings';
import { getDatabase, closeDatabase, resetDatabase } from './database';
import { Paths, Directory, File } from 'expo-file-system';

// S3 paths (same as desktop)
const S3_PATHS = {
  DATABASE: 'database/current/library.db',
  METADATA: 'metadata/sync.json',
  SETTINGS: 'settings/settings.json',
  COVERS: 'covers/',
  DEVICES: 'devices/',
};

interface SyncMetadata {
  lastSync: string;
  deviceId: string;
  schemaVersion: number;
  appVersion: string;
}

interface SyncResult {
  success: boolean;
  error?: string;
  booksImported?: number;
  coversDownloaded?: number;
}

/**
 * Initialize sync with saved config
 */
export async function initializeSync(): Promise<boolean> {
  const config = await loadS3Config();
  if (!config) {
    console.log('[Sync] No S3 config found');
    return false;
  }

  initializeS3(config);
  return true;
}

/**
 * Configure and test S3 connection
 */
export async function configureSync(config: S3Config): Promise<{ ok: boolean; error?: string }> {
  initializeS3(config);

  const result = await testConnection();
  if (result.ok) {
    await saveS3Config(config);
  }

  return result;
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<{
  configured: boolean;
  lastSync: string | null;
  deviceId: string;
}> {
  const configured = isConfigured() || (await loadS3Config()) !== null;
  const lastSync = await getLastSync();
  const deviceId = await getDeviceId();

  return { configured, lastSync, deviceId };
}

/**
 * Download data from S3 and import into local database
 */
export async function syncDown(): Promise<SyncResult> {
  console.log('[Sync] Starting sync down...');

  try {
    // Ensure S3 is initialized
    if (!isConfigured()) {
      const initialized = await initializeSync();
      if (!initialized) {
        return { success: false, error: 'S3 not configured' };
      }
    }

    // Check remote metadata for compatibility
    const remoteMetadata = await downloadJson<SyncMetadata>(S3_PATHS.METADATA);
    if (remoteMetadata) {
      if (remoteMetadata.schemaVersion > SCHEMA_VERSION) {
        return {
          success: false,
          error: `Remote schema version (${remoteMetadata.schemaVersion}) is newer than local (${SCHEMA_VERSION}). Please update the app.`,
        };
      }
    }

    // Download and import database
    const dbData = await downloadBinary(S3_PATHS.DATABASE);
    if (!dbData) {
      return { success: false, error: 'No database found on S3' };
    }

    // Import data from the downloaded database
    const importResult = await importDatabaseFromBytes(dbData);

    // Download covers
    const coversResult = await downloadCovers();

    // Update device metadata on S3
    const deviceId = await getDeviceId();
    await uploadJson(`${S3_PATHS.DEVICES}${deviceId}/metadata.json`, {
      deviceId,
      platform: 'mobile',
      lastSync: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
    });

    // Save last sync timestamp
    await saveLastSync(new Date().toISOString());

    // Notify UI that data has changed
    emit(AppEvents.DATA_CHANGED);

    console.log('[Sync] Sync down completed successfully');
    return {
      success: true,
      booksImported: importResult.booksImported,
      coversDownloaded: coversResult.count,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sync] Sync down failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Import data from SQLite database bytes into local database
 * Replaces the database file directly
 */
async function importDatabaseFromBytes(
  dbBytes: Uint8Array
): Promise<{ booksImported: number }> {
  console.log('[Sync] Importing database...');

  // Close current database connection first
  await closeDatabase();

  // Get the path where expo-sqlite stores the database
  // expo-sqlite stores databases in the document directory with SQLite/ prefix
  const dbDir = new Directory(Paths.document, 'SQLite');
  if (!dbDir.exists) {
    dbDir.create();
  }

  const dbFile = new File(dbDir, 'library.db');

  // Write the downloaded database, replacing the existing one
  console.log('[Sync] Writing database to:', dbFile.uri);
  dbFile.write(dbBytes);

  // Reset database state so it will be reopened
  resetDatabase();

  // Reopen and count books
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM books');
  const booksImported = result?.count ?? 0;

  console.log(`[Sync] Import completed: ${booksImported} books`);
  return { booksImported };
}

/**
 * Download cover images from S3
 */
async function downloadCovers(): Promise<{ count: number }> {
  console.log('[Sync] Downloading covers...');

  const coversDir = new Directory(Paths.document, 'covers');

  // Ensure covers directory exists
  if (!coversDir.exists) {
    coversDir.create();
  }

  // List covers on S3
  const coverFiles = await listFiles(S3_PATHS.COVERS);
  let count = 0;

  for (const s3Key of coverFiles) {
    if (!s3Key || s3Key === S3_PATHS.COVERS) continue;

    const filename = s3Key.replace(S3_PATHS.COVERS, '');
    if (!filename) continue;

    const localFile = new File(coversDir, filename);

    // Check if file already exists
    if (localFile.exists) {
      continue;
    }

    // Download cover
    const coverData = await downloadBinary(s3Key);
    if (coverData) {
      // Write binary data to file
      localFile.write(coverData);
      count++;
    }
  }

  console.log(`[Sync] Downloaded ${count} new covers`);
  return { count };
}

/**
 * Get covers directory path
 */
export function getCoversDirectory(): string {
  return new Directory(Paths.document, 'covers').uri;
}
