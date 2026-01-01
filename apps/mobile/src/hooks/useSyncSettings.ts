/**
 * Hook for managing sync settings and provider connections
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import {
  syncSettings,
  SyncProviderType,
  SyncProviderInfo,
  cloudProviderFactory,
  setProviderConfig,
  cloudSyncManager,
} from '../services/sync';
import type { CloudProviderType } from '../services/sync/providers/base';

// Provider client IDs from app.json extra
const extra = Constants.expoConfig?.extra ?? {};
const PROVIDER_CONFIG = {
  yandex: {
    clientId: extra.yandexClientId || '',
  },
  googledrive: {
    clientId: extra.googleClientId || '',
  },
  dropbox: {
    appKey: extra.dropboxAppKey || '',
  },
};

export interface UseSyncSettingsResult {
  // State
  providers: SyncProviderInfo[];
  activeProvider: SyncProviderType;
  isLoading: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  userInfo: { name: string; email?: string } | null;

  // Actions
  refresh: () => Promise<void>;
  connectProvider: (type: SyncProviderType) => Promise<boolean>;
  disconnectProvider: (type: SyncProviderType) => Promise<void>;
  syncUp: () => Promise<boolean>;
  syncDown: () => Promise<boolean>;
}

export function useSyncSettings(): UseSyncSettingsResult {
  const [providers, setProviders] = useState<SyncProviderInfo[]>([]);
  const [activeProvider, setActiveProvider] = useState<SyncProviderType>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ name: string; email?: string } | null>(null);

  // Initialize provider config
  useEffect(() => {
    setProviderConfig({
      yandex: PROVIDER_CONFIG.yandex,
      googledrive: PROVIDER_CONFIG.googledrive,
      dropbox: PROVIDER_CONFIG.dropbox,
    });
  }, []);

  // Load providers and status
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [providerList, active] = await Promise.all([
        syncSettings.getAllProviders(),
        syncSettings.getActiveProvider(),
      ]);

      setProviders(providerList);
      setActiveProvider(active);

      // Get user info if a cloud provider is active
      if (active !== 'none' && active !== 's3') {
        const loaded = await syncSettings.loadProviderTokens(active as CloudProviderType);
        if (loaded) {
          const provider = cloudProviderFactory.getProvider(active as CloudProviderType);
          const connection = await provider.testConnection();
          if (connection.success && connection.userInfo) {
            setUserInfo(connection.userInfo);
          }
        }
      } else {
        setUserInfo(null);
      }
    } catch (error) {
      console.error('[useSyncSettings] Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Connect to a provider
  const connectProvider = useCallback(async (type: SyncProviderType): Promise<boolean> => {
    if (type === 'none') return false;

    setIsConnecting(true);
    try {
      if (type === 's3') {
        // S3 requires manual configuration, just set as active
        await syncSettings.setActiveProvider('s3');
        await refresh();
        return true;
      }

      // Cloud provider - initiate OAuth
      const cloudType = type as CloudProviderType;

      // Check if already configured
      const isConfigured = await syncSettings.isProviderConfigured(type);
      if (isConfigured) {
        // Just activate it
        await syncSettings.setActiveProvider(type);
        await refresh();
        return true;
      }

      // Start OAuth flow
      const provider = cloudProviderFactory.getProvider(cloudType);
      const result = await provider.authorizeWithBrowser();

      if (result.success) {
        // Save tokens
        await syncSettings.saveProviderTokens(
          cloudType,
          result.accessToken!,
          result.refreshToken,
          result.expiresAt
        );

        // Set as active provider
        await syncSettings.setActiveProvider(type);
        await refresh();

        Alert.alert('Успешно', `Подключено к ${provider.displayName}`);
        return true;
      } else {
        Alert.alert('Ошибка', result.error || 'Не удалось подключиться');
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Ошибка', message);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [refresh]);

  // Disconnect a provider
  const disconnectProvider = useCallback(async (type: SyncProviderType): Promise<void> => {
    try {
      await syncSettings.disconnectProvider(type);
      setUserInfo(null);
      await refresh();
      Alert.alert('Отключено', 'Провайдер синхронизации отключен');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Ошибка', message);
    }
  }, [refresh]);

  // Sync up (upload)
  const syncUp = useCallback(async (): Promise<boolean> => {
    if (activeProvider === 'none') {
      Alert.alert('Ошибка', 'Сначала подключите провайдер синхронизации');
      return false;
    }

    setIsSyncing(true);
    try {
      if (activeProvider === 's3') {
        // Use existing S3 sync
        Alert.alert('Информация', 'Используйте S3 синхронизацию в настройках');
        return false;
      }

      // Initialize cloud sync manager
      await cloudSyncManager.initialize(activeProvider as CloudProviderType);

      const result = await cloudSyncManager.syncUp();

      if (result.success) {
        setLastSync(new Date().toISOString());
        Alert.alert('Успешно', 'Данные загружены в облако');
        return true;
      } else if (result.blocked) {
        Alert.alert('Заблокировано', result.reason || 'Несовместимая версия данных');
        return false;
      } else {
        Alert.alert('Ошибка', result.error || 'Не удалось загрузить данные');
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Ошибка', message);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [activeProvider]);

  // Sync down (download)
  const syncDown = useCallback(async (): Promise<boolean> => {
    if (activeProvider === 'none') {
      Alert.alert('Ошибка', 'Сначала подключите провайдер синхронизации');
      return false;
    }

    setIsSyncing(true);
    try {
      if (activeProvider === 's3') {
        // Use existing S3 sync
        Alert.alert('Информация', 'Используйте S3 синхронизацию в настройках');
        return false;
      }

      // Initialize cloud sync manager
      await cloudSyncManager.initialize(activeProvider as CloudProviderType);

      const result = await cloudSyncManager.syncDown();

      if (result.success) {
        setLastSync(new Date().toISOString());
        Alert.alert('Успешно', 'Данные загружены из облака');
        return true;
      } else if (result.blocked) {
        Alert.alert('Заблокировано', result.reason || 'Несовместимая версия данных');
        return false;
      } else {
        Alert.alert('Ошибка', result.error || 'Не удалось загрузить данные');
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Ошибка', message);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [activeProvider]);

  return {
    providers,
    activeProvider,
    isLoading,
    isConnecting,
    isSyncing,
    lastSync,
    userInfo,
    refresh,
    connectProvider,
    disconnectProvider,
    syncUp,
    syncDown,
  };
}
