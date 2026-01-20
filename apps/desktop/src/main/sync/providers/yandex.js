/**
 * Yandex Disk Cloud Provider
 * Uses Yandex Disk REST API for file sync
 *
 * API Docs: https://yandex.ru/dev/disk/api/concepts/about.html
 * OAuth: https://oauth.yandex.ru/
 */

const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const http = require('http');
const BaseCloudProvider = require('./base');

const crypto = require('crypto');

const YANDEX_API = 'https://cloud-api.yandex.net/v1/disk';
const YANDEX_OAUTH = 'https://oauth.yandex.ru';
const APP_FOLDER_PREFIX = 'app:/LibraryManager';

/**
 * Generate base64url encoding (RFC 4648)
 */
function base64url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Yandex Disk provider implementation
 * Uses PKCE (Proof Key for Code Exchange) for secure OAuth without client_secret
 */
class YandexDiskProvider extends BaseCloudProvider {
  /**
   * @param {string} clientId - Yandex OAuth Client ID
   * @param {string} [clientSecret] - Yandex OAuth Client Secret (optional when using PKCE)
   */
  constructor(clientId, clientSecret = null) {
    super('yandex', 'Yandex Disk');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.codeVerifier = null;
  }

  // ==================== Authentication ====================

  /**
   * Generate PKCE code verifier and challenge
   * @returns {{codeVerifier: string, codeChallenge: string}}
   */
  generatePKCE() {
    // Generate random code verifier (43-128 characters)
    this.codeVerifier = base64url(crypto.randomBytes(32));
    // Generate code challenge using SHA256
    const codeChallenge = base64url(
      crypto.createHash('sha256').update(this.codeVerifier).digest()
    );
    return { codeVerifier: this.codeVerifier, codeChallenge };
  }

