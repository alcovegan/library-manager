/**
 * Dropbox Cloud Provider for React Native
 * Uses Dropbox API v2 for file sync with PKCE authentication
 *
 * API Docs: https://www.dropbox.com/developers/documentation/http/documentation
 * OAuth: https://www.dropbox.com/developers/reference/oauth-guide
 */

import { File } from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

import {
  BaseCloudProvider,
  AuthResult,
  ConnectionResult,
  RemoteFile,
  QuotaInfo,
} from './base';

const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_API = 'https://content.dropboxapi.com/2';

// Secure storage keys
const TOKEN_KEY = 'dropbox_access_token';
const REFRESH_TOKEN_KEY = 'dropbox_refresh_token';
const EXPIRES_KEY = 'dropbox_token_expires';

export interface DropboxConfig {
  appKey: string;
}

interface DropboxEntry {
  '.tag': 'file' | 'folder';
  name: string;
  path_display: string;
  size?: number;
  server_modified?: string;
  content_hash?: string;
}

/**
 * Dropbox provider implementation for React Native with PKCE support
 */
export class DropboxProvider extends BaseCloudProvider {
  private appKey: string;
  private codeVerifier: string | null = null;

  constructor(config: DropboxConfig) {
    super('dropbox', 'Dropbox');
    this.appKey = config.appKey;
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
    return DROPBOX_AUTH_URL;
  }

  async authenticate(code: string): Promise<AuthResult> {
    if (!this.codeVerifier) {
      return {
        success: false,
        error: 'Code verifier not available. Use authorizeWithBrowser instead.',
      };
    }

    try {
      const redirectUri = Linking.createURL('auth/dropbox');

      const response = await fetch(DROPBOX_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code,
          grant_type: 'authorization_code',
          client_id: this.appKey,
          redirect_uri: redirectUri,
          code_verifier: this.codeVerifier,
        }).toString(),
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
    const redirectUri = Linking.createURL('auth/dropbox');

    const params = new URLSearchParams({
      client_id: this.appKey,
      redirect_uri: redirectUri,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline',
    });

    const authUrl = `${DROPBOX_AUTH_URL}?${params.toString()}`;

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
      const response = await fetch(DROPBOX_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: tokens.refreshToken,
          grant_type: 'refresh_token',
          client_id: this.appKey,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();

      this.setTokens(
        data.access_token,
        tokens.refreshToken,
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

      const response = await fetch(`${DROPBOX_API}/users/get_current_account`, {
        method: 'POST',
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
          name: data.name?.display_name || 'Unknown',
          email: data.email,
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

  private formatPath(remotePath: string): string {
    if (!remotePath || remotePath === '/') return '';
    return remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.ensureValidToken();

    const dropboxPath = this.formatPath(remotePath);
    this.log('info', `Uploading: ${localPath} -> ${dropboxPath}`);

    // Read file as base64
    const file = new File(localPath);
    const fileContent = await file.base64();

    const response = await fetch(`${DROPBOX_CONTENT_API}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getTokens().accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
          mode: 'overwrite',
          autorename: false,
          mute: true,
        }),
      },
      body: this.base64ToArrayBuffer(fileContent),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_summary || `Upload failed: ${response.status}`);
    }

    this.log('info', `Upload successful: ${remotePath}`);
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    await this.ensureValidToken();

    const dropboxPath = this.formatPath(remotePath);
    this.log('info', `Downloading: ${dropboxPath} -> ${localPath}`);

    const response = await fetch(`${DROPBOX_CONTENT_API}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getTokens().accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
        }),
      },
    });

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error(`File not found: ${remotePath}`);
      }
      throw new Error(`Download failed: ${response.status}`);
    }

    // Get the blob and convert to base64
    const blob = await response.blob();
    const base64 = await this.blobToBase64(blob);

    const localFile = new File(localPath);
    await localFile.write(base64, { encoding: 'base64' });

    this.log('info', `Download successful: ${remotePath}`);
  }

  async deleteFile(remotePath: string): Promise<void> {
    await this.ensureValidToken();

    const dropboxPath = this.formatPath(remotePath);
    this.log('info', `Deleting: ${dropboxPath}`);

    const response = await fetch(`${DROPBOX_API}/files/delete_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getTokens().accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: dropboxPath,
      }),
    });

    if (!response.ok && response.status !== 409) {
      const error = await response.json();
      throw new Error(error.error_summary || `Delete failed: ${response.status}`);
    }

    this.log('info', `Delete successful: ${remotePath}`);
  }

  async listFiles(remotePath: string = ''): Promise<RemoteFile[]> {
    await this.ensureValidToken();

    const dropboxPath = this.formatPath(remotePath);

    const response = await fetch(`${DROPBOX_API}/files/list_folder`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getTokens().accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: dropboxPath,
        recursive: false,
        include_deleted: false,
        limit: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        return [];
      }
      throw new Error(`List failed: ${response.status}`);
    }

    const data = await response.json();
    const entries: DropboxEntry[] = data.entries || [];

    return entries.map((entry) => ({
      path: entry.path_display,
      name: entry.name,
      size: entry.size || 0,
      lastModified: entry.server_modified ? new Date(entry.server_modified) : new Date(),
      isDirectory: entry['.tag'] === 'folder',
      md5: entry.content_hash,
    }));
  }

  async fileExists(remotePath: string): Promise<boolean> {
    await this.ensureValidToken();

    const dropboxPath = this.formatPath(remotePath);

    try {
      const response = await fetch(`${DROPBOX_API}/files/get_metadata`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.getTokens().accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: dropboxPath,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  // ==================== Quota ====================

  async getQuota(): Promise<QuotaInfo | null> {
    try {
      await this.ensureValidToken();

      const response = await fetch(`${DROPBOX_API}/users/get_space_usage`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.getTokens().accessToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      const used = data.used || 0;
      const total = data.allocation?.allocated || 0;

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

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
