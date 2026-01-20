/**
 * Dropbox Cloud Provider
 * Uses Dropbox API v2 for file sync with PKCE authentication
 *
 * API Docs: https://www.dropbox.com/developers/documentation/http/documentation
 * OAuth: https://www.dropbox.com/developers/reference/oauth-guide
 */

const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const http = require('http');
const crypto = require('crypto');
const BaseCloudProvider = require('./base');

const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_API = 'https://content.dropboxapi.com/2';

/**
 * Dropbox provider implementation with PKCE support
 * Uses App Folder access (sandbox mode)
 */
class DropboxProvider extends BaseCloudProvider {
  /**
   * @param {string} appKey - Dropbox App Key (client_id)
   */
  constructor(appKey) {
    super('dropbox', 'Dropbox');
    this.appKey = appKey;
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
    const redirectUri = 'http://localhost:8093/callback';

    const params = new URLSearchParams({
      client_id: this.appKey,
      redirect_uri: redirectUri,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline'
    });

    return `${DROPBOX_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Authenticate with authorization code (PKCE - no client_secret needed)
   * @param {string} code - OAuth authorization code
   * @returns {Promise<import('@library-manager/shared/src/sync/types').AuthResult>}
   */
  async authenticate(code) {
    try {
      const redirectUri = 'http://localhost:8093/callback';

      const response = await fetch(DROPBOX_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          code: code,
          grant_type: 'authorization_code',
          client_id: this.appKey,
          redirect_uri: redirectUri,
          code_verifier: this.codeVerifier
        })
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
      const redirectUri = 'http://localhost:8093/callback';

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

      server.listen(8093, () => {
        const authUrl = this.getAuthUrl();
        this.log('info', 'Opening browser for Dropbox authentication');
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
      const response = await fetch(DROPBOX_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
          client_id: this.appKey
        })
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
   * Test connection to Dropbox
   * @returns {Promise<import('@library-manager/shared/src/sync/types').ConnectionResult>}
   */
  async testConnection() {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${DROPBOX_API}/users/get_current_account`, {
        method: 'POST',
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
          name: data.name?.display_name || 'Unknown',
          email: data.email
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
   * Format path for Dropbox API (must start with / for app folder)
   * @param {string} remotePath
   * @returns {string}
   */
  formatPath(remotePath) {
    if (!remotePath || remotePath === '/') return '';
    return remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
  }

  /**
   * Upload file to Dropbox
   * @param {string} localPath - Local file path
   * @param {string} remotePath - Remote path
   */
  async uploadFile(localPath, remotePath) {
    await this.ensureValidToken();

    const dropboxPath = this.formatPath(remotePath);
    this.log('info', `Uploading: ${localPath} -> ${dropboxPath}`);

    const fileContent = fs.readFileSync(localPath);

    const response = await fetch(`${DROPBOX_CONTENT_API}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
          mode: 'overwrite',
          autorename: false,
          mute: true
        })
      },
      body: fileContent
    });

    if (!response.ok) {
      // Try to get error details - may be JSON or plain text
      let errorMessage = `Upload failed: ${response.status}`;
      try {
        const text = await response.text();
        this.log('error', `Upload error ${response.status}:`, text);
        try {
          const errorJson = JSON.parse(text);
          errorMessage = errorJson.error_summary || errorJson.error || errorMessage;
        } catch {
          // Not JSON, use text directly if meaningful
          if (text && text.length < 200) {
            errorMessage = text;
          }
        }
      } catch {
        // Ignore
      }
      throw new Error(errorMessage);
    }

    this.log('info', `Upload successful: ${remotePath}`);
  }

  /**
   * Download file from Dropbox
   * @param {string} remotePath - Remote path
   * @param {string} localPath - Local destination path
   */
  async downloadFile(remotePath, localPath) {
    await this.ensureValidToken();

    const dropboxPath = this.formatPath(remotePath);
    this.log('info', `Downloading: ${dropboxPath} -> ${localPath}`);

    const response = await fetch(`${DROPBOX_CONTENT_API}/files/download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath
        })
      }
    });

    if (!response.ok) {
      // Try to get error details from response
      let errorDetails = null;
      try {
        // Error info might be in Dropbox-API-Result header for content endpoints
        const apiResult = response.headers.get('Dropbox-API-Result');
        if (apiResult) {
          errorDetails = JSON.parse(apiResult);
        } else {
          // Or in the response body
          const text = await response.text();
          if (text) {
            errorDetails = JSON.parse(text);
          }
        }
      } catch {
        // Ignore parse errors
      }

      this.log('error', `Download error ${response.status}:`, errorDetails);

      // Check for "not found" in various formats
      // Dropbox may return 400 or 409 for missing files depending on context
      const isNotFound =
        response.status === 409 ||
        response.status === 400 || // Dropbox sometimes returns 400 for missing files in App Folder
        errorDetails?.error?.['.tag'] === 'path' ||
        errorDetails?.error?.path?.['.tag'] === 'not_found' ||
        errorDetails?.error_summary?.includes('not_found') ||
        errorDetails?.error_summary?.includes('path/not_found');

      if (isNotFound) {
        throw new Error(`File not found: ${remotePath}`);
      }

      throw new Error(`Download failed: ${response.status}`);
    }

    // Ensure local directory exists
    const localDir = path.dirname(localPath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));

    this.log('info', `Download successful: ${remotePath}`);
  }

  /**
   * Delete file from Dropbox
   * @param {string} remotePath - Remote path
   */
  async deleteFile(remotePath) {
    await this.ensureValidToken();

    const dropboxPath = this.formatPath(remotePath);
    this.log('info', `Deleting: ${dropboxPath}`);

    const response = await fetch(`${DROPBOX_API}/files/delete_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: dropboxPath
      })
    });

    // 409 with path/not_found is OK
    if (!response.ok && response.status !== 409) {
      const error = await response.json();
      throw new Error(error.error_summary || `Delete failed: ${response.status}`);
    }

    this.log('info', `Delete successful: ${remotePath}`);
  }

  /**
   * List files in Dropbox folder
   * @param {string} remotePath - Remote directory path
   * @returns {Promise<import('@library-manager/shared/src/sync/types').RemoteFile[]>}
   */
  async listFiles(remotePath = '') {
    await this.ensureValidToken();

    const dropboxPath = this.formatPath(remotePath);

    const response = await fetch(`${DROPBOX_API}/files/list_folder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: dropboxPath,
        recursive: false,
        include_deleted: false,
        limit: 2000
      })
    });

    if (!response.ok) {
      if (response.status === 409) {
        // Folder might not exist
        return [];
      }
      throw new Error(`List failed: ${response.status}`);
    }

    const data = await response.json();
    const entries = data.entries || [];

    return entries.map(entry => ({
      path: entry.path_display,
      name: entry.name,
      size: entry.size || 0,
      lastModified: entry.server_modified ? new Date(entry.server_modified) : new Date(),
      isDirectory: entry['.tag'] === 'folder',
      md5: entry.content_hash
    }));
  }

  /**
   * Check if file exists
   * @param {string} remotePath
   * @returns {Promise<boolean>}
   */
  async fileExists(remotePath) {
    await this.ensureValidToken();

    const dropboxPath = this.formatPath(remotePath);

    try {
      const response = await fetch(`${DROPBOX_API}/files/get_metadata`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: dropboxPath
        })
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  // ==================== Quota ====================

  /**
   * Get storage quota information
   * @returns {Promise<import('@library-manager/shared/src/sync/types').QuotaInfo | null>}
   */
  async getQuota() {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${DROPBOX_API}/users/get_space_usage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      const used = data.used || 0;
      const total = data.allocation?.allocated || 0;

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
   * Ensure remote directory exists (create folder)
   * @param {string} remotePath
   */
  async ensureRemoteDirectory(remotePath) {
    const parts = remotePath.split('/').filter(Boolean);
    if (parts.length <= 1) return;

    parts.pop(); // Remove filename

    let currentPath = '';
    for (const part of parts) {
      currentPath += `/${part}`;

      try {
        await fetch(`${DROPBOX_API}/files/create_folder_v2`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            path: currentPath,
            autorename: false
          })
        });
      } catch {
        // Folder might already exist, ignore
      }
    }
  }
}

module.exports = DropboxProvider;
