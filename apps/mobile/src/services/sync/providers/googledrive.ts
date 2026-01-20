/**
 * Google Drive Cloud Provider for React Native
 * Uses Google Drive API v3 for file sync
 *
 * API Docs: https://developers.google.com/drive/api/v3/about-sdk
 * OAuth: https://developers.google.com/identity/protocols/oauth2
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

import {
  BaseCloudProvider,
  AuthResult,
  ConnectionResult,
  RemoteFile,
  QuotaInfo,
} from './base';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

const SCOPES = ['https://www.googleapis.com/auth/drive.appdata'];

// Secure storage keys
const TOKEN_KEY = 'google_access_token';
const REFRESH_TOKEN_KEY = 'google_refresh_token';
const EXPIRES_KEY = 'google_token_expires';

export interface GoogleDriveConfig {
  clientId: string;
}

interface GoogleFileMetadata {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
  md5Checksum?: string;
  mimeType?: string;
}

/**
 * Google Drive provider implementation for React Native
 */
export class GoogleDriveProvider extends BaseCloudProvider {
  private clientId: string;
  private codeVerifier: string | null = null;

  constructor(config: GoogleDriveConfig) {
    super('googledrive', 'Google Drive');
    this.clientId = config.clientId;
  }

  // ==================== Token Persistence ====================

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

  private async clearStoredTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(EXPIRES_KEY);
  }

  // ==================== Authentication ====================

  private async generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    this.codeVerifier = this.base64UrlEncode(randomBytes);

    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      this.codeVerifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );

    const codeChallenge = digest
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return { codeVerifier: this.codeVerifier, codeChallenge };
  }

  private base64UrlEncode(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  getAuthUrl(): string {
    // This is a sync method, so we can't use async PKCE generation here
    // The actual auth flow uses authorizeWithBrowser which generates PKCE
    return GOOGLE_AUTH_URL;
  }

  async authenticate(code: string): Promise<AuthResult> {
    if (!this.codeVerifier) {
      return {
        success: false,
        error: 'Code verifier not available. Use authorizeWithBrowser instead.',
      };
    }

    try {
      const redirectUri = AuthSession.makeRedirectUri({ path: 'auth/google' });

      const body = new URLSearchParams({
        client_id: this.clientId,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: this.codeVerifier,
      });

      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = await response.json();
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

  async authorizeWithBrowser(): Promise<AuthResult> {
    const { codeChallenge } = await this.generatePKCE();
    const redirectUri = AuthSession.makeRedirectUri({ path: 'auth/google' });

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        return { success: false, error };
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
      const body = new URLSearchParams({
        client_id: this.clientId,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();

      this.setTokens(
        data.access_token,
        tokens.refreshToken, // Google doesn't always return a new refresh token
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

      const response = await fetch(`${GOOGLE_DRIVE_API}/about?fields=user,storageQuota`, {
        headers: {
          Authorization: `Bearer ${this.getTokens().accessToken}`,
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
          name: data.user?.displayName || 'Unknown',
          email: data.user?.emailAddress,
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

  private async findFile(fileName: string): Promise<GoogleFileMetadata | null> {
    await this.ensureValidToken();

    const response = await fetch(
      `${GOOGLE_DRIVE_API}/files?` +
        new URLSearchParams({
          spaces: 'appDataFolder',
          q: `name='${fileName}' and trashed=false`,
          fields: 'files(id,name,modifiedTime,size,md5Checksum)',
          pageSize: '1',
        }),
      {
        headers: {
          Authorization: `Bearer ${this.getTokens().accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to find file: ${response.status}`);
    }

    const data = await response.json();
    return data.files?.[0] || null;
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.ensureValidToken();

    const fileName = remotePath.split('/').pop() || remotePath;
    this.log('info', `Uploading: ${localPath} -> ${fileName}`);

    const existing = await this.findFile(fileName);

    // Read file as base64
    const fileContent = await FileSystem.readAsStringAsync(localPath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const mimeType = this.getContentType(localPath);

    const metadata = {
      name: fileName,
      parents: existing ? undefined : ['appDataFolder'],
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
        Authorization: `Bearer ${this.getTokens().accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Upload failed: ${response.status}`);
    }

    this.log('info', `Upload successful: ${fileName}`);
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    await this.ensureValidToken();

    const fileName = remotePath.split('/').pop() || remotePath;
    this.log('info', `Downloading: ${fileName} -> ${localPath}`);

    const remoteFile = await this.findFile(fileName);
    if (!remoteFile) {
      throw new Error(`File not found: ${fileName}`);
    }

    const response = await fetch(
      `${GOOGLE_DRIVE_API}/files/${remoteFile.id}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${this.getTokens().accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = this.arrayBufferToBase64(arrayBuffer);
    await FileSystem.writeAsStringAsync(localPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    this.log('info', `Download successful: ${fileName}`);
  }

  async deleteFile(remotePath: string): Promise<void> {
    await this.ensureValidToken();

    const fileName = remotePath.split('/').pop() || remotePath;
    this.log('info', `Deleting: ${fileName}`);

    const file = await this.findFile(fileName);
    if (!file) {
      this.log('info', `File not found, nothing to delete: ${fileName}`);
      return;
    }

    const response = await fetch(`${GOOGLE_DRIVE_API}/files/${file.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.getTokens().accessToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Delete failed: ${response.status}`);
    }

    this.log('info', `Delete successful: ${fileName}`);
  }

  async listFiles(_remotePath: string = ''): Promise<RemoteFile[]> {
    await this.ensureValidToken();

    const response = await fetch(
      `${GOOGLE_DRIVE_API}/files?` +
        new URLSearchParams({
          spaces: 'appDataFolder',
          q: 'trashed=false',
          fields: 'files(id,name,modifiedTime,size,md5Checksum,mimeType)',
          pageSize: '1000',
        }),
      {
        headers: {
          Authorization: `Bearer ${this.getTokens().accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`List failed: ${response.status}`);
    }

    const data = await response.json();
    const files: GoogleFileMetadata[] = data.files || [];

    return files.map((file) => ({
      path: file.name,
      name: file.name,
      size: parseInt(file.size || '0'),
      lastModified: new Date(file.modifiedTime),
      isDirectory: file.mimeType === 'application/vnd.google-apps.folder',
      md5: file.md5Checksum,
    }));
  }

  async fileExists(remotePath: string): Promise<boolean> {
    const fileName = remotePath.split('/').pop() || remotePath;
    const file = await this.findFile(fileName);
    return file !== null;
  }

  // ==================== Quota ====================

  async getQuota(): Promise<QuotaInfo | null> {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${GOOGLE_DRIVE_API}/about?fields=storageQuota`, {
        headers: {
          Authorization: `Bearer ${this.getTokens().accessToken}`,
        },
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
        total,
        used,
        available: total - used,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', 'Failed to get quota:', message);
      return null;
    }
  }

  // ==================== Utilities ====================

  private createMultipartBody(
    metadata: object,
    contentBase64: string,
    mimeType: string,
    boundary: string
  ): string {
    return [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${mimeType}`,
      'Content-Transfer-Encoding: base64',
      '',
      contentBase64,
      `--${boundary}--`,
    ].join('\r\n');
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
