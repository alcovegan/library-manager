/**
 * Yandex Disk Cloud Provider for React Native
 * Uses Yandex Disk REST API for file sync
 *
 * API Docs: https://yandex.ru/dev/disk/api/concepts/about.html
 * OAuth: https://oauth.yandex.ru/
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Needed for expo-web-browser
WebBrowser.maybeCompleteAuthSession();

import {
  BaseCloudProvider,
  AuthResult,
  ConnectionResult,
  RemoteFile,
  QuotaInfo,
} from './base';

const YANDEX_API = 'https://cloud-api.yandex.net/v1/disk';
const YANDEX_OAUTH = 'https://oauth.yandex.ru';
const APP_FOLDER_PREFIX = 'app:/LibraryManager';

// Secure storage keys
const TOKEN_KEY = 'yandex_access_token';
const REFRESH_TOKEN_KEY = 'yandex_refresh_token';
const EXPIRES_KEY = 'yandex_token_expires';
const CODE_VERIFIER_KEY = 'yandex_code_verifier';

/**
 * Generate base64url encoding (RFC 4648)
 */
function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export interface YandexConfig {
  clientId: string;
}

/**
 * Yandex Disk provider implementation for React Native
 */
export class YandexDiskProvider extends BaseCloudProvider {
  private clientId: string;

  constructor(config: YandexConfig) {
    super('yandex', 'Yandex Disk');
    this.clientId = config.clientId;
  }

  // ==================== Token Persistence ====================

