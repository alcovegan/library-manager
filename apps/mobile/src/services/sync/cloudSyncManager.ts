/**
 * Cloud Sync Manager for React Native
 * Manages sync operations using cloud storage providers (Yandex Disk, Google Drive, Dropbox)
 */

import { Paths, File, Directory } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import {
  BaseCloudProvider,
  CloudProviderType,
  ConnectionResult,
  QuotaInfo,
} from './providers/base';
import { cloudProviderFactory } from './providerFactory';

// Sync paths in cloud storage
export const SYNC_PATHS = {
  database: 'library.db',
  metadata: 'sync-metadata.json',
  settings: 'settings.json',
  covers: 'covers/',
  devices: 'devices/',
};

const DEVICE_ID_KEY = 'sync_device_id';

export interface SyncContext {
  schemaVersion: number;
  appVersion: string;
}

export interface DeviceMetadata {
  deviceId: string;
  deviceName: string;
  platform: string;
  lastSync: string | null;
  timestamp: string;
  version: string;
  schemaVersion: number;
  appVersion: string;
}

export interface SyncResult {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  notFound?: boolean;
  blocked?: boolean;
  reason?: string;
  success?: boolean;
  successful?: number;
  failed?: number;
}

export interface FullSyncResult {
  compatibility: SyncResult | null;
  remoteMetadata: unknown | null;
  metadata: SyncResult | null;
  database: SyncResult | null;
  settings: SyncResult | null;
  covers: SyncResult | null;
  sharedMetadata: SyncResult | null;
  blocked: boolean;
  success: boolean;
  error?: string;
  reason?: string;
}

export interface SyncStatus {
  isInitialized: boolean;
  providerType: CloudProviderType | null;
  providerName: string | null;
  deviceId: string | null;
  lastSync: string | null;
  connectionOk: boolean;
  userInfo?: { name: string; email?: string };
  quota?: QuotaInfo;
}

/**
 * Cloud Sync Manager for React Native
 */
class CloudSyncManager {
  private provider: BaseCloudProvider | null = null;
  private providerType: CloudProviderType | null = null;
  private deviceId: string | null = null;
  private dataPath: string;
  private lastSyncTime: string | null = null;
  private isInitialized = false;
  private syncContext: SyncContext = {
    schemaVersion: 0,
    appVersion: '0.0.0',
  };

  constructor() {
    this.dataPath = Paths.document.uri;
  }

