/**
 * Sync Settings Manager for React Native
 * Ensures only ONE sync provider is active at a time (S3 OR one cloud provider)
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cloudProviderFactory } from './providerFactory';
import type { CloudProviderType } from './providers/base';

export type SyncProviderType = 'none' | 's3' | CloudProviderType;

export interface SyncProviderInfo {
  type: SyncProviderType;
  name: string;
  description: string;
  isCloud: boolean;
  configured: boolean;
  active: boolean;
}

// Storage keys
const ACTIVE_PROVIDER_KEY = 'sync_active_provider';
const S3_CONFIG_KEY = 'sync_s3_config';

// Token keys in SecureStore
const TOKEN_KEYS: Record<CloudProviderType, { accessToken: string; refreshToken: string; expiresAt: string }> = {
  yandex: {
    accessToken: 'yandex_access_token',
    refreshToken: 'yandex_refresh_token',
    expiresAt: 'yandex_token_expires',
  },
  googledrive: {
    accessToken: 'google_access_token',
    refreshToken: 'google_refresh_token',
    expiresAt: 'google_token_expires',
  },
  dropbox: {
    accessToken: 'dropbox_access_token',
    refreshToken: 'dropbox_refresh_token',
    expiresAt: 'dropbox_token_expires',
  },
};

class SyncSettingsManager {
  private cachedActiveProvider: SyncProviderType | null = null;

  /**
   * Get currently active sync provider type
   */
  async getActiveProvider(): Promise<SyncProviderType> {
    if (this.cachedActiveProvider !== null) {
      return this.cachedActiveProvider;
    }

    try {
      const value = await AsyncStorage.getItem(ACTIVE_PROVIDER_KEY);
      this.cachedActiveProvider = (value as SyncProviderType) || 'none';
      return this.cachedActiveProvider;
    } catch {
      return 'none';
    }
  }

  /**
   * Set active sync provider
   * Only one provider can be active at a time
   */
  async setActiveProvider(providerType: SyncProviderType): Promise<void> {
    const currentProvider = await this.getActiveProvider();

    // If switching to a different provider, disconnect current one
    if (currentProvider !== 'none' && currentProvider !== providerType) {
      await this.disconnectProvider(currentProvider);
    }

    await AsyncStorage.setItem(ACTIVE_PROVIDER_KEY, providerType);
    this.cachedActiveProvider = providerType;
    console.log(`[SyncSettings] Active provider set to: ${providerType}`);
  }

  /**
   * Disconnect a provider (clear tokens/credentials)
   */
  async disconnectProvider(providerType: SyncProviderType): Promise<void> {
    console.log(`[SyncSettings] Disconnecting provider: ${providerType}`);

    if (providerType === 's3') {
      // Clear S3 config
      await AsyncStorage.removeItem(S3_CONFIG_KEY);
    } else if (providerType !== 'none' && TOKEN_KEYS[providerType as CloudProviderType]) {
      // Clear cloud provider tokens
      const keys = TOKEN_KEYS[providerType as CloudProviderType];
      await Promise.all([
        SecureStore.deleteItemAsync(keys.accessToken),
        SecureStore.deleteItemAsync(keys.refreshToken),
        SecureStore.deleteItemAsync(keys.expiresAt),
      ]);

      // Also logout from the provider instance
      try {
        cloudProviderFactory.clearProvider(providerType as CloudProviderType);
      } catch {
        // Provider might not be initialized
      }
    }

    // If this was the active provider, set to none
    const currentActive = await this.getActiveProvider();
    if (currentActive === providerType) {
      await AsyncStorage.setItem(ACTIVE_PROVIDER_KEY, 'none');
      this.cachedActiveProvider = 'none';
    }
  }

  /**
   * Check if a provider is configured (has credentials/tokens)
   */
  async isProviderConfigured(providerType: SyncProviderType): Promise<boolean> {
    if (providerType === 'none') {
      return false;
    }

    if (providerType === 's3') {
      try {
        const config = await AsyncStorage.getItem(S3_CONFIG_KEY);
        if (!config) return false;
        const parsed = JSON.parse(config);
        return !!(parsed.endpoint && parsed.accessKey && parsed.secretKey && parsed.bucket);
      } catch {
        return false;
      }
    }

    if (TOKEN_KEYS[providerType as CloudProviderType]) {
      const keys = TOKEN_KEYS[providerType as CloudProviderType];
      const accessToken = await SecureStore.getItemAsync(keys.accessToken);
      return !!accessToken;
    }

    return false;
  }

  /**
   * Get list of all providers with their status
   */
  async getAllProviders(): Promise<SyncProviderInfo[]> {
    const activeProvider = await this.getActiveProvider();

    const providers: SyncProviderInfo[] = [
      {
        type: 's3',
        name: 'S3 / S3-Compatible',
        description: 'MinIO, AWS S3, DigitalOcean Spaces, etc.',
        isCloud: false,
        configured: await this.isProviderConfigured('s3'),
        active: activeProvider === 's3',
      },
      {
        type: 'yandex',
        name: 'Yandex Disk',
        description: '10 GB free',
        isCloud: true,
        configured: await this.isProviderConfigured('yandex'),
        active: activeProvider === 'yandex',
      },
      {
        type: 'googledrive',
        name: 'Google Drive',
        description: '15 GB free',
        isCloud: true,
        configured: await this.isProviderConfigured('googledrive'),
        active: activeProvider === 'googledrive',
      },
      {
        type: 'dropbox',
        name: 'Dropbox',
        description: '2 GB free',
        isCloud: true,
        configured: await this.isProviderConfigured('dropbox'),
        active: activeProvider === 'dropbox',
      },
    ];

    return providers;
  }

  /**
   * Save cloud provider tokens
   */
  async saveProviderTokens(
    providerType: CloudProviderType,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<void> {
    const keys = TOKEN_KEYS[providerType];
    if (!keys) {
      throw new Error(`Unknown provider type: ${providerType}`);
    }

    await SecureStore.setItemAsync(keys.accessToken, accessToken);

    if (refreshToken) {
      await SecureStore.setItemAsync(keys.refreshToken, refreshToken);
    }
    if (expiresAt) {
      await SecureStore.setItemAsync(keys.expiresAt, expiresAt.toISOString());
    }

    console.log(`[SyncSettings] Saved tokens for: ${providerType}`);
  }

  /**
   * Get stored tokens for a cloud provider
   */
  async getProviderTokens(
    providerType: CloudProviderType
  ): Promise<{ accessToken: string | null; refreshToken: string | null; expiresAt: Date | null }> {
    const keys = TOKEN_KEYS[providerType];
    if (!keys) {
      return { accessToken: null, refreshToken: null, expiresAt: null };
    }

    const [accessToken, refreshToken, expiresAtStr] = await Promise.all([
      SecureStore.getItemAsync(keys.accessToken),
      SecureStore.getItemAsync(keys.refreshToken),
      SecureStore.getItemAsync(keys.expiresAt),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAtStr ? new Date(expiresAtStr) : null,
    };
  }

  /**
   * Load stored tokens into a provider instance
   */
  async loadProviderTokens(providerType: CloudProviderType): Promise<boolean> {
    const tokens = await this.getProviderTokens(providerType);
    if (!tokens.accessToken) {
      return false;
    }

    try {
      const provider = cloudProviderFactory.getProvider(providerType);
      provider.setTokens(
        tokens.accessToken,
        tokens.refreshToken ?? undefined,
        tokens.expiresAt ?? undefined
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SyncSettings] Failed to load tokens for ${providerType}:`, message);
      return false;
    }
  }

  /**
   * Save S3 configuration
   */
  async saveS3Config(config: {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region?: string;
  }): Promise<void> {
    await AsyncStorage.setItem(S3_CONFIG_KEY, JSON.stringify(config));
    console.log('[SyncSettings] Saved S3 config');
  }

  /**
   * Get S3 configuration
   */
  async getS3Config(): Promise<{
    endpoint: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
  } | null> {
    try {
      const config = await AsyncStorage.getItem(S3_CONFIG_KEY);
      return config ? JSON.parse(config) : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if sync is enabled (any provider is active)
   */
  async isSyncEnabled(): Promise<boolean> {
    const active = await this.getActiveProvider();
    return active !== 'none';
  }

  /**
   * Check if the active provider is a cloud provider
   */
  async isCloudSync(): Promise<boolean> {
    const active = await this.getActiveProvider();
    return active !== 'none' && active !== 's3';
  }

  /**
   * Check if the active provider is S3
   */
  async isS3Sync(): Promise<boolean> {
    const active = await this.getActiveProvider();
    return active === 's3';
  }

  /**
   * Clear cache (useful after settings change)
   */
  clearCache(): void {
    this.cachedActiveProvider = null;
  }
}

// Export singleton
export const syncSettings = new SyncSettingsManager();