  /**
   * Load tokens from secure storage
   */
  async loadStoredTokens(): Promise<boolean> {
    try {
      const accessToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      const expiresStr = await SecureStore.getItemAsync(EXPIRES_KEY);

      if (accessToken) {
        this.setTokens(
          accessToken,
          refreshToken ?? undefined,
          expiresStr ? new Date(expiresStr) : undefined
        );
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Save tokens to secure storage
   */
  private async saveTokens(): Promise<void> {
    const tokens = this.getTokens();
    if (tokens.accessToken) {
      await SecureStore.setItemAsync(TOKEN_KEY, tokens.accessToken);
    }
    if (tokens.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
    if (tokens.expiresAt) {
      await SecureStore.setItemAsync(EXPIRES_KEY, tokens.expiresAt.toISOString());
    }
  }

  /**
   * Clear tokens from secure storage
   */
  private async clearStoredTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(EXPIRES_KEY);
    await SecureStore.deleteItemAsync(CODE_VERIFIER_KEY);
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private async generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    // Generate random bytes for code verifier
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const codeVerifier = base64url(new Uint8Array(randomBytes));

    // Generate code challenge using SHA256
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );

    // Convert to base64url
    const codeChallenge = hash
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    // Store code verifier for token exchange
    await SecureStore.setItemAsync(CODE_VERIFIER_KEY, codeVerifier);

    return { codeVerifier, codeChallenge };
  }

  // ==================== Authentication ====================

  getAuthUrl(): string {
    // This is a sync version that returns a placeholder
    // The actual URL with PKCE is generated in authorizeWithBrowser
    const redirectUri = AuthSession.makeRedirectUri({ path: 'auth/yandex' });
    console.log('[Yandex] OAuth redirect URI:', redirectUri);
    return `${YANDEX_OAUTH}/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  async authenticate(code: string): Promise<AuthResult> {
    try {
      // Get stored code verifier for PKCE
      const codeVerifier = await SecureStore.getItemAsync(CODE_VERIFIER_KEY);

      if (!codeVerifier) {
        return {
          success: false,
          error: 'PKCE code verifier not found. Please try again.',
        };
      }

      this.log('info', 'Exchanging code for token (PKCE)');

      const response = await fetch(`${YANDEX_OAUTH}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: this.clientId,
          code_verifier: codeVerifier,
        }).toString(),
      });

      // Clear code verifier after use
      await SecureStore.deleteItemAsync(CODE_VERIFIER_KEY);

      if (!response.ok) {
        const error = await response.json();
        console.error('[Yandex] Token exchange failed:', error);
        return {
          success: false,
          error: error.error_description || error.error || 'Authentication failed',
        };
      }

      const data = await response.json();

      this.setTokens(
        data.access_token,
        data.refresh_token,
        data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined
      );

      await this.saveTokens();
      this.log('info', 'Authentication successful');

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: this.getTokens().expiresAt ?? undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'Authentication error:', message);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Start OAuth flow with WebBrowser using PKCE
   */
  async authorizeWithBrowser(): Promise<AuthResult> {
    const redirectUri = AuthSession.makeRedirectUri({ path: 'auth/yandex' });
    console.log('[Yandex] Starting OAuth with redirect URI:', redirectUri);

    // Generate PKCE challenge
    const { codeChallenge } = await this.generatePKCE();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      force_confirm: 'yes',
    });

    const authUrl = `${YANDEX_OAUTH}/authorize?${params.toString()}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        return {
          success: false,
          error: error,
        };
      }

      if (code) {
        return this.authenticate(code);
      }
    }

    return {
      success: false,
      error: 'Authorization cancelled or failed',
    };
  }

  async refreshToken(): Promise<void> {
    const tokens = this.getTokens();
    if (!tokens.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${YANDEX_OAUTH}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
          client_id: this.clientId,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();

      this.setTokens(
        data.access_token,
        data.refresh_token || tokens.refreshToken,
        data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined
      );

      await this.saveTokens();
      this.log('info', 'Token refreshed successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'Token refresh failed:', message);
      throw error;
    }
  }

  logout(): void {
    super.logout();
    this.clearStoredTokens().catch(() => {});
  }

  // ==================== Connection ====================

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${YANDEX_API}/`, {
        headers: {
          Authorization: `OAuth ${this.getTokens().accessToken}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      this.log('info', 'Connection test successful');

      return {
        success: true,
        userInfo: {
          name: data.user?.display_name || data.user?.login || 'Unknown',
          email: data.user?.login ? `${data.user.login}@yandex.ru` : undefined,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'Connection test failed:', message);
      return {
        success: false,
        error: message,
      };
    }
  }

  // ==================== File Operations ====================

  private getFullRemotePath(remotePath: string): string {
    const cleanPath = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
    return `${APP_FOLDER_PREFIX}${cleanPath}`;
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.ensureValidToken();

    const fullPath = this.getFullRemotePath(remotePath);
    this.log('info', `Uploading: ${localPath} -> ${fullPath}`);

    // Ensure parent directory exists
    await this.ensureRemoteDir(remotePath);

    // Get upload URL
    const uploadUrlResponse = await fetch(
      `${YANDEX_API}/resources/upload?` +
        new URLSearchParams({
          path: fullPath,
          overwrite: 'true',
        }),
      {
        headers: {
          Authorization: `OAuth ${this.getTokens().accessToken}`,
        },
      }
    );

    if (!uploadUrlResponse.ok) {
      const error = await uploadUrlResponse.json();
      throw new Error(error.message || `Failed to get upload URL: ${uploadUrlResponse.status}`);
    }

    const { href: uploadUrl } = await uploadUrlResponse.json();

    // Read file and upload
    const fileContent = await FileSystem.readAsStringAsync(localPath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: this.base64ToArrayBuffer(fileContent),
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    this.log('info', `Upload successful: ${remotePath}`);
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    await this.ensureValidToken();

    const fullPath = this.getFullRemotePath(remotePath);
    this.log('info', `Downloading: ${fullPath} -> ${localPath}`);

    // Get download URL
    const downloadUrlResponse = await fetch(
      `${YANDEX_API}/resources/download?` +
        new URLSearchParams({
          path: fullPath,
        }),
      {
        headers: {
          Authorization: `OAuth ${this.getTokens().accessToken}`,
        },
      }
    );

    if (!downloadUrlResponse.ok) {
      if (downloadUrlResponse.status === 404) {
        throw new Error(`File not found: ${remotePath}`);
      }
      const error = await downloadUrlResponse.json();
      throw new Error(
        error.message || `Failed to get download URL: ${downloadUrlResponse.status}`
      );
    }

    const { href: downloadUrl } = await downloadUrlResponse.json();

    // Download to local path
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = this.arrayBufferToBase64(arrayBuffer);
    await FileSystem.writeAsStringAsync(localPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    this.log('info', `Download successful: ${remotePath}`);
  }

  async deleteFile(remotePath: string): Promise<void> {
    await this.ensureValidToken();

    const fullPath = this.getFullRemotePath(remotePath);
    this.log('info', `Deleting: ${fullPath}`);

    const response = await fetch(
      `${YANDEX_API}/resources?` +
        new URLSearchParams({
          path: fullPath,
          permanently: 'true',
        }),
      {
        method: 'DELETE',
        headers: {
          Authorization: `OAuth ${this.getTokens().accessToken}`,
        },
      }
    );

    // 204 = deleted, 202 = delete in progress, 404 = not found (ok)
    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(error.message || `Delete failed: ${response.status}`);
    }

    this.log('info', `Delete successful: ${remotePath}`);
  }

  async listFiles(remotePath: string): Promise<RemoteFile[]> {
    await this.ensureValidToken();

    const fullPath = this.getFullRemotePath(remotePath || '/');

    const response = await fetch(
      `${YANDEX_API}/resources?` +
        new URLSearchParams({
          path: fullPath,
          limit: '1000',
        }),
      {
        headers: {
          Authorization: `OAuth ${this.getTokens().accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      const error = await response.json();
      throw new Error(error.message || `List failed: ${response.status}`);
    }

    const data = await response.json();
    const items = data._embedded?.items || [];

    return items.map(
      (item: {
        path: string;
        name: string;
        size?: number;
        modified: string;
        type: string;
        md5?: string;
      }) => {
        // Yandex returns full disk path like "disk:/Приложения/Library Manager/LibraryManager/covers/file.jpg"
        // We need to extract just the relative path after our app folder name
        // Look for "/LibraryManager/" and take everything after it
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
          md5: item.md5,
        };
      }
    );
  }

  // ==================== Quota ====================

  async getQuota(): Promise<QuotaInfo | null> {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${YANDEX_API}/`, {
        headers: {
          Authorization: `OAuth ${this.getTokens().accessToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      return {
        total: data.total_space,
        used: data.used_space,
        available: data.total_space - data.used_space,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'Failed to get quota:', message);
      return null;
    }
  }

  // ==================== Utilities ====================

  private async ensureRemoteDir(remotePath: string): Promise<void> {
    const parts = remotePath.split('/').filter(Boolean);
    if (parts.length <= 1) return;

    parts.pop(); // Remove filename

    let currentPath = '';
    for (const part of parts) {
      currentPath += `/${part}`;
      const fullPath = this.getFullRemotePath(currentPath);

      const response = await fetch(
        `${YANDEX_API}/resources?` +
          new URLSearchParams({
            path: fullPath,
          }),
        {
          method: 'PUT',
          headers: {
            Authorization: `OAuth ${this.getTokens().accessToken}`,
          },
        }
      );

      // 201 = created, 409 = already exists (ok)
      if (!response.ok && response.status !== 409) {
        // Ignore "already exists" errors
        try {
          const error = await response.json();
          if (error.error !== 'DiskPathPointsToExistentDirectoryError') {
            this.log('warn', `Failed to create directory ${currentPath}:`, error);
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
