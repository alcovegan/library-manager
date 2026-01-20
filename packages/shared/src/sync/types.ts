/**
 * Cloud Storage Provider Types
 * Shared type definitions for cloud sync providers (Yandex Disk, Google Drive, Dropbox)
 */

export type CloudProviderType = 'yandex' | 'googledrive' | 'dropbox';

/**
 * Main interface for cloud storage providers
 */
export interface CloudStorageProvider {
  readonly type: CloudProviderType;
  readonly displayName: string;

  // Auth
  isAuthenticated(): boolean;
  getAuthUrl(): string;
  authenticate(code: string): Promise<AuthResult>;
  refreshToken(): Promise<void>;
  logout(): void;

  // Connection
  testConnection(): Promise<ConnectionResult>;

  // File operations
  uploadFile(localPath: string, remotePath: string): Promise<void>;
  downloadFile(remotePath: string, localPath: string): Promise<void>;
  deleteFile(remotePath: string): Promise<void>;
  listFiles(remotePath: string): Promise<RemoteFile[]>;
  fileExists(remotePath: string): Promise<boolean>;

  // JSON helpers for sync metadata
  uploadJson(remotePath: string, data: unknown): Promise<void>;
  downloadJson<T>(remotePath: string): Promise<T | null>;

  // Quota info
  getQuota(): Promise<QuotaInfo | null>;
}

/**
 * OAuth authentication result
 */
export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * Remote file metadata
 */
export interface RemoteFile {
  path: string;
  name: string;
  size: number;
  lastModified: Date;
  isDirectory: boolean;
  md5?: string;
}

/**
 * Connection test result
 */
export interface ConnectionResult {
  success: boolean;
  error?: string;
  userInfo?: {
    name: string;
    email?: string;
  };
}

/**
 * Storage quota information
 */
export interface QuotaInfo {
  used: number;
  total: number;
  available: number;
}

/**
 * Provider-specific configurations
 */
export interface YandexConfig {
  clientId: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface DropboxConfig {
  appKey: string;
  appSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

export type CloudProviderConfig = YandexConfig | GoogleDriveConfig | DropboxConfig;

/**
 * Sync operation types
 */
export type SyncDirection = 'upload' | 'download';

export interface SyncProgress {
  phase: 'preparing' | 'uploading' | 'downloading' | 'finalizing';
  current: number;
  total: number;
  currentFile?: string;
}

export interface SyncResult {
  success: boolean;
  filesUploaded: number;
  filesDownloaded: number;
  errors: string[];
  timestamp: Date;
}
