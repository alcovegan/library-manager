/**
 * Cloud Sync Manager
 * Manages sync operations using cloud storage providers (Yandex Disk, Google Drive, Dropbox)
 *
 * This is a provider-agnostic alternative to sync_manager.js (which uses S3 directly)
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { cloudProviderFactory } = require('./providerFactory');
const { exportDatabaseToPayload, importPayloadWithMerge } = require('./syncDatabase');
const settings = require('../settings');

/**
 * @typedef {import('./providers/base')} BaseCloudProvider
 * @typedef {'yandex' | 'googledrive' | 'dropbox'} CloudProviderType
 */

// Sync paths in cloud storage
const SYNC_PATHS = {
  database: 'library.db',
  syncData: 'sync-data.json',
  metadata: 'sync-metadata.json',
  settings: 'settings.json',
  covers: 'covers/',
  devices: 'devices/'
};

class CloudSyncManager {
  constructor() {
    /** @type {BaseCloudProvider | null} */
    this.provider = null;

    /** @type {CloudProviderType | null} */
    this.providerType = null;

    this.deviceId = null;
    this.userDataPath = null;
    this.lastSyncTime = null;
    this.isInitialized = false;
    this.syncContext = {
      schemaVersion: 0,
      appVersion: '0.0.0'
    };
    this.dbContext = null; // Database context for entity-level sync
  }

