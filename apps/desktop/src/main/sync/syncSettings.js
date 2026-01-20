/**
 * Sync Settings Manager
 * Ensures only ONE sync provider is active at a time (S3 OR one cloud provider)
 */

const settings = require('../settings');
const { cloudProviderFactory } = require('./providerFactory');

/**
 * @typedef {'none' | 's3' | 'yandex' | 'googledrive' | 'dropbox'} SyncProviderType
 */

/**
 * @typedef {Object} SyncProviderInfo
 * @property {SyncProviderType} type
 * @property {string} name
 * @property {string} description
 * @property {boolean} isCloud - true for cloud providers, false for S3
 * @property {boolean} configured - true if provider has credentials/tokens
 * @property {boolean} active - true if this is the current active provider
 */

// Settings keys for provider tokens
const TOKEN_KEYS = {
  yandex: {
    accessToken: 'yandexAccessToken',
    refreshToken: 'yandexRefreshToken',
    expiresAt: 'yandexTokenExpiresAt'
  },
  googledrive: {
    accessToken: 'googleAccessToken',
    refreshToken: 'googleRefreshToken',
    expiresAt: 'googleTokenExpiresAt'
  },
  dropbox: {
    accessToken: 'dropboxAccessToken',
    refreshToken: 'dropboxRefreshToken',
    expiresAt: 'dropboxTokenExpiresAt'
  }
};

class SyncSettingsManager {
  /**
   * Get currently active sync provider type
   * @returns {SyncProviderType}
   */
  getActiveProvider() {
    const currentSettings = settings.getSettings();
    return currentSettings.syncProvider || 'none';
  }

  /**
   * Set active sync provider
   * Only one provider can be active at a time
   * @param {SyncProviderType} providerType
   */
  async setActiveProvider(providerType) {
    const currentProvider = this.getActiveProvider();

    // If switching to a different provider, disconnect current one
    if (currentProvider !== 'none' && currentProvider !== providerType) {
      await this.disconnectProvider(currentProvider);
    }

    settings.updateSettings({ syncProvider: providerType });
    console.log(`[SyncSettings] Active provider set to: ${providerType}`);
  }

  /**
   * Disconnect a provider (clear tokens/credentials)
   * @param {SyncProviderType} providerType
   */
  async disconnectProvider(providerType) {
    console.log(`[SyncSettings] Disconnecting provider: ${providerType}`);

    if (providerType === 's3') {
      // Clear S3 credentials
      settings.updateSettings({
        s3Endpoint: '',
        s3AccessKey: '',
        s3SecretKey: '',
        s3Bucket: '',
        s3Region: ''
      });
    } else if (TOKEN_KEYS[providerType]) {
      // Clear cloud provider tokens
      const keys = TOKEN_KEYS[providerType];
      const updates = {
        [keys.accessToken]: null,
        [keys.refreshToken]: null,
        [keys.expiresAt]: null
      };
      settings.updateSettings(updates);

      // Also logout from the provider instance
      try {
        cloudProviderFactory.clearProvider(providerType);
      } catch {
        // Provider might not be initialized
      }
    }

    // If this was the active provider, set to none
    if (this.getActiveProvider() === providerType) {
      settings.updateSettings({ syncProvider: 'none' });
    }
  }

  /**
   * Check if a provider is configured (has credentials/tokens)
   * @param {SyncProviderType} providerType
   * @returns {boolean}
   */
  isProviderConfigured(providerType) {
    const currentSettings = settings.getSettings();

    if (providerType === 's3') {
      return !!(
        currentSettings.s3Endpoint &&
        currentSettings.s3AccessKey &&
        currentSettings.s3SecretKey &&
        currentSettings.s3Bucket
      );
    }

    if (TOKEN_KEYS[providerType]) {
      const keys = TOKEN_KEYS[providerType];
      return !!currentSettings[keys.accessToken];
    }

    return false;
  }

