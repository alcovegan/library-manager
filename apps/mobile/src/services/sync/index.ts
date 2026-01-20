/**
 * Cloud Sync module exports for React Native
 */

// Base types and provider
export {
  CloudProviderType,
  CloudStorageProvider,
  AuthResult,
  ConnectionResult,
  RemoteFile,
  QuotaInfo,
  BaseCloudProvider,
} from './providers/base';

// Cloud providers
export { YandexDiskProvider, YandexConfig } from './providers/yandex';
export { GoogleDriveProvider, GoogleDriveConfig } from './providers/googledrive';
export { DropboxProvider, DropboxConfig } from './providers/dropbox';

// Provider factory
export {
  cloudProviderFactory,
  getProvider,
  getAvailableProviders,
  setProviderConfig,
  getAuthenticatedProvider,
  ProviderConfig,
  ProviderInfo,
} from './providerFactory';

// Cloud Sync Manager
export {
  cloudSyncManager,
  SYNC_PATHS,
  SyncContext,
  DeviceMetadata,
  SyncResult,
  FullSyncResult,
  SyncStatus,
} from './cloudSyncManager';

// Sync Settings (ensures only one provider active at a time)
export { syncSettings, SyncProviderType, SyncProviderInfo } from './syncSettings';
