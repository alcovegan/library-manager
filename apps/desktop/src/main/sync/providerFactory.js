/**
 * Cloud Provider Factory
 * Creates and manages cloud storage provider instances
 */

const BaseCloudProvider = require('./providers/base');
const YandexDiskProvider = require('./providers/yandex');
const GoogleDriveProvider = require('./providers/googledrive');
const DropboxProvider = require('./providers/dropbox');

/**
 * @typedef {'yandex' | 'googledrive' | 'dropbox'} CloudProviderType
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {string} [yandexClientId]
 * @property {string} [googleClientId]
 * @property {string} [dropboxAppKey]
 */

/**
 * Cloud Provider Factory
 * Manages creation and caching of provider instances
 */
// OAuth Client IDs - these are PUBLIC identifiers, safe to embed in distributed apps
// See: https://oauth.net/2/client-types/ (Public vs Confidential clients)
const OAUTH_CLIENT_IDS = {
  yandex: '57f8ac290a6c407caa2e4081759fd965',
  google: '938368603688-ct0e25tpminhmf0htrfa66rnb6dun6mp.apps.googleusercontent.com',
  dropbox: 'c8r1xsf87nzv128'
};

class CloudProviderFactory {
  constructor() {
    /** @type {Map<CloudProviderType, BaseCloudProvider>} */
    this.providers = new Map();

    /** @type {ProviderConfig} */
    this.config = {
      yandexClientId: process.env.YANDEX_CLIENT_ID || OAUTH_CLIENT_IDS.yandex,
      yandexClientSecret: process.env.YANDEX_CLIENT_SECRET || null,
      googleClientId: process.env.GOOGLE_CLIENT_ID || OAUTH_CLIENT_IDS.google,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
      dropboxAppKey: process.env.DROPBOX_APP_KEY || OAUTH_CLIENT_IDS.dropbox,
      dropboxAppSecret: process.env.DROPBOX_APP_SECRET || null
    };
  }

  /**
   * Set configuration for providers
   * @param {ProviderConfig} config
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get list of available provider types
   * @returns {Array<{type: CloudProviderType, name: string, available: boolean}>}
   */
  getAvailableProviders() {
    return [
      {
        type: 'yandex',
        name: 'Yandex Disk',
        description: '10 GB free',
        available: !!this.config.yandexClientId
      },
      {
        type: 'googledrive',
        name: 'Google Drive',
        description: '15 GB free',
        available: !!this.config.googleClientId
      },
      {
        type: 'dropbox',
        name: 'Dropbox',
        description: '2 GB free',
        available: !!this.config.dropboxAppKey
      }
    ];
  }

  /**
   * Get or create a provider instance
   * @param {CloudProviderType} type
   * @returns {BaseCloudProvider}
   */
  getProvider(type) {
    // Return cached instance if exists
    if (this.providers.has(type)) {
      return this.providers.get(type);
    }

    // Create new instance
    const provider = this.createProvider(type);
    this.providers.set(type, provider);
    return provider;
  }

  /**
   * Create a new provider instance
   * @param {CloudProviderType} type
   * @returns {BaseCloudProvider}
   */
  createProvider(type) {
    switch (type) {
      case 'yandex':
        if (!this.config.yandexClientId) {
          throw new Error('Yandex Client ID not configured');
        }
        return new YandexDiskProvider(this.config.yandexClientId, this.config.yandexClientSecret);

      case 'googledrive':
        if (!this.config.googleClientId) {
          throw new Error('Google Client ID not configured');
        }
        return new GoogleDriveProvider(this.config.googleClientId, this.config.googleClientSecret);

      case 'dropbox':
        if (!this.config.dropboxAppKey) {
          throw new Error('Dropbox App Key not configured');
        }
        return new DropboxProvider(this.config.dropboxAppKey);

      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  /**
   * Clear cached provider instance
   * @param {CloudProviderType} type
   */
  clearProvider(type) {
    const provider = this.providers.get(type);
    if (provider) {
      provider.logout();
      this.providers.delete(type);
    }
  }

  /**
   * Clear all cached providers
   */
  clearAll() {
    for (const provider of this.providers.values()) {
      provider.logout();
    }
    this.providers.clear();
  }
}

// Export singleton instance
const factory = new CloudProviderFactory();

module.exports = {
  CloudProviderFactory,
  cloudProviderFactory: factory,
  getProvider: (type) => factory.getProvider(type),
  getAvailableProviders: () => factory.getAvailableProviders(),
  setProviderConfig: (config) => factory.setConfig(config)
};