  /**
   * Initialize sync manager with a provider
   * @param {string} userDataPath - Path to user data directory
   * @param {CloudProviderType} providerType - Cloud provider type
   */
  async initialize(userDataPath, providerType) {
    try {
      this.userDataPath = userDataPath;
      this.providerType = providerType;
      this.provider = cloudProviderFactory.getProvider(providerType);
      this.deviceId = await this.getOrCreateDeviceId();

      console.log(`🔧 Cloud sync manager initialized:`, {
        provider: providerType,
        deviceId: this.deviceId,
        userDataPath: this.userDataPath
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize cloud sync manager:', error.message);
      throw error;
    }
  }

  /**
   * Set sync context with schema version info
   */
  setSyncContext(context = {}) {
    this.syncContext = {
      schemaVersion: Number(context.schemaVersion || 0),
      appVersion: context.appVersion || '0.0.0'
    };
  }

  /**
   * Set database context for entity-level sync
   * @param {object} ctx - Database context with db property (sql.js database instance)
   */
  setDbContext(ctx) {
    this.dbContext = ctx;
  }

  /**
   * Get or create unique device ID
   */
  async getOrCreateDeviceId() {
    const deviceIdPath = path.join(this.userDataPath, 'data', 'device-id.txt');

    try {
      if (fs.existsSync(deviceIdPath)) {
        const deviceId = fs.readFileSync(deviceIdPath, 'utf-8').trim();
        if (deviceId) {
          console.log('📱 Using existing device ID:', deviceId);
          return deviceId;
        }
      }

      const newDeviceId = uuidv4();

      const dir = path.dirname(deviceIdPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(deviceIdPath, newDeviceId);
      console.log('📱 Created new device ID:', newDeviceId);
      return newDeviceId;
    } catch (error) {
      console.error('❌ Failed to get/create device ID:', error.message);
      throw error;
    }
  }

  /**
   * Save the cloud syncedAt timestamp locally (to track if we're up-to-date)
   */
  saveLastSyncedAt(syncedAt) {
    const syncedAtPath = path.join(this.userDataPath, 'data', 'last-synced-at.txt');
    try {
      const dir = path.dirname(syncedAtPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(syncedAtPath, syncedAt);
      console.log('📅 Saved last synced at:', syncedAt);
    } catch (error) {
      console.error('❌ Failed to save last synced at:', error.message);
    }
  }

  /**
   * Get the last known cloud syncedAt timestamp
   */
  getLastSyncedAt() {
    const syncedAtPath = path.join(this.userDataPath, 'data', 'last-synced-at.txt');
    try {
      if (fs.existsSync(syncedAtPath)) {
        return fs.readFileSync(syncedAtPath, 'utf-8').trim();
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Check if local data is up-to-date with cloud
   */
  isDataUpToDate(cloudSyncedAt) {
    const localSyncedAt = this.getLastSyncedAt();
    if (!localSyncedAt) return false;

    // Compare timestamps - if local >= cloud, we're up to date
    return new Date(localSyncedAt).getTime() >= new Date(cloudSyncedAt).getTime();
  }

  /**
   * Save lastSyncTime to settings (when WE last synced - up or down)
   */
  saveLastSyncTime(timestamp) {
    try {
      this.lastSyncTime = timestamp;
      settings.updateSettings({ lastCloudSyncTime: timestamp });
      console.log('📅 Saved lastSyncTime:', timestamp);
    } catch (error) {
      console.error('❌ Failed to save lastSyncTime:', error.message);
    }
  }

  /**
   * Get lastSyncTime from settings
   */
  getLastSyncTime() {
    try {
      const s = settings.getSettings();
      return s.lastCloudSyncTime || this.lastSyncTime || null;
    } catch {
      return this.lastSyncTime || null;
    }
  }

  /**
   * Test connection to cloud provider
   */
  async testConnection() {
    if (!this.provider) {
      return { ok: false, error: 'Provider not initialized' };
    }

    try {
      const result = await this.provider.testConnection();
      return { ok: result.success, error: result.error, userInfo: result.userInfo };
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get current device metadata
   */
  getDeviceMetadata() {
    return {
      deviceId: this.deviceId,
      deviceName: require('os').hostname(),
      platform: process.platform,
      lastSync: this.lastSyncTime,
      timestamp: new Date().toISOString(),
      version: require('../../../package.json').version || '1.0.0',
      schemaVersion: Number(this.syncContext.schemaVersion || 0),
      appVersion: this.syncContext.appVersion || '0.0.0'
    };
  }

  /**
   * Upload device metadata
   */
  async uploadDeviceMetadata() {
    if (!this.isInitialized || !this.provider) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const metadata = this.getDeviceMetadata();
      const remotePath = `${SYNC_PATHS.devices}${this.deviceId}/metadata.json`;

      console.log('📤 Uploading device metadata:', metadata);

      await this.provider.uploadJson(remotePath, metadata);
      console.log('✅ Device metadata uploaded successfully');
      return { ok: true };
    } catch (error) {
      console.error('❌ Failed to upload device metadata:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Download device metadata
   */
  async downloadDeviceMetadata(deviceId = null) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    const targetDeviceId = deviceId || this.deviceId;

    try {
      const remotePath = `${SYNC_PATHS.devices}${targetDeviceId}/metadata.json`;
      console.log('📥 Downloading device metadata for:', targetDeviceId);

      const data = await this.provider.downloadJson(remotePath);
      return { ok: true, data };
    } catch (error) {
      console.error('❌ Failed to download device metadata:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Upload shared sync metadata
   */
  async uploadSharedMetadata() {
    if (!this.isInitialized || !this.provider) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const syncedAt = new Date().toISOString();
      const payload = {
        schemaVersion: Number(this.syncContext.schemaVersion || 0),
        appVersion: this.syncContext.appVersion || '0.0.0',
        deviceId: this.deviceId,
        deviceName: os.hostname() || 'Desktop',
        platform: process.platform,
        syncedAt
      };
      console.log('📤 Uploading sync metadata, syncedAt:', syncedAt);

      await this.provider.uploadJson(SYNC_PATHS.metadata, payload);
      return { ok: true, syncedAt };
    } catch (error) {
      console.error('❌ Failed to upload sync metadata:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Download shared sync metadata
   */
  async downloadSharedMetadata() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      console.log('📥 Downloading sync metadata');
      const data = await this.provider.downloadJson(SYNC_PATHS.metadata);

      if (data === null) {
        return { ok: true, data: null, notFound: true };
      }

      return { ok: true, data };
    } catch (error) {
      console.error('❌ Failed to download sync metadata:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Check schema compatibility
   */
  async ensureCompatibility(direction = 'down') {
    try {
      const meta = await this.downloadSharedMetadata();
      if (!meta.ok) {
        return meta;
      }
      if (!meta.data) {
        return { ok: true, data: null };
      }

      const remoteSchema = Number(meta.data.schemaVersion || 0);
      const localSchema = Number(this.syncContext.schemaVersion || 0);

      if (remoteSchema > localSchema) {
        return {
          ok: false,
          blocked: true,
          reason: `remote schema version ${remoteSchema} is newer than local ${localSchema}`,
          remote: meta.data,
          local: { schemaVersion: localSchema, appVersion: this.syncContext.appVersion || '0.0.0' }
        };
      }

      return { ok: true, data: meta.data };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  }

  /**
   * Upload database
   */
  async uploadDatabase() {
    if (!this.isInitialized || !this.provider) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const dbPath = path.join(this.userDataPath, 'data', 'library.db');
      if (!fs.existsSync(dbPath)) {
        console.log('📄 Database file not found, skipping upload');
        return { ok: true, skipped: true };
      }

      console.log('📤 Uploading database:', dbPath);

      await this.provider.uploadFile(dbPath, SYNC_PATHS.database);

      console.log('✅ Database uploaded successfully');
      this.saveLastSyncTime(new Date().toISOString());
      return { ok: true };
    } catch (error) {
      console.error('❌ Failed to upload database:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Download database
   */
  async downloadDatabase() {
    if (!this.isInitialized || !this.provider) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const dbPath = path.join(this.userDataPath, 'data', 'library.db');
      console.log('📥 Downloading database');

      await this.provider.downloadFile(SYNC_PATHS.database, dbPath);

      console.log('✅ Database downloaded successfully');
      this.saveLastSyncTime(new Date().toISOString());
      return { ok: true };
    } catch (error) {
      if (error.message.includes('not found')) {
        return { ok: false, notFound: true, error: 'Database not found in cloud' };
      }
      console.error('❌ Failed to download database:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Upload sync data as JSON (entity-level sync)
   * Exports all entities and uploads as sync-data.json
   */
  async uploadSyncData() {
    if (!this.isInitialized || !this.provider) {
      throw new Error('Sync manager not initialized');
    }

    if (!this.dbContext) {
      console.log('⚠️ Database context not set, falling back to uploadDatabase');
      return this.uploadDatabase();
    }

    try {
      const deviceName = os.hostname() || 'Desktop';
      const platform = process.platform;

      console.log('📤 Exporting database to sync payload...');
      const payload = exportDatabaseToPayload(this.dbContext, this.deviceId, deviceName, platform);

      console.log('📤 Uploading sync data:', {
        books: payload.entities.books.length,
        authors: payload.entities.authors.length,
        collections: payload.entities.collections.length
      });

      await this.provider.uploadJson(SYNC_PATHS.syncData, payload);

      console.log('✅ Sync data uploaded successfully');
      this.saveLastSyncTime(new Date().toISOString());
      return { ok: true, payload };
    } catch (error) {
      console.error('❌ Failed to upload sync data:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Download and merge sync data (entity-level sync)
   * Downloads sync-data.json and merges with local database using LWW
   */
  async downloadAndMergeSyncData() {
    if (!this.isInitialized || !this.provider) {
      throw new Error('Sync manager not initialized');
    }

    if (!this.dbContext) {
      console.log('⚠️ Database context not set, falling back to downloadDatabase');
      return this.downloadDatabase();
    }

    try {
      console.log('📥 Downloading sync data...');

      let remotePayload;
      try {
        remotePayload = await this.provider.downloadJson(SYNC_PATHS.syncData);
      } catch (error) {
        if (error.message.includes('not found') || error.message.includes('404')) {
          console.log('📄 Sync data not found in cloud, trying legacy database download');
          return this.downloadDatabase();
        }
        throw error;
      }

      if (!remotePayload) {
        console.log('📄 Sync data not found, trying legacy database download');
        return this.downloadDatabase();
      }

      console.log('📥 Remote payload received:', {
        version: remotePayload.version,
        schemaVersion: remotePayload.schemaVersion,
        deviceId: remotePayload.deviceId,
        books: remotePayload.entities?.books?.length || 0
      });

      console.log('🔀 Merging with local database...');
      const mergeSummary = importPayloadWithMerge(this.dbContext, remotePayload);

      console.log('✅ Sync data merged successfully:', mergeSummary);
      this.saveLastSyncTime(new Date().toISOString());
      return { ok: true, mergeSummary };
    } catch (error) {
      console.error('❌ Failed to download/merge sync data:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Upload settings (excluding sensitive data)
   */
  async uploadSettings() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const settingsPath = path.join(this.userDataPath, 'data', 'settings.json');
      if (!fs.existsSync(settingsPath)) {
        console.log('📄 Settings file not found, skipping upload');
        return { ok: true, skipped: true };
      }

      // Read and filter settings
      const settings = require('../settings');
      const syncableSettings = settings.getSyncableSettings();

      console.log('📤 Uploading filtered settings (excluding credentials)');

      await this.provider.uploadJson(SYNC_PATHS.settings, syncableSettings);
      return { ok: true };
    } catch (error) {
      console.error('❌ Failed to upload settings:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Download and merge settings
   */
  async downloadSettings() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      console.log('📥 Downloading settings');

      const downloadedSettings = await this.provider.downloadJson(SYNC_PATHS.settings);

      if (!downloadedSettings) {
        return { ok: true, notFound: true };
      }

      // Merge with local settings, preserving credentials
      const settings = require('../settings');
      const currentSettings = settings.getSettings();

      const mergedSettings = {
        ...downloadedSettings,
        // Preserve local credentials
        s3Endpoint: currentSettings.s3Endpoint,
        s3AccessKey: currentSettings.s3AccessKey,
        s3SecretKey: currentSettings.s3SecretKey,
        s3Bucket: currentSettings.s3Bucket,
        s3Region: currentSettings.s3Region,
        // Preserve cloud provider tokens (stored in settings)
        yandexAccessToken: currentSettings.yandexAccessToken,
        yandexRefreshToken: currentSettings.yandexRefreshToken,
        googleAccessToken: currentSettings.googleAccessToken,
        googleRefreshToken: currentSettings.googleRefreshToken,
        dropboxAccessToken: currentSettings.dropboxAccessToken,
        dropboxRefreshToken: currentSettings.dropboxRefreshToken
      };

      settings.updateSettings(mergedSettings);

      console.log('✅ Settings downloaded and merged successfully');
      return { ok: true, merged: true };
    } catch (error) {
      console.error('❌ Failed to download settings:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Upload covers
   */
  async uploadCovers() {
    if (!this.isInitialized || !this.provider) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const coversDir = path.join(this.userDataPath, 'data', 'covers');
      if (!fs.existsSync(coversDir)) {
        console.log('📄 Covers directory not found, skipping upload');
        return { ok: true, skipped: true };
      }

      const files = fs.readdirSync(coversDir);
      const results = [];

      console.log('📤 Uploading', files.length, 'cover files...');

      // Get list of existing remote covers to avoid duplicates
      let existingCovers = new Set();
      try {
        const remoteFiles = await this.provider.listFiles(SYNC_PATHS.covers);
        existingCovers = new Set(remoteFiles.map(f => f.name));
      } catch {
        // Folder might not exist yet
      }

      for (const file of files) {
        const filePath = path.join(coversDir, file);
        const remotePath = `${SYNC_PATHS.covers}${file}`;

        if (fs.statSync(filePath).isFile()) {
          // Skip if already exists in cloud
          if (existingCovers.has(file)) {
            results.push({ file, result: { ok: true, skipped: true } });
            continue;
          }

          try {
            await this.provider.uploadFile(filePath, remotePath);
            results.push({ file, result: { ok: true } });
          } catch (error) {
            console.error('❌ Failed to upload cover:', file, error.message);
            results.push({ file, result: { ok: false, error: error.message } });
          }
        }
      }

      const successful = results.filter(r => r.result.ok).length;
      const failed = results.filter(r => !r.result.ok).length;

      console.log('✅ Covers upload completed:', successful, 'successful,', failed, 'failed');
      return { ok: true, successful, failed, results };
    } catch (error) {
      console.error('❌ Failed to upload covers:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Download covers
   */
  async downloadCovers() {
    if (!this.isInitialized || !this.provider) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const coversDir = path.join(this.userDataPath, 'data', 'covers');

      if (!fs.existsSync(coversDir)) {
        fs.mkdirSync(coversDir, { recursive: true });
      }

      // List remote covers
      let remoteFiles = [];
      try {
        remoteFiles = await this.provider.listFiles(SYNC_PATHS.covers);
      } catch {
        console.log('📄 No covers found in cloud');
        return { ok: true, successful: 0, failed: 0 };
      }

      // Get local covers to skip existing
      const localCovers = new Set(fs.readdirSync(coversDir));

      const results = [];
      console.log('📥 Downloading', remoteFiles.length, 'cover files...');

      for (const file of remoteFiles) {
        if (file.isDirectory) continue;

        // Skip if already exists locally
        if (localCovers.has(file.name)) {
          results.push({ file: file.name, result: { ok: true, skipped: true } });
          continue;
        }

        const localPath = path.join(coversDir, file.name);

        try {
          await this.provider.downloadFile(file.path, localPath);
          results.push({ file: file.name, result: { ok: true } });
        } catch (error) {
          console.error('❌ Failed to download cover:', file.name, error.message);
          results.push({ file: file.name, result: { ok: false, error: error.message } });
        }
      }

      const successful = results.filter(r => r.result.ok).length;
      const failed = results.filter(r => !r.result.ok).length;

      console.log('✅ Covers download completed:', successful, 'successful,', failed, 'failed');
      return { ok: true, successful, failed, results };
    } catch (error) {
      console.error('❌ Failed to download covers:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Full sync: upload all data
   */
  async syncUp() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    console.log('🔄 Starting cloud upload sync...');
    const results = {
      compatibility: null,
      remoteMetadata: null,
      metadata: null,
      syncData: null,
      settings: null,
      covers: null,
      sharedMetadata: null,
      blocked: false,
      success: false
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
      results.syncData = await this.uploadSyncData();
      results.settings = await this.uploadSettings();
      results.covers = await this.uploadCovers();

      const allSuccessful = results.metadata.ok &&
                           results.syncData.ok &&
                           results.settings.ok &&
                           results.covers.ok;

      if (allSuccessful) {
        results.sharedMetadata = await this.uploadSharedMetadata();
      }

      results.success = allSuccessful && (!results.sharedMetadata || results.sharedMetadata.ok);

      if (results.success && results.sharedMetadata?.syncedAt) {
        console.log('✅ Cloud upload sync completed successfully');
        // Save the SAME syncedAt we sent to cloud (so isUpToDate will be true)
        this.saveLastSyncedAt(results.sharedMetadata.syncedAt);
      } else if (!results.success) {
        console.log('⚠️ Upload sync completed with some errors');
      }

      return results;
    } catch (error) {
      console.error('❌ Cloud upload sync failed:', error.message);
      results.error = error.message;
      return results;
    }
  }

  /**
   * Full sync: download all data
   */
  async syncDown() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    console.log('🔄 Starting cloud download sync...');
    const results = {
      compatibility: null,
      remoteMetadata: null,
      syncData: null,
      settings: null,
      covers: null,
      blocked: false,
      success: false
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

      results.syncData = await this.downloadAndMergeSyncData();
      results.settings = await this.downloadSettings();
      results.covers = await this.downloadCovers();

      const allSuccessful = (results.syncData.ok || results.syncData?.notFound) &&
                           (results.settings.ok || results.settings?.notFound) &&
                           (results.covers && results.covers.ok);

      results.success = allSuccessful;

      if (allSuccessful) {
        console.log('✅ Cloud download sync completed successfully');
        // Save the cloud syncedAt locally so we know we have this data
        if (results.remoteMetadata?.syncedAt) {
          this.saveLastSyncedAt(results.remoteMetadata.syncedAt);
        }
      } else {
        console.log('⚠️ Download sync completed with some errors');
      }

      return results;
    } catch (error) {
      console.error('❌ Cloud download sync failed:', error.message);
      results.error = error.message;
      return results;
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    try {
      const status = {
        isInitialized: this.isInitialized,
        providerType: this.providerType,
        providerName: this.provider?.displayName || null,
        deviceId: this.deviceId,
        lastSync: this.lastSyncTime,
        connectionOk: false
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
      console.error('❌ Failed to get sync status:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get current device ID
   */
  getDeviceId() {
    return this.deviceId;
  }
}

// Export singleton
const cloudSyncManager = new CloudSyncManager();

module.exports = {
  CloudSyncManager,
  cloudSyncManager,
  SYNC_PATHS
};