  /**
   * Initialize sync manager with a provider
   */
  async initialize(providerType: CloudProviderType): Promise<boolean> {
    try {
      this.providerType = providerType;
      this.provider = await cloudProviderFactory.getAuthenticatedProvider(providerType);

      if (!this.provider) {
        throw new Error(`Provider ${providerType} not authenticated`);
      }

      this.deviceId = await this.getOrCreateDeviceId();

      console.log(`[CloudSync] Initialized:`, {
        provider: providerType,
        deviceId: this.deviceId,
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Failed to initialize:', message);
      throw error;
    }
  }

  /**
   * Set sync context with schema version info
   */
  setSyncContext(context: Partial<SyncContext>): void {
    this.syncContext = {
      schemaVersion: Number(context.schemaVersion || 0),
      appVersion: context.appVersion || '0.0.0',
    };
  }

  /**
   * Get or create unique device ID
   */
  private async getOrCreateDeviceId(): Promise<string> {
    try {
      const existingId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (existingId) {
        console.log('[CloudSync] Using existing device ID:', existingId);
        return existingId;
      }

      const newDeviceId = uuidv4();
      await SecureStore.setItemAsync(DEVICE_ID_KEY, newDeviceId);
      console.log('[CloudSync] Created new device ID:', newDeviceId);
      return newDeviceId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Failed to get/create device ID:', message);
      throw error;
    }
  }

  /**
   * Test connection to cloud provider
   */
  async testConnection(): Promise<{ ok: boolean; error?: string; userInfo?: ConnectionResult['userInfo'] }> {
    if (!this.provider) {
      return { ok: false, error: 'Provider not initialized' };
    }

    try {
      const result = await this.provider.testConnection();
      return { ok: result.success, error: result.error, userInfo: result.userInfo };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Connection test failed:', message);
      return { ok: false, error: message };
    }
  }

  /**
   * Get current device metadata
   */
  private getDeviceMetadata(): DeviceMetadata {
    return {
      deviceId: this.deviceId || '',
      deviceName: Device.deviceName || 'Unknown Device',
      platform: Platform.OS,
      lastSync: this.lastSyncTime,
      timestamp: new Date().toISOString(),
      version: '1.0.0', // TODO: Get from app config
      schemaVersion: Number(this.syncContext.schemaVersion || 0),
      appVersion: this.syncContext.appVersion || '0.0.0',
    };
  }

  /**
   * Upload device metadata
   */
  async uploadDeviceMetadata(): Promise<SyncResult> {
    if (!this.isInitialized || !this.provider) {
      return { ok: false, error: 'Sync manager not initialized' };
    }

    try {
      const metadata = this.getDeviceMetadata();
      const remotePath = `${SYNC_PATHS.devices}${this.deviceId}/metadata.json`;

      console.log('[CloudSync] Uploading device metadata');
      await this.provider.uploadJson(remotePath, metadata);
      console.log('[CloudSync] Device metadata uploaded successfully');
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Failed to upload device metadata:', message);
      return { ok: false, error: message };
    }
  }

  /**
   * Upload shared sync metadata
   */
  async uploadSharedMetadata(): Promise<SyncResult> {
    if (!this.isInitialized || !this.provider) {
      return { ok: false, error: 'Sync manager not initialized' };
    }

    try {
      const payload = {
        schemaVersion: Number(this.syncContext.schemaVersion || 0),
        appVersion: this.syncContext.appVersion || '0.0.0',
        deviceId: this.deviceId,
        syncedAt: new Date().toISOString(),
      };

      console.log('[CloudSync] Uploading sync metadata');
      await this.provider.uploadJson(SYNC_PATHS.metadata, payload);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Failed to upload sync metadata:', message);
      return { ok: false, error: message };
    }
  }

  /**
   * Download shared sync metadata
   */
  async downloadSharedMetadata(): Promise<{ ok: boolean; data?: unknown; notFound?: boolean; error?: string }> {
    if (!this.provider) {
      return { ok: false, error: 'Provider not initialized' };
    }

    try {
      console.log('[CloudSync] Downloading sync metadata');
      const data = await this.provider.downloadJson<Record<string, unknown>>(SYNC_PATHS.metadata);

      if (data === null) {
        return { ok: true, data: null, notFound: true };
      }

      return { ok: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Failed to download sync metadata:', message);
      return { ok: false, error: message };
    }
  }

  /**
   * Check schema compatibility
   */
  async ensureCompatibility(_direction: 'up' | 'down' = 'down'): Promise<SyncResult & { data?: unknown }> {
    try {
      const meta = await this.downloadSharedMetadata();
      if (!meta.ok) {
        return { ok: false, error: meta.error };
      }
      if (!meta.data) {
        return { ok: true, data: null };
      }

      const remoteMeta = meta.data as { schemaVersion?: number; appVersion?: string };
      const remoteSchema = Number(remoteMeta.schemaVersion || 0);
      const localSchema = Number(this.syncContext.schemaVersion || 0);

      if (remoteSchema > localSchema) {
        return {
          ok: false,
          blocked: true,
          reason: `Remote schema version ${remoteSchema} is newer than local ${localSchema}`,
        };
      }

      return { ok: true, data: meta.data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, error: message };
    }
  }

  /**
   * Upload database
   */
  async uploadDatabase(): Promise<SyncResult> {
    if (!this.isInitialized || !this.provider) {
      return { ok: false, error: 'Sync manager not initialized' };
    }

    try {
      const dbFile = new File(Paths.document, 'SQLite/library.db');

      if (!dbFile.exists) {
        console.log('[CloudSync] Database file not found, skipping upload');
        return { ok: true, skipped: true };
      }

      console.log('[CloudSync] Uploading database');
      await this.provider.uploadFile(dbFile.uri, SYNC_PATHS.database);

      console.log('[CloudSync] Database uploaded successfully');
      this.lastSyncTime = new Date().toISOString();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Failed to upload database:', message);
      return { ok: false, error: message };
    }
  }

  /**
   * Download database
   */
  async downloadDatabase(): Promise<SyncResult> {
    if (!this.isInitialized || !this.provider) {
      return { ok: false, error: 'Sync manager not initialized' };
    }

    try {
      // Ensure directory exists
      const dbDir = new Directory(Paths.document, 'SQLite');
      if (!dbDir.exists) {
        await dbDir.create();
      }

      const dbFile = new File(dbDir, 'library.db');

      console.log('[CloudSync] Downloading database');
      await this.provider.downloadFile(SYNC_PATHS.database, dbFile.uri);

      console.log('[CloudSync] Database downloaded successfully');
      this.lastSyncTime = new Date().toISOString();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found') || message.includes('404')) {
        return { ok: false, notFound: true, error: 'Database not found in cloud' };
      }
      console.error('[CloudSync] Failed to download database:', message);
      return { ok: false, error: message };
    }
  }

  /**
   * Upload covers
   */
  async uploadCovers(): Promise<SyncResult> {
    if (!this.isInitialized || !this.provider) {
      return { ok: false, error: 'Sync manager not initialized' };
    }

    try {
      const coversDir = new Directory(Paths.document, 'covers');

      if (!coversDir.exists) {
        console.log('[CloudSync] Covers directory not found, skipping upload');
        return { ok: true, skipped: true };
      }

      const files = await coversDir.list();
      const fileNames = files.map(f => f.name);
      console.log(`[CloudSync] Uploading ${fileNames.length} cover files...`);

      // Get existing remote covers
      let existingCovers = new Set<string>();
      try {
        const remoteFiles = await this.provider.listFiles(SYNC_PATHS.covers);
        existingCovers = new Set(remoteFiles.map((f) => f.name));
      } catch {
        // Folder might not exist yet
      }

      let successful = 0;
      let failed = 0;

      for (const file of files) {
        if (existingCovers.has(file.name)) {
          successful++;
          continue;
        }

        const remotePath = `${SYNC_PATHS.covers}${file.name}`;

        try {
          await this.provider.uploadFile(file.uri, remotePath);
          successful++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[CloudSync] Failed to upload cover ${file.name}:`, message);
          failed++;
        }
      }

      console.log(`[CloudSync] Covers upload completed: ${successful} successful, ${failed} failed`);
      return { ok: true, successful, failed };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Failed to upload covers:', message);
      return { ok: false, error: message };
    }
  }

  /**
   * Download covers
   */
  async downloadCovers(): Promise<SyncResult> {
    if (!this.isInitialized || !this.provider) {
      return { ok: false, error: 'Sync manager not initialized' };
    }

    try {
      const coversDir = new Directory(Paths.document, 'covers');

      // Ensure directory exists
      if (!coversDir.exists) {
        await coversDir.create();
      }

      // List remote covers
      let remoteFiles: { name: string; path: string; isDirectory: boolean }[] = [];
      try {
        remoteFiles = await this.provider.listFiles(SYNC_PATHS.covers);
      } catch {
        console.log('[CloudSync] No covers found in cloud');
        return { ok: true, successful: 0, failed: 0 };
      }

      // Get local covers
      const localFiles = await coversDir.list();
      const localCovers = new Set(localFiles.map(f => f.name));

      console.log(`[CloudSync] Downloading ${remoteFiles.length} cover files...`);

      let successful = 0;
      let failed = 0;

      for (const file of remoteFiles) {
        if (file.isDirectory) continue;

        if (localCovers.has(file.name)) {
          successful++;
          continue;
        }

        const localFile = new File(coversDir, file.name);

        try {
          await this.provider.downloadFile(file.path, localFile.uri);
          successful++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[CloudSync] Failed to download cover ${file.name}:`, message);
          failed++;
        }
      }

      console.log(`[CloudSync] Covers download completed: ${successful} successful, ${failed} failed`);
      return { ok: true, successful, failed };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Failed to download covers:', message);
      return { ok: false, error: message };
    }
  }

  /**
   * Full sync: upload all data
   */
  async syncUp(): Promise<FullSyncResult> {
    if (!this.isInitialized) {
      return {
        compatibility: null,
        remoteMetadata: null,
        metadata: null,
        database: null,
        settings: null,
        covers: null,
        sharedMetadata: null,
        blocked: false,
        success: false,
        error: 'Sync manager not initialized',
      };
    }

    console.log('[CloudSync] Starting cloud upload sync...');
    const results: FullSyncResult = {
      compatibility: null,
      remoteMetadata: null,
      metadata: null,
      database: null,
      settings: null,
      covers: null,
      sharedMetadata: null,
      blocked: false,
      success: false,
    };

    try {
      const compatibility = await this.ensureCompatibility('up');
      results.compatibility = compatibility;
      if (!compatibility.ok) {
        if (compatibility.blocked) {
          results.blocked = true;
          results.reason = compatibility.reason;
          return results;
        }
        results.error = compatibility.error;
        return results;
      }
      results.remoteMetadata = compatibility.data;

      results.metadata = await this.uploadDeviceMetadata();
      results.database = await this.uploadDatabase();
      results.settings = { ok: true, skipped: true }; // Settings handled separately on mobile
      results.covers = await this.uploadCovers();

      const allSuccessful =
        results.metadata?.ok && results.database?.ok && results.settings?.ok && results.covers?.ok;

      if (allSuccessful) {
        results.sharedMetadata = await this.uploadSharedMetadata();
      }

      results.success = allSuccessful && (!results.sharedMetadata || results.sharedMetadata.ok);

      if (results.success) {
        console.log('[CloudSync] Cloud upload sync completed successfully');
      } else {
        console.log('[CloudSync] Upload sync completed with some errors');
      }

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Cloud upload sync failed:', message);
      results.error = message;
      return results;
    }
  }

  /**
   * Full sync: download all data
   */
  async syncDown(): Promise<FullSyncResult> {
    if (!this.isInitialized) {
      return {
        compatibility: null,
        remoteMetadata: null,
        metadata: null,
        database: null,
        settings: null,
        covers: null,
        sharedMetadata: null,
        blocked: false,
        success: false,
        error: 'Sync manager not initialized',
      };
    }

    console.log('[CloudSync] Starting cloud download sync...');
    const results: FullSyncResult = {
      compatibility: null,
      remoteMetadata: null,
      metadata: null,
      database: null,
      settings: null,
      covers: null,
      sharedMetadata: null,
      blocked: false,
      success: false,
    };

    try {
      const compatibility = await this.ensureCompatibility('down');
      results.compatibility = compatibility;
      if (!compatibility.ok) {
        if (compatibility.blocked) {
          results.blocked = true;
          results.reason = compatibility.reason;
          return results;
        }
        results.error = compatibility.error;
        return results;
      }
      results.remoteMetadata = compatibility.data;

      results.database = await this.downloadDatabase();
      results.settings = { ok: true, skipped: true };
      results.covers = await this.downloadCovers();

      const allSuccessful = Boolean(
        (results.database?.ok || results.database?.notFound) &&
        (results.settings?.ok || results.settings?.notFound) &&
        results.covers?.ok
      );

      results.success = allSuccessful;

      if (allSuccessful) {
        console.log('[CloudSync] Cloud download sync completed successfully');
        await this.uploadDeviceMetadata();
        await this.uploadSharedMetadata();
      } else {
        console.log('[CloudSync] Download sync completed with some errors');
      }

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Cloud download sync failed:', message);
      results.error = message;
      return results;
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{ ok: boolean; status?: SyncStatus; error?: string }> {
    try {
      const status: SyncStatus = {
        isInitialized: this.isInitialized,
        providerType: this.providerType,
        providerName: this.provider?.displayName || null,
        deviceId: this.deviceId,
        lastSync: this.lastSyncTime,
        connectionOk: false,
      };

      if (this.provider) {
        const connectionResult = await this.testConnection();
        status.connectionOk = connectionResult.ok;
        status.userInfo = connectionResult.userInfo;

        if (connectionResult.ok) {
          const quota = await this.provider.getQuota();
          if (quota) {
            status.quota = quota;
          }
        }
      }

      return { ok: true, status };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CloudSync] Failed to get sync status:', message);
      return { ok: false, error: message };
    }
  }

  /**
   * Check if manager is initialized
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current provider type
   */
  getProviderType(): CloudProviderType | null {
    return this.providerType;
  }
}

// Export singleton
export const cloudSyncManager = new CloudSyncManager();
