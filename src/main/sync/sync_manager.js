const s3Client = require('./s3_client');
const settings = require('../settings');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class SyncManager {
  constructor() {
    this.deviceId = null;
    this.userDataPath = null;
    this.lastSyncTime = null;
    this.isInitialized = false;
    this.syncContext = {
      schemaVersion: 0,
      appVersion: '0.0.0',
    };
  }

  /**
   * Initialize sync manager
   */
  async initialize(userDataPath) {
    try {
      this.userDataPath = userDataPath;
      this.deviceId = await this.getOrCreateDeviceId();

      console.log('🔧 Sync manager initialized:', {
        deviceId: this.deviceId,
        userDataPath: this.userDataPath
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize sync manager:', error.message);
      throw error;
    }
  }

  setSyncContext(context = {}) {
    this.syncContext = {
      schemaVersion: Number(context.schemaVersion || 0),
      appVersion: context.appVersion || '0.0.0',
    };
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

      // Create new device ID
      const newDeviceId = uuidv4();

      // Ensure directory exists
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
   * Test S3 connection
   */
  async testConnection() {
    try {
      return await s3Client.testConnection();
    } catch (error) {
      console.error('❌ S3 connection test failed:', error.message);
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
      appVersion: this.syncContext.appVersion || '0.0.0',
    };
  }

  /**
   * Upload device metadata to S3
   */
  async uploadDeviceMetadata() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const metadata = this.getDeviceMetadata();
      const s3Key = `devices/${this.deviceId}/metadata.json`;

      console.log('📤 Uploading device metadata:', metadata);

      const result = await s3Client.uploadJson(metadata, s3Key);
      if (result.ok) {
        console.log('✅ Device metadata uploaded successfully');
      }
      return result;
    } catch (error) {
      console.error('❌ Failed to upload device metadata:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Download device metadata from S3
   */
  async downloadDeviceMetadata(deviceId = null) {
    const targetDeviceId = deviceId || this.deviceId;

    try {
      const s3Key = `devices/${targetDeviceId}/metadata.json`;
      console.log('📥 Downloading device metadata for:', targetDeviceId);

      return await s3Client.downloadJson(s3Key);
    } catch (error) {
      console.error('❌ Failed to download device metadata:', error.message);
      return { ok: false, error: error.message };
    }
  }

  async uploadSharedMetadata() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const payload = {
        schemaVersion: Number(this.syncContext.schemaVersion || 0),
        appVersion: this.syncContext.appVersion || '0.0.0',
        deviceId: this.deviceId,
        syncedAt: new Date().toISOString(),
      };
      const s3Key = 'metadata/sync.json';
      console.log('📤 Uploading sync metadata:', payload);
      return await s3Client.uploadJson(payload, s3Key);
    } catch (error) {
      console.error('❌ Failed to upload sync metadata:', error.message);
      return { ok: false, error: error.message };
    }
  }

  async downloadSharedMetadata() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const s3Key = 'metadata/sync.json';
      console.log('📥 Downloading sync metadata');
      const result = await s3Client.downloadJson(s3Key);
      if (result.ok) {
        return { ok: true, data: result.data, lastModified: result.lastModified, etag: result.etag };
      }
      if (result.notFound) {
        return { ok: true, data: null, notFound: true };
      }
      return { ok: false, error: result.error };
    } catch (error) {
      console.error('❌ Failed to download sync metadata:', error.message);
      return { ok: false, error: error.message };
    }
  }

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
          local: { schemaVersion: localSchema, appVersion: this.syncContext.appVersion || '0.0.0' },
        };
      }
      return { ok: true, data: meta.data };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  }

  /**
   * List all devices that have synced
   */
  async listDevices() {
    try {
      console.log('📋 Listing all devices...');

      const result = await s3Client.listFiles('devices/');
      if (!result.ok) {
        return result;
      }

      const devices = [];
      for (const file of result.files) {
        // Extract device ID from path like "devices/uuid/metadata.json"
        const match = file.key.match(/^devices\/([^\/]+)\/metadata\.json$/);
        if (match) {
          const deviceId = match[1];
          const metadataResult = await this.downloadDeviceMetadata(deviceId);
          if (metadataResult.ok) {
            devices.push({
              deviceId,
              ...metadataResult.data,
              isCurrentDevice: deviceId === this.deviceId
            });
          }
        }
      }

      console.log('✅ Found', devices.length, 'devices');
      return { ok: true, devices };
    } catch (error) {
      console.error('❌ Failed to list devices:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Upload database to S3
   */
  async uploadDatabase() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const dbPath = path.join(this.userDataPath, 'data', 'library.db');
      if (!fs.existsSync(dbPath)) {
        console.log('📄 Database file not found, skipping upload');
        return { ok: true, skipped: true };
      }

      const s3Key = `database/current/library.db`;
      console.log('📤 Uploading database:', dbPath);

      const result = await s3Client.uploadFile(dbPath, s3Key);
      if (result.ok) {
        console.log('✅ Database uploaded successfully');
        this.lastSyncTime = new Date().toISOString();
      }
      return result;
    } catch (error) {
      console.error('❌ Failed to upload database:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Download database from S3
   */
  async downloadDatabase() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const dbPath = path.join(this.userDataPath, 'data', 'library.db');
      const s3Key = `database/current/library.db`;

      console.log('📥 Downloading database:', s3Key);

      const result = await s3Client.downloadFile(s3Key, dbPath);
      if (result.ok) {
        console.log('✅ Database downloaded successfully');
        this.lastSyncTime = new Date().toISOString();
      }
      return result;
    } catch (error) {
      console.error('❌ Failed to download database:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Upload settings to S3
   */
  async uploadSettings() {
    try {
      const settingsPath = path.join(this.userDataPath, 'data', 'settings.json');
      if (!fs.existsSync(settingsPath)) {
        console.log('📄 Settings file not found, skipping upload');
        return { ok: true, skipped: true };
      }

      // Get settings without sensitive S3 credentials
      const syncableSettings = settings.getSyncableSettings();
      const s3Key = `settings/settings.json`;

      console.log('📤 Uploading filtered settings (excluding S3 credentials)');
      console.log('🔐 Excluded sensitive fields: s3Endpoint, s3AccessKey, s3SecretKey, s3Bucket, s3Region');

      return await s3Client.uploadJson(syncableSettings, s3Key);
    } catch (error) {
      console.error('❌ Failed to upload settings:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Download settings from S3
   */
  async downloadSettings() {
    try {
      const s3Key = `settings/settings.json`;
      console.log('📥 Downloading filtered settings:', s3Key);

      const result = await s3Client.downloadJson(s3Key);
      if (!result.ok) {
        return result;
      }

      // Merge downloaded settings with existing local settings, preserving S3 credentials
      const currentSettings = settings.getSettings();
      const downloadedSettings = result.data;

      // Keep local S3 credentials, merge everything else
      const mergedSettings = {
        ...downloadedSettings,
        s3Endpoint: currentSettings.s3Endpoint,
        s3AccessKey: currentSettings.s3AccessKey,
        s3SecretKey: currentSettings.s3SecretKey,
        s3Bucket: currentSettings.s3Bucket,
        s3Region: currentSettings.s3Region,
      };

      // Update settings with merged data
      settings.updateSettings(mergedSettings);

      console.log('✅ Settings downloaded and merged successfully');
      console.log('🔐 Preserved local S3 credentials');

      return { ok: true, merged: true };
    } catch (error) {
      console.error('❌ Failed to download settings:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Upload covers directory to S3
   */
  async uploadCovers() {
    if (!this.isInitialized) {
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

      for (const file of files) {
        const filePath = path.join(coversDir, file);
        const s3Key = `covers/${file}`;

        if (fs.statSync(filePath).isFile()) {
          const result = await s3Client.uploadFile(filePath, s3Key);
          results.push({ file, result });

          if (!result.ok) {
            console.error('❌ Failed to upload cover:', file, result.error);
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
   * Download covers from S3
   */
  async downloadCovers() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const coversDir = path.join(this.userDataPath, 'data', 'covers');

      // Ensure covers directory exists
      if (!fs.existsSync(coversDir)) {
        fs.mkdirSync(coversDir, { recursive: true });
      }

      // List all cover files in S3
      const listResult = await s3Client.listFiles('covers/');
      if (!listResult.ok) {
        return listResult;
      }

      const results = [];
      console.log('📥 Downloading', listResult.files.length, 'cover files...');

      for (const file of listResult.files) {
        const fileName = path.basename(file.key);
        const localPath = path.join(coversDir, fileName);

        const result = await s3Client.downloadFile(file.key, localPath);
        results.push({ file: fileName, result });

        if (!result.ok && !result.notFound) {
          console.error('❌ Failed to download cover:', fileName, result.error);
        }
      }

      const successful = results.filter(r => r.result.ok).length;
      const failed = results.filter(r => !r.result.ok && !r.result.notFound).length;

      console.log('✅ Covers download completed:', successful, 'successful,', failed, 'failed');
      return { ok: true, successful, failed, results };
    } catch (error) {
      console.error('❌ Failed to download covers:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Full sync: upload all data to S3
   */
  async syncUp() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    console.log('🔄 Starting full upload sync...');
    const results = {
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
      results.settings = await this.uploadSettings();
      results.covers = await this.uploadCovers();

      const allSuccessful = results.metadata.ok &&
                           results.database.ok &&
                           results.settings.ok &&
                           results.covers.ok;

      if (allSuccessful) {
        results.sharedMetadata = await this.uploadSharedMetadata();
        if (results.sharedMetadata && results.sharedMetadata.ok === false) {
          results.error = results.sharedMetadata.error;
        }
      }

      results.success = allSuccessful && (!results.sharedMetadata || results.sharedMetadata.ok);

      if (results.success) {
        console.log('✅ Full upload sync completed successfully');
      } else {
        console.log('⚠️ Upload sync completed with some errors');
      }

      return results;
    } catch (error) {
      console.error('❌ Full upload sync failed:', error.message);
      results.error = error.message;
      return results;
    }
  }

  /**
   * Full sync: download all data from S3
   */
  async syncDown() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    console.log('🔄 Starting full download sync...');
    const results = {
      compatibility: null,
      remoteMetadata: null,
      database: null,
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

      // Download database
      results.database = await this.downloadDatabase();

      // Download settings
      results.settings = await this.downloadSettings();

      // Download covers
      results.covers = await this.downloadCovers();

      const allSuccessful = (results.database.ok || results.database?.notFound) &&
                           (results.settings.ok || results.settings?.notFound) &&
                           (results.covers && results.covers.ok);

      results.success = allSuccessful;

      if (allSuccessful) {
        console.log('✅ Full download sync completed successfully');
        // Update our metadata after successful sync
        await this.uploadDeviceMetadata();
        await this.uploadSharedMetadata();
      } else {
        console.log('⚠️ Download sync completed with some errors');
      }

      return results;
    } catch (error) {
      console.error('❌ Full download sync failed:', error.message);
      results.error = error.message;
      return results;
    }
  }

  /**
   * Clean up orphaned covers from S3 (covers that are no longer referenced in the database)
   */
  async cleanupOrphanedCovers() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized');
    }

    try {
      console.log('🧹 Starting orphaned covers cleanup...');

      // 1. Get all cover files from S3
      const listResult = await s3Client.listFiles('covers/');
      if (!listResult.ok) {
        console.error('❌ Failed to list S3 covers for cleanup:', listResult.error);
        return { ok: false, error: listResult.error };
      }

      const s3CoverObjects = listResult.files || [];
      console.log(`📋 Found ${s3CoverObjects.length} covers in S3`);

      if (s3CoverObjects.length === 0) {
        return { ok: true, deleted: 0, message: 'No covers found in S3' };
      }

      // Extract file keys from objects
      const s3CoverFiles = s3CoverObjects.map(obj => obj.key);

      // 2. Get all cover paths from local database
      const dbPath = path.join(this.userDataPath, 'data', 'library.db');
      if (!fs.existsSync(dbPath)) {
        console.log('📄 No local database found, skipping cleanup');
        return { ok: true, deleted: 0, message: 'No local database found' };
      }

      // Read database to get used cover paths using sql.js (WASM), avoiding native sqlite3
      const initSqlJs = require('sql.js');
      const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
      const SQL = await initSqlJs({ locateFile: () => wasmPath });
      const usedCovers = new Set();

      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(new Uint8Array(fileBuffer));
      const result = db.exec("SELECT coverPath FROM books WHERE coverPath IS NOT NULL AND coverPath != ''");
      if (Array.isArray(result) && result.length > 0) {
        const rows = result[0].values;
        rows.forEach(row => {
          const coverPath = row && row[0];
          if (coverPath) {
            const filename = path.basename(String(coverPath));
            usedCovers.add(filename);
          }
        });
      }
      db.close();

      console.log(`📋 Found ${usedCovers.size} covers referenced in database`);

      // 3. Find orphaned covers (in S3 but not in database)
      const orphanedCovers = s3CoverFiles.filter(s3File => {
        const filename = s3File.replace('covers/', ''); // Remove prefix
        return !usedCovers.has(filename);
      });

      console.log(`🗑️ Found ${orphanedCovers.length} orphaned covers to delete`);

      if (orphanedCovers.length === 0) {
        return { ok: true, deleted: 0, message: 'No orphaned covers found' };
      }

      // 4. Delete orphaned covers from S3
      let deletedCount = 0;
      const errors = [];

      for (const s3Key of orphanedCovers) {
        try {
          const deleteResult = await s3Client.deleteFile(s3Key);
          if (deleteResult.ok) {
            console.log(`🗑️ Deleted orphaned cover: ${s3Key}`);
            deletedCount++;
          } else {
            console.error(`❌ Failed to delete ${s3Key}:`, deleteResult.error);
            errors.push(`${s3Key}: ${deleteResult.error}`);
          }
        } catch (error) {
          console.error(`❌ Error deleting ${s3Key}:`, error.message);
          errors.push(`${s3Key}: ${error.message}`);
        }
      }

      console.log(`✅ Cleanup completed: deleted ${deletedCount}/${orphanedCovers.length} orphaned covers`);

      return {
        ok: true,
        deleted: deletedCount,
        total: orphanedCovers.length,
        errors: errors.length > 0 ? errors : null,
        message: `Deleted ${deletedCount} orphaned covers`
      };

    } catch (error) {
      console.error('❌ Orphaned covers cleanup failed:', error.message);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Get sync status and information
   */
  async getSyncStatus() {
    try {
      const status = {
        isInitialized: this.isInitialized,
        deviceId: this.deviceId,
        lastSync: this.lastSyncTime,
        s3Config: s3Client.getConfig(),
        devices: null,
        connectionOk: false
      };

      // Test connection
      const connectionResult = await this.testConnection();
      status.connectionOk = connectionResult.ok;

      // Get devices list if connection is ok
      if (connectionResult.ok) {
        const devicesResult = await this.listDevices();
        if (devicesResult.ok) {
          status.devices = devicesResult.devices;
        }
      }

      return { ok: true, status };
    } catch (error) {
      console.error('❌ Failed to get sync status:', error.message);
      return { ok: false, error: error.message };
    }
  }
}

module.exports = new SyncManager();
