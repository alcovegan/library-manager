/**
 * Cloud Provider Factory for React Native
 * Creates and manages cloud storage provider instances
 */

import { BaseCloudProvider, CloudProviderType } from './providers/base';
import { YandexDiskProvider, YandexConfig } from './providers/yandex';
import { GoogleDriveProvider, GoogleDriveConfig } from './providers/googledrive';
import { DropboxProvider, DropboxConfig } from './providers/dropbox';

export interface ProviderConfig {
  yandex?: YandexConfig;
  googledrive?: { clientId: string };
  dropbox?: { appKey: string };
}

export interface ProviderInfo {
  type: CloudProviderType;
  name: string;
  description: string;
  available: boolean;
}

/**
 * Cloud Provider Factory
 * Manages creation and caching of provider instances
 */
class CloudProviderFactory {
  private providers: Map<CloudProviderType, BaseCloudProvider> = new Map();
  private config: ProviderConfig = {};

  /**
   * Set configuration for providers
   */
  setConfig(config: ProviderConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get list of available provider types
   */
  getAvailableProviders(): ProviderInfo[] {
    return [
      {
        type: 'yandex',
        name: 'Yandex Disk',
        description: '10 GB free',
        available: !!this.config.yandex?.clientId,
      },
      {
        type: 'googledrive',
        name: 'Google Drive',
        description: '15 GB free',
        available: !!this.config.googledrive?.clientId,
      },
      {
        type: 'dropbox',
        name: 'Dropbox',
        description: '2 GB free',
        available: !!this.config.dropbox?.appKey,
      },
    ];
  }

  /**
   * Get or create a provider instance
   */
  getProvider(type: CloudProviderType): BaseCloudProvider {
    // Return cached instance if exists
    const cached = this.providers.get(type);
    if (cached) {
      return cached;
    }

    // Create new instance
    const provider = this.createProvider(type);
    this.providers.set(type, provider);
    return provider;
  }

  /**
   * Create a new provider instance
   */
  private createProvider(type: CloudProviderType): BaseCloudProvider {
    switch (type) {
      case 'yandex':
        if (!this.config.yandex?.clientId) {
          throw new Error('Yandex Client ID not configured');
        }
        return new YandexDiskProvider(this.config.yandex);

      case 'googledrive':
        if (!this.config.googledrive?.clientId) {
          throw new Error('Google Client ID not configured');
        }
        return new GoogleDriveProvider(this.config.googledrive);

      case 'dropbox':
        if (!this.config.dropbox?.appKey) {
          throw new Error('Dropbox App Key not configured');
        }
        return new DropboxProvider(this.config.dropbox);

      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  /**
   * Clear cached provider instance
   */
  clearProvider(type: CloudProviderType): void {
    const provider = this.providers.get(type);
    if (provider) {
      provider.logout();
      this.providers.delete(type);
    }
  }

  /**
   * Clear all cached providers
   */
  clearAll(): void {
    for (const provider of this.providers.values()) {
      provider.logout();
    }
    this.providers.clear();
  }

  /**
   * Get provider if authenticated, null otherwise
   */
  async getAuthenticatedProvider(type: CloudProviderType): Promise<BaseCloudProvider | null> {
    const provider = this.getProvider(type);

    // Try to load stored tokens based on provider type
    if (type === 'yandex' && provider instanceof YandexDiskProvider) {
      const loaded = await provider.loadStoredTokens();
      if (loaded && provider.isAuthenticated()) {
        return provider;
      }
    } else if (type === 'googledrive' && provider instanceof GoogleDriveProvider) {
      const loaded = await provider.loadStoredTokens();
      if (loaded && provider.isAuthenticated()) {
        return provider;
      }
    } else if (type === 'dropbox' && provider instanceof DropboxProvider) {
      const loaded = await provider.loadStoredTokens();
      if (loaded && provider.isAuthenticated()) {
        return provider;
      }
    }

    if (provider.isAuthenticated()) {
      return provider;
    }

    return null;
  }
}

// Export singleton instance
export const cloudProviderFactory = new CloudProviderFactory();

// Convenience exports
export const getProvider = (type: CloudProviderType) => cloudProviderFactory.getProvider(type);
export const getAvailableProviders = () => cloudProviderFactory.getAvailableProviders();
export const setProviderConfig = (config: ProviderConfig) => cloudProviderFactory.setConfig(config);
export const getAuthenticatedProvider = (type: CloudProviderType) =>
  cloudProviderFactory.getAuthenticatedProvider(type);