  /**
   * Get OAuth authorization URL with PKCE
   * Using Authorization Code Flow + PKCE (no client_secret needed)
   */
  getAuthUrl() {
    const { codeChallenge } = this.generatePKCE();
    const redirectUri = 'http://localhost:8091/callback';

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      force_confirm: 'yes'
    });

    return `${YANDEX_OAUTH}/authorize?${params.toString()}`;
  }

  /**
   * Authenticate with authorization code using PKCE
   * @param {string} code - OAuth authorization code
   * @returns {Promise<import('@library-manager/shared/src/sync/types').AuthResult>}
   */
  async authenticate(code) {
    try {
      // Build token request params with PKCE
      const params = {
        grant_type: 'authorization_code',
        code: code,
        client_id: this.clientId
      };

      // Use PKCE code_verifier (preferred for public clients)
      // If code_verifier is present, client_secret is NOT required per Yandex OAuth docs
      if (this.codeVerifier) {
        params.code_verifier = this.codeVerifier;
      } else if (this.clientSecret) {
        // Fallback to client_secret if PKCE wasn't used
        params.client_secret = this.clientSecret;
      }

      this.log('info', 'Exchanging code for token (PKCE: ' + !!this.codeVerifier + ')');

      const response = await fetch(`${YANDEX_OAUTH}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params)
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[Yandex OAuth] Token exchange failed:', {
          status: response.status,
          error: error
        });
        return {
          success: false,
          error: error.error_description || error.error || 'Authentication failed'
        };
      }

      const data = await response.json();

      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || null;
      // Yandex tokens typically expire in 1 year
      this.tokenExpiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null;

      // Clear code_verifier after successful exchange
      this.codeVerifier = null;

      this.log('info', 'Authentication successful');

      return {
        success: true,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: this.tokenExpiresAt
      };
    } catch (error) {
      this.log('error', 'Authentication error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start OAuth flow with local server callback
   * @returns {Promise<import('@library-manager/shared/src/sync/types').AuthResult>}
   */
  async authorizeWithBrowser() {
    return new Promise((resolve, reject) => {
      const redirectUri = 'http://localhost:8091/callback';

      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url, redirectUri);
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<html><body><h1>Ошибка авторизации</h1><p>${error}</p></body></html>`);
            server.close();
            reject(new Error(error));
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<html><body>
              <h1>Авторизация успешна!</h1>
              <p>Можете закрыть это окно и вернуться в приложение.</p>
              <script>setTimeout(() => window.close(), 2000)</script>
            </body></html>`);
            server.close();

            const result = await this.authenticate(code);
            resolve(result);
          } else {
            res.writeHead(400);
            res.end('No authorization code');
          }
        } catch (err) {
          server.close();
          reject(err);
        }
      });

      server.listen(8091, () => {
        const authUrl = this.getAuthUrl();
        this.log('info', 'Opening browser for authentication');
        shell.openExternal(authUrl);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Authorization timeout'));
      }, 300000);
    });
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${YANDEX_OAUTH}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();

      this.accessToken = data.access_token;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }
      this.tokenExpiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null;

      this.log('info', 'Token refreshed successfully');
    } catch (error) {
      this.log('error', 'Token refresh failed:', error.message);
      throw error;
    }
  }

  // ==================== Connection ====================

  /**
   * Test connection to Yandex Disk
   * @returns {Promise<import('@library-manager/shared/src/sync/types').ConnectionResult>}
   */
  async testConnection() {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${YANDEX_API}/`, {
        headers: {
          'Authorization': `OAuth ${this.accessToken}`
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();

      this.log('info', 'Connection test successful');

      return {
        success: true,
        userInfo: {
          name: data.user?.display_name || data.user?.login || 'Unknown',
          email: data.user?.login ? `${data.user.login}@yandex.ru` : undefined
        }
      };
    } catch (error) {
      this.log('error', 'Connection test failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ==================== File Operations ====================

  /**
   * Get full remote path with app folder prefix
   * @param {string} remotePath
   * @returns {string}
   */
  getFullRemotePath(remotePath) {
    // Ensure path starts with /
    const cleanPath = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
    return `${APP_FOLDER_PREFIX}${cleanPath}`;
  }

  /**
   * Upload file to Yandex Disk
   * @param {string} localPath - Local file path
   * @param {string} remotePath - Remote path (relative to app folder)
   */
  async uploadFile(localPath, remotePath) {
    await this.ensureValidToken();

    const fullPath = this.getFullRemotePath(remotePath);
    this.log('info', `Uploading: ${localPath} -> ${fullPath}`);

    // Ensure parent directory exists
    await this.ensureRemoteDirectory(remotePath);

    // Get upload URL
    const uploadUrlResponse = await fetch(
      `${YANDEX_API}/resources/upload?` + new URLSearchParams({
        path: fullPath,
        overwrite: 'true'
      }),
      {
        headers: {
          'Authorization': `OAuth ${this.accessToken}`
        }
      }
    );

    if (!uploadUrlResponse.ok) {
      const error = await uploadUrlResponse.json();
      throw new Error(error.message || `Failed to get upload URL: ${uploadUrlResponse.status}`);
    }

    const { href: uploadUrl } = await uploadUrlResponse.json();

    // Upload file
    const fileContent = fs.readFileSync(localPath);
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileContent
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    this.log('info', `Upload successful: ${remotePath}`);
  }

  /**
   * Download file from Yandex Disk
   * @param {string} remotePath - Remote path (relative to app folder)
   * @param {string} localPath - Local destination path
   */
  async downloadFile(remotePath, localPath) {
    await this.ensureValidToken();

    const fullPath = this.getFullRemotePath(remotePath);
    this.log('info', `Downloading: ${fullPath} -> ${localPath}`);

    // Get download URL
    const downloadUrlResponse = await fetch(
      `${YANDEX_API}/resources/download?` + new URLSearchParams({
        path: fullPath
      }),
      {
        headers: {
          'Authorization': `OAuth ${this.accessToken}`
        }
      }
    );

    if (!downloadUrlResponse.ok) {
      if (downloadUrlResponse.status === 404) {
        throw new Error(`File not found: ${remotePath}`);
      }
      const error = await downloadUrlResponse.json();
      throw new Error(error.message || `Failed to get download URL: ${downloadUrlResponse.status}`);
    }

    const { href: downloadUrl } = await downloadUrlResponse.json();

    // Download file
    const downloadResponse = await fetch(downloadUrl);

    if (!downloadResponse.ok) {
      throw new Error(`Download failed: ${downloadResponse.status}`);
    }

    // Ensure local directory exists
    const localDir = path.dirname(localPath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const buffer = await downloadResponse.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));

    this.log('info', `Download successful: ${remotePath}`);
  }

  /**
   * Delete file from Yandex Disk
   * @param {string} remotePath - Remote path (relative to app folder)
   */
  async deleteFile(remotePath) {
    await this.ensureValidToken();

    const fullPath = this.getFullRemotePath(remotePath);
    this.log('info', `Deleting: ${fullPath}`);

    const response = await fetch(
      `${YANDEX_API}/resources?` + new URLSearchParams({
        path: fullPath,
        permanently: 'true'
      }),
      {
        method: 'DELETE',
        headers: {
          'Authorization': `OAuth ${this.accessToken}`
        }
      }
    );

    // 204 = deleted, 202 = delete in progress, 404 = not found (ok)
    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(error.message || `Delete failed: ${response.status}`);
    }

    this.log('info', `Delete successful: ${remotePath}`);
  }

  /**
   * List files in remote directory
   * @param {string} remotePath - Remote directory path (relative to app folder)
   * @returns {Promise<import('@library-manager/shared/src/sync/types').RemoteFile[]>}
   */
  async listFiles(remotePath) {
    await this.ensureValidToken();

    const fullPath = this.getFullRemotePath(remotePath || '/');

    const response = await fetch(
      `${YANDEX_API}/resources?` + new URLSearchParams({
        path: fullPath,
        limit: '1000'
      }),
      {
        headers: {
          'Authorization': `OAuth ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return []; // Directory doesn't exist
      }
      const error = await response.json();
      throw new Error(error.message || `List failed: ${response.status}`);
    }

    const data = await response.json();
    const items = data._embedded?.items || [];

    return items.map(item => {
      // Yandex returns full disk path like "disk:/Приложения/Library Manager/LibraryManager/covers/file.jpg"
      // We need to extract just the relative path after our app folder name
      const appFolderMarker = '/LibraryManager/';
      const markerIndex = item.path.indexOf(appFolderMarker);
      const relativePath = markerIndex !== -1
        ? '/' + item.path.substring(markerIndex + appFolderMarker.length)
        : '/' + item.name;

      return {
        path: relativePath,
        name: item.name,
        size: item.size || 0,
        lastModified: new Date(item.modified),
        isDirectory: item.type === 'dir',
        md5: item.md5
      };
    });
  }

  // ==================== Quota ====================

  /**
   * Get storage quota information
   * @returns {Promise<import('@library-manager/shared/src/sync/types').QuotaInfo | null>}
   */
  async getQuota() {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${YANDEX_API}/`, {
        headers: {
          'Authorization': `OAuth ${this.accessToken}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      return {
        total: data.total_space,
        used: data.used_space,
        available: data.total_space - data.used_space
      };
    } catch (error) {
      this.log('error', 'Failed to get quota:', error.message);
      return null;
    }
  }

  // ==================== Utilities ====================

  /**
   * Create a directory on Yandex Disk
   * @param {string} path - Full path like app:/LibraryManager/folder
   */
  async createDirectory(path) {
    const response = await fetch(
      `${YANDEX_API}/resources?` + new URLSearchParams({ path }),
      {
        method: 'PUT',
        headers: {
          'Authorization': `OAuth ${this.accessToken}`
        }
      }
    );

    // 201 = created, 409 = already exists (ok)
    if (!response.ok && response.status !== 409) {
      const error = await response.json();
      if (error.error !== 'DiskPathPointsToExistentDirectoryError') {
        this.log('warn', `Failed to create directory ${path}:`, error);
        return false;
      }
    }
    return true;
  }

  /**
   * Ensure remote directory exists (including root LibraryManager folder)
   * @param {string} remotePath
   */
  async ensureRemoteDirectory(remotePath) {
    // Always ensure root app folder exists first
    await this.createDirectory(APP_FOLDER_PREFIX);

    const parts = remotePath.split('/').filter(Boolean);
    if (parts.length <= 1) return; // No parent directory needed for root-level files

    // Remove filename, keep only directories
    parts.pop();

    let currentPath = '';
    for (const part of parts) {
      currentPath += `/${part}`;
      const fullPath = this.getFullRemotePath(currentPath);
      await this.createDirectory(fullPath);
    }
  }
}

module.exports = YandexDiskProvider;
