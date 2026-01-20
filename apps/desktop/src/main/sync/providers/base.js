/**
 * Base Cloud Storage Provider
 * Abstract class for cloud storage providers (Yandex Disk, Google Drive, Dropbox)
 *
 * @typedef {import('@library-manager/shared/src/sync/types').CloudProviderType} CloudProviderType
 * @typedef {import('@library-manager/shared/src/sync/types').AuthResult} AuthResult
 * @typedef {import('@library-manager/shared/src/sync/types').ConnectionResult} ConnectionResult
 * @typedef {import('@library-manager/shared/src/sync/types').RemoteFile} RemoteFile
 * @typedef {import('@library-manager/shared/src/sync/types').QuotaInfo} QuotaInfo
 */

const fs = require('fs');
const path = require('path');

/**
 * Base class for cloud storage providers
 * All cloud providers (Yandex, Google Drive, Dropbox) should extend this class
 */
class BaseCloudProvider {
  /**
   * @param {CloudProviderType} type - Provider type identifier
   * @param {string} displayName - Human-readable provider name
   */
  constructor(type, displayName) {
    if (new.target === BaseCloudProvider) {
      throw new Error('BaseCloudProvider is abstract and cannot be instantiated directly');
    }

    /** @type {CloudProviderType} */
    this.type = type;

    /** @type {string} */
    this.displayName = displayName;

    /** @type {string|null} */
    this.accessToken = null;

    /** @type {string|null} */
    this.refreshToken = null;

    /** @type {Date|null} */
    this.tokenExpiresAt = null;
  }

  // ==================== Authentication ====================

  /**
   * Check if provider is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!this.accessToken;
  }

  /**
   * Get OAuth authorization URL
   * @returns {string}
   * @abstract
   */
  getAuthUrl() {
    throw new Error('getAuthUrl() must be implemented by subclass');
  }

  /**
   * Authenticate with authorization code
   * @param {string} code - OAuth authorization code
   * @returns {Promise<AuthResult>}
   * @abstract
   */
  async authenticate(code) {
    throw new Error('authenticate() must be implemented by subclass');
  }

  /**
   * Refresh access token
   * @returns {Promise<void>}
   * @abstract
   */
  async refreshAccessToken() {
    throw new Error('refreshAccessToken() must be implemented by subclass');
  }

  /**
   * Clear authentication state
   */
  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Set tokens from saved state
   * @param {string} accessToken
   * @param {string} [refreshToken]
   * @param {Date} [expiresAt]
   */
  setTokens(accessToken, refreshToken = null, expiresAt = null) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiresAt = expiresAt;
  }

  /**
   * Get current tokens for persistence
   * @returns {{accessToken: string|null, refreshToken: string|null, expiresAt: Date|null}}
   */
  getTokens() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiresAt: this.tokenExpiresAt
    };
  }

  /**
   * Check if token needs refresh
   * @returns {boolean}
   */
  isTokenExpired() {
    if (!this.tokenExpiresAt) return false;
    // Refresh 5 minutes before expiry
    const bufferMs = 5 * 60 * 1000;
    return new Date().getTime() > this.tokenExpiresAt.getTime() - bufferMs;
  }

  /**
   * Ensure we have a valid token, refreshing if needed
   * @returns {Promise<void>}
   */
  async ensureValidToken() {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }
    if (this.isTokenExpired() && this.refreshToken) {
      await this.refreshAccessToken();
    }
  }

  // ==================== Connection ====================

  /**
   * Test connection to cloud provider
   * @returns {Promise<ConnectionResult>}
   * @abstract
   */
  async testConnection() {
    throw new Error('testConnection() must be implemented by subclass');
  }

  // ==================== File Operations ====================

  /**
   * Upload file to cloud storage
   * @param {string} localPath - Local file path
   * @param {string} remotePath - Remote path in cloud storage
   * @returns {Promise<void>}
   * @abstract
   */
  async uploadFile(localPath, remotePath) {
    throw new Error('uploadFile() must be implemented by subclass');
  }

  /**
   * Download file from cloud storage
   * @param {string} remotePath - Remote path in cloud storage
   * @param {string} localPath - Local destination path
   * @returns {Promise<void>}
   * @abstract
   */
  async downloadFile(remotePath, localPath) {
    throw new Error('downloadFile() must be implemented by subclass');
  }

  /**
   * Delete file from cloud storage
   * @param {string} remotePath - Remote path in cloud storage
   * @returns {Promise<void>}
   * @abstract
   */
  async deleteFile(remotePath) {
    throw new Error('deleteFile() must be implemented by subclass');
  }

  /**
   * List files in remote directory
   * @param {string} remotePath - Remote directory path
   * @returns {Promise<RemoteFile[]>}
   * @abstract
   */
  async listFiles(remotePath) {
    throw new Error('listFiles() must be implemented by subclass');
  }

  /**
   * Check if file exists in cloud storage
   * @param {string} remotePath - Remote path to check
   * @returns {Promise<boolean>}
   */
  async fileExists(remotePath) {
    try {
      const files = await this.listFiles(path.dirname(remotePath));
      const fileName = path.basename(remotePath);
      return files.some(f => f.name === fileName);
    } catch (error) {
      return false;
    }
  }

  // ==================== JSON Helpers ====================

  /**
   * Upload JSON data to cloud storage
   * @param {string} remotePath - Remote path for JSON file
   * @param {unknown} data - Data to serialize as JSON
   * @returns {Promise<void>}
   */
  async uploadJson(remotePath, data) {
    const tempPath = path.join(require('os').tmpdir(), `upload_${Date.now()}.json`);
    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
      await this.uploadFile(tempPath, remotePath);
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  /**
   * Download and parse JSON from cloud storage
   * @template T
   * @param {string} remotePath - Remote path to JSON file
   * @returns {Promise<T|null>}
   */
  async downloadJson(remotePath) {
    const tempPath = path.join(require('os').tmpdir(), `download_${Date.now()}.json`);
    try {
      await this.downloadFile(remotePath, tempPath);
      const content = fs.readFileSync(tempPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.message.includes('not found') || error.code === 'ENOENT') {
        return null;
      }
      throw error;
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  // ==================== Quota ====================

  /**
   * Get storage quota information
   * @returns {Promise<QuotaInfo|null>}
   * @abstract
   */
  async getQuota() {
    throw new Error('getQuota() must be implemented by subclass');
  }

  // ==================== Utilities ====================

  /**
   * Ensure parent directory exists in cloud storage
   * @param {string} remotePath - Remote file path
   * @returns {Promise<void>}
   */
  async ensureRemoteDirectory(remotePath) {
    // Default implementation - subclasses may override if provider requires explicit directory creation
  }

  /**
   * Get MIME type for file
   * @param {string} filePath
   * @returns {string}
   */
  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.json': 'application/json',
      '.db': 'application/octet-stream',
      '.sqlite': 'application/octet-stream',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
      '.log': 'text/plain',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Log message with provider prefix
   * @param {string} level - 'info' | 'error' | 'warn'
   * @param {string} message
   * @param {any} [data]
   */
  log(level, message, data = null) {
    const prefix = `[${this.displayName}]`;
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (data) {
      logFn(prefix, message, data);
    } else {
      logFn(prefix, message);
    }
  }
}

module.exports = BaseCloudProvider;
