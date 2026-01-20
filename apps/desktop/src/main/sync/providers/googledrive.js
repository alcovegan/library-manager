/**
 * Google Drive Cloud Provider
 * Uses Google Drive API v3 for file sync
 *
 * API Docs: https://developers.google.com/drive/api/v3/about-sdk
 * OAuth: https://developers.google.com/identity/protocols/oauth2
 */

const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const http = require('http');
const crypto = require('crypto');
const BaseCloudProvider = require('./base');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// Scope for app-specific folder only
const SCOPES = ['https://www.googleapis.com/auth/drive.appdata'];

/**
 * Google Drive provider implementation
 */
class GoogleDriveProvider extends BaseCloudProvider {
  /**
   * @param {string} clientId - Google OAuth Client ID
   * @param {string} [clientSecret] - Google OAuth Client Secret (optional with PKCE)
   */
  constructor(clientId, clientSecret = null) {
    super('googledrive', 'Google Drive');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.codeVerifier = null;
  }

  // ==================== Authentication ====================

  /**
   * Generate PKCE code verifier and challenge
   */
  generatePKCE() {
    this.codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(this.codeVerifier)
      .digest('base64url');
    return { codeVerifier: this.codeVerifier, codeChallenge };
  }

  /**
   * Get OAuth authorization URL with PKCE
   */
  getAuthUrl() {
    const { codeChallenge } = this.generatePKCE();
    const redirectUri = 'http://localhost:8092/callback';

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Authenticate with authorization code
   * @param {string} code - OAuth authorization code
   * @returns {Promise<import('@library-manager/shared/src/sync/types').AuthResult>}
   */
  async authenticate(code) {
    try {
      const redirectUri = 'http://localhost:8092/callback';

      const body = new URLSearchParams({
        client_id: this.clientId,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: this.codeVerifier
      });

      // Add client_secret if available (for confidential clients)
      if (this.clientSecret) {
        body.append('client_secret', this.clientSecret);
      }

      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error_description || error.error || 'Authentication failed'
        };
      }

      const data = await response.json();

      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || null;
      this.tokenExpiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null;

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
      const redirectUri = 'http://localhost:8092/callback';

      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url, redirectUri);
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<html><body><h1>Authorization Error</h1><p>${error}</p></body></html>`);
            server.close();
            reject(new Error(error));
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<html><body>
              <h1>Authorization Successful!</h1>
              <p>You can close this window and return to the application.</p>
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

      server.listen(8092, () => {
        const authUrl = this.getAuthUrl();
        this.log('info', 'Opening browser for Google authentication');
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
      const body = new URLSearchParams({
        client_id: this.clientId,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token'
      });

      if (this.clientSecret) {
        body.append('client_secret', this.clientSecret);
      }

      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();

      this.accessToken = data.access_token;
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
   * Test connection to Google Drive
   * @returns {Promise<import('@library-manager/shared/src/sync/types').ConnectionResult>}
   */
  async testConnection() {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${GOOGLE_DRIVE_API}/about?fields=user,storageQuota`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
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
          name: data.user?.displayName || 'Unknown',
          email: data.user?.emailAddress
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
   * Find file by name in appDataFolder
   * @param {string} fileName
   * @returns {Promise<{id: string, name: string, modifiedTime: string} | null>}
   */
  async findFile(fileName) {
    await this.ensureValidToken();

    const response = await fetch(
      `${GOOGLE_DRIVE_API}/files?` + new URLSearchParams({
        spaces: 'appDataFolder',
        q: `name='${fileName}' and trashed=false`,
        fields: 'files(id,name,modifiedTime,size,md5Checksum)',
        pageSize: '1'
      }),
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to find file: ${response.status}`);
    }

    const data = await response.json();
    return data.files?.[0] || null;
  }

  /**
   * Upload file to Google Drive appDataFolder
   * @param {string} localPath - Local file path
   * @param {string} remotePath - Remote file name
   */
  async uploadFile(localPath, remotePath) {
    await this.ensureValidToken();

    const fileName = path.basename(remotePath);
    this.log('info', `Uploading: ${localPath} -> ${fileName}`);

    // Check if file exists
    const existing = await this.findFile(fileName);

    const fileContent = fs.readFileSync(localPath);
    const mimeType = this.getContentType(localPath);

    const metadata = {
      name: fileName,
      parents: existing ? undefined : ['appDataFolder']
    };

    // Create multipart body
    const boundary = 'library_manager_boundary_' + Date.now();
    const body = this.createMultipartBody(metadata, fileContent, mimeType, boundary);

    const url = existing
      ? `${GOOGLE_UPLOAD_API}/files/${existing.id}?uploadType=multipart`
      : `${GOOGLE_UPLOAD_API}/files?uploadType=multipart`;

    const response = await fetch(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Upload failed: ${response.status}`);
    }