  /**
   * Get list of all providers with their status
   * @returns {SyncProviderInfo[]}
   */
  getAllProviders() {
    const activeProvider = this.getActiveProvider();

    return [
      {
        type: 's3',
        name: 'S3 / S3-Compatible',
        description: 'MinIO, AWS S3, DigitalOcean Spaces, etc.',
        isCloud: false,
        configured: this.isProviderConfigured('s3'),
        active: activeProvider === 's3'
      },
      {
        type: 'yandex',
        name: 'Yandex Disk',
        description: '10 GB бесплатно',
        isCloud: true,
        configured: this.isProviderConfigured('yandex'),
        active: activeProvider === 'yandex'
      },
      {
        type: 'googledrive',
        name: 'Google Drive',
        description: '15 GB бесплатно',
        isCloud: true,
        configured: this.isProviderConfigured('googledrive'),
        active: activeProvider === 'googledrive'
      },
      {
        type: 'dropbox',
        name: 'Dropbox',
        description: '2 GB бесплатно',
        isCloud: true,
        configured: this.isProviderConfigured('dropbox'),
        active: activeProvider === 'dropbox'
      }
    ];
  }

  /**
   * Save cloud provider tokens to settings
   * @param {'yandex' | 'googledrive' | 'dropbox'} providerType
   * @param {string} accessToken
   * @param {string} [refreshToken]
   * @param {Date} [expiresAt]
   */
  saveProviderTokens(providerType, accessToken, refreshToken = null, expiresAt = null) {
    const keys = TOKEN_KEYS[providerType];
    if (!keys) {
      throw new Error(`Unknown provider type: ${providerType}`);
    }

    const updates = {
      [keys.accessToken]: accessToken
    };

    if (refreshToken) {
      updates[keys.refreshToken] = refreshToken;
    }
    if (expiresAt) {
      updates[keys.expiresAt] = expiresAt.toISOString();
    }

    settings.updateSettings(updates);
    console.log(`[SyncSettings] Saved tokens for: ${providerType}`);
  }

  /**
   * Get stored tokens for a cloud provider
   * @param {'yandex' | 'googledrive' | 'dropbox'} providerType
   * @returns {{accessToken: string|null, refreshToken: string|null, expiresAt: Date|null}}
   */
  getProviderTokens(providerType) {
    const keys = TOKEN_KEYS[providerType];
    if (!keys) {
      return { accessToken: null, refreshToken: null, expiresAt: null };
    }

    const currentSettings = settings.getSettings();

    return {
      accessToken: currentSettings[keys.accessToken] || null,
      refreshToken: currentSettings[keys.refreshToken] || null,
      expiresAt: currentSettings[keys.expiresAt]
        ? new Date(currentSettings[keys.expiresAt])
        : null
    };
  }

  /**
   * Load stored tokens into a provider instance
   * @param {'yandex' | 'googledrive' | 'dropbox'} providerType
   * @returns {boolean} true if tokens were loaded
   */
  loadProviderTokens(providerType) {
    const tokens = this.getProviderTokens(providerType);
    if (!tokens.accessToken) {
      return false;
    }

    try {
      const provider = cloudProviderFactory.getProvider(providerType);
      provider.setTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
      return true;
    } catch (error) {
      console.error(`[SyncSettings] Failed to load tokens for ${providerType}:`, error.message);
      return false;
    }
  }

  /**
   * Check if sync is enabled (any provider is active)
   * @returns {boolean}
   */
  isSyncEnabled() {
    return this.getActiveProvider() !== 'none';
  }

  /**
   * Check if the active provider is a cloud provider
   * @returns {boolean}
   */
  isCloudSync() {
    const active = this.getActiveProvider();
    return active !== 'none' && active !== 's3';
  }

  /**
   * Check if the active provider is S3
   * @returns {boolean}
   */
  isS3Sync() {
    return this.getActiveProvider() === 's3';
  }
}

// Export singleton
const syncSettings = new SyncSettingsManager();

module.exports = {
  SyncSettingsManager,
  syncSettings,
  TOKEN_KEYS
};
