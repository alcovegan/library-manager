/**
 * Base Cloud Storage Provider
 * Abstract class for cloud storage providers (Yandex Disk, Google Drive, Dropbox)
 */

import * as FileSystem from 'expo-file-system/legacy';

// Types from @library-manager/shared
// Re-exported here for convenience
export type CloudProviderType = 'yandex' | 'googledrive' | 'dropbox';

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

export interface RemoteFile {
  path: string;
  name: string;
  size: number;
  lastModified: Date;
  isDirectory: boolean;
  md5?: string;
}

export interface ConnectionResult {
  success: boolean;
  error?: string;
  userInfo?: {
    name: string;
    email?: string;
  };
}

export interface QuotaInfo {
  used: number;
  total: number;
  available: number;
}

export interface CloudStorageProvider {
  readonly type: CloudProviderType;
  readonly displayName: string;

  isAuthenticated(): boolean;
  getAuthUrl(): string;
  authenticate(code: string): Promise<AuthResult>;
  authorizeWithBrowser(): Promise<AuthResult>;
  refreshToken(): Promise<void>;
  logout(): void;

  testConnection(): Promise<ConnectionResult>;

  uploadFile(localPath: string, remotePath: string): Promise<void>;
  downloadFile(remotePath: string, localPath: string): Promise<void>;
  deleteFile(remotePath: string): Promise<void>;
  listFiles(remotePath: string): Promise<RemoteFile[]>;
  fileExists(remotePath: string): Promise<boolean>;

  uploadJson(remotePath: string, data: unknown): Promise<void>;
  downloadJson<T>(remotePath: string): Promise<T | null>;

  getQuota(): Promise<QuotaInfo | null>;
}

/**
 * Base class for cloud storage providers
 * All cloud providers (Yandex, Google Drive, Dropbox) should extend this class
 */
export abstract class BaseCloudProvider implements CloudStorageProvider {
  readonly type: CloudProviderType;
  readonly displayName: string;

  protected accessToken: string | null = null;
  protected refreshToken_: string | null = null;
  protected tokenExpiresAt: Date | null = null;

  constructor(type: CloudProviderType, displayName: string) {
    this.type = type;
    this.displayName = displayName;
  }

  // ==================== Authentication ====================

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  abstract getAuthUrl(): string;

  abstract authenticate(code: string): Promise<AuthResult>;

  abstract authorizeWithBrowser(): Promise<AuthResult>;

  abstract refreshToken(): Promise<void>;

  logout(): void {
    this.accessToken = null;
    this.refreshToken_ = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Set tokens from saved state
   */
  setTokens(accessToken: string, refreshToken?: string, expiresAt?: Date): void {
    this.accessToken = accessToken;
    this.refreshToken_ = refreshToken ?? null;
    this.tokenExpiresAt = expiresAt ?? null;
  }

  /**
   * Get current tokens for persistence
   */
  getTokens(): { accessToken: string | null; refreshToken: string | null; expiresAt: Date | null } {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken_,
      expiresAt: this.tokenExpiresAt,
    };
  }

  /**
   * Check if token needs refresh
   */
  protected isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return false;
    // Refresh 5 minutes before expiry
    const bufferMs = 5 * 60 * 1000;
    return Date.now() > this.tokenExpiresAt.getTime() - bufferMs;
  }

  /**
   * Ensure we have a valid token, refreshing if needed
   */
  protected async ensureValidToken(): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }
    if (this.isTokenExpired() && this.refreshToken_) {
      await this.refreshToken();
    }
  }

  // ==================== Connection ====================

  abstract testConnection(): Promise<ConnectionResult>;

  // ==================== File Operations ====================

  abstract uploadFile(localPath: string, remotePath: string): Promise<void>;

  abstract downloadFile(remotePath: string, localPath: string): Promise<void>;

  abstract deleteFile(remotePath: string): Promise<void>;

  abstract listFiles(remotePath: string): Promise<RemoteFile[]>;

  async fileExists(remotePath: string): Promise<boolean> {
    try {
      const parentPath = this.getParentPath(remotePath);
      const fileName = this.getFileName(remotePath);
      const files = await this.listFiles(parentPath);
      return files.some((f) => f.name === fileName);
    } catch {
      return false;
    }
  }

  // ==================== JSON Helpers ====================

  private getCacheDir(): string {
    return FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  }

  async uploadJson(remotePath: string, data: unknown): Promise<void> {
    const tempPath = `${this.getCacheDir()}upload_${Date.now()}.json`;
    try {
      await FileSystem.writeAsStringAsync(tempPath, JSON.stringify(data, null, 2));
      await this.uploadFile(tempPath, remotePath);
    } finally {
      try {
        const info = await FileSystem.getInfoAsync(tempPath);
        if (info.exists) {
          await FileSystem.deleteAsync(tempPath, { idempotent: true });
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async downloadJson<T>(remotePath: string): Promise<T | null> {
    const tempPath = `${this.getCacheDir()}download_${Date.now()}.json`;
    try {
      await this.downloadFile(remotePath, tempPath);
      const content = await FileSystem.readAsStringAsync(tempPath);
      return JSON.parse(content) as T;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        return null;
      }
      throw error;
    } finally {
      try {
        const info = await FileSystem.getInfoAsync(tempPath);
        if (info.exists) {
          await FileSystem.deleteAsync(tempPath, { idempotent: true });
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  // ==================== Quota ====================

  abstract getQuota(): Promise<QuotaInfo | null>;

  // ==================== Utilities ====================

  /**
   * Ensure parent directory exists in cloud storage
   * Subclasses may override if provider requires explicit directory creation
   */
  protected async ensureRemoteDirectory(_remotePath: string): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Get MIME type for file
   */
  protected getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string> = {
      json: 'application/json',
      db: 'application/octet-stream',
      sqlite: 'application/octet-stream',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      txt: 'text/plain',
      log: 'text/plain',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Get parent path from full path
   */
  protected getParentPath(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }

  /**
   * Get file name from full path
   */
  protected getFileName(filePath: string): string {
    return filePath.split('/').pop() ?? '';
  }

  /**
   * Log message with provider prefix
   */
  protected log(level: 'info' | 'error' | 'warn', message: string, data?: unknown): void {
    const prefix = `[${this.displayName}]`;
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (data !== undefined) {
      logFn(prefix, message, data);
    } else {
      logFn(prefix, message);
    }
  }
}