    this.log('info', `Upload successful: ${fileName}`);
  }

  /**
   * Download file from Google Drive appDataFolder
   * @param {string} remotePath - Remote file name
   * @param {string} localPath - Local destination path
   */
  async downloadFile(remotePath, localPath) {
    await this.ensureValidToken();

    const fileName = path.basename(remotePath);
    this.log('info', `Downloading: ${fileName} -> ${localPath}`);

    const file = await this.findFile(fileName);
    if (!file) {
      throw new Error(`File not found: ${fileName}`);
    }

    const response = await fetch(
      `${GOOGLE_DRIVE_API}/files/${file.id}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    // Ensure local directory exists
    const localDir = path.dirname(localPath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));

    this.log('info', `Download successful: ${fileName}`);
  }

  /**
   * Delete file from Google Drive appDataFolder
   * @param {string} remotePath - Remote file name
   */
  async deleteFile(remotePath) {
    await this.ensureValidToken();

    const fileName = path.basename(remotePath);
    this.log('info', `Deleting: ${fileName}`);

    const file = await this.findFile(fileName);
    if (!file) {
      this.log('info', `File not found, nothing to delete: ${fileName}`);
      return;
    }

    const response = await fetch(
      `${GOOGLE_DRIVE_API}/files/${file.id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Delete failed: ${response.status}`);
    }

    this.log('info', `Delete successful: ${fileName}`);
  }

  /**
   * List files in appDataFolder
   * @param {string} remotePath - Ignored for Google Drive (flat structure)
   * @returns {Promise<import('@library-manager/shared/src/sync/types').RemoteFile[]>}
   */
  async listFiles(remotePath = '') {
    await this.ensureValidToken();

    const response = await fetch(
      `${GOOGLE_DRIVE_API}/files?` + new URLSearchParams({
        spaces: 'appDataFolder',
        q: 'trashed=false',
        fields: 'files(id,name,modifiedTime,size,md5Checksum,mimeType)',
        pageSize: '1000'
      }),
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`List failed: ${response.status}`);
    }

    const data = await response.json();
    const files = data.files || [];

    return files.map(file => ({
      path: file.name,
      name: file.name,
      size: parseInt(file.size) || 0,
      lastModified: new Date(file.modifiedTime),
      isDirectory: file.mimeType === 'application/vnd.google-apps.folder',
      md5: file.md5Checksum
    }));
  }

  /**
   * Check if file exists
   * @param {string} remotePath
   * @returns {Promise<boolean>}
   */
  async fileExists(remotePath) {
    const fileName = path.basename(remotePath);
    const file = await this.findFile(fileName);
    return file !== null;
  }

  // ==================== Quota ====================

  /**
   * Get storage quota information
   * @returns {Promise<import('@library-manager/shared/src/sync/types').QuotaInfo | null>}
   */
  async getQuota() {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${GOOGLE_DRIVE_API}/about?fields=storageQuota`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const quota = data.storageQuota;

      if (!quota) return null;

      const total = parseInt(quota.limit) || 0;
      const used = parseInt(quota.usage) || 0;

      return {
        total: total,
        used: used,
        available: total - used
      };
    } catch (error) {
      this.log('error', 'Failed to get quota:', error.message);
      return null;
    }
  }

  // ==================== Utilities ====================

  /**
   * Create multipart body for upload
   * @param {object} metadata
   * @param {Buffer} content
   * @param {string} mimeType
   * @param {string} boundary
   * @returns {Buffer}
   */
  createMultipartBody(metadata, content, mimeType, boundary) {
    const metadataStr = JSON.stringify(metadata);

    const parts = [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      metadataStr,
      `\r\n--${boundary}\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`
    ];

    const header = Buffer.from(parts.join(''));
    const footer = Buffer.from(`\r\n--${boundary}--`);

    return Buffer.concat([header, content, footer]);
  }
}

module.exports = GoogleDriveProvider;
