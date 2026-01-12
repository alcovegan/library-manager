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
import type { RemoteSyncInfo } from '../services/sync/cloudSyncManager';
import { getPendingLocalChanges, type PendingChanges } from '../services/database';

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
  remoteSyncInfo: RemoteSyncInfo | null;
  currentDeviceId: string | null;
  pendingChanges: PendingChanges | null;

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
  const [remoteSyncInfo, setRemoteSyncInfo] = useState<RemoteSyncInfo | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChanges | null>(null);

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

      // Get user info and remote sync info if a cloud provider is active
      if (active !== 'none' && active !== 's3') {
        const loaded = await syncSettings.loadProviderTokens(active as CloudProviderType);
        if (loaded) {
          const provider = cloudProviderFactory.getProvider(active as CloudProviderType);
          const connection = await provider.testConnection();
          if (connection.success && connection.userInfo) {
            setUserInfo(connection.userInfo);
          }

          // Initialize cloud sync manager and get remote sync info
          try {
            console.log('[useSyncSettings] Initializing cloudSyncManager for', active);
            await cloudSyncManager.initialize(active as CloudProviderType);
            const deviceId = cloudSyncManager.getDeviceId();
            console.log('[useSyncSettings] Current device ID:', deviceId);
            setCurrentDeviceId(deviceId);

            // Get last sync timestamp from persistent storage
            const savedLastSync = await cloudSyncManager.getLastSyncTimestamp();
            if (savedLastSync) {
              setLastSync(savedLastSync);
            }

            // Get pending local changes
            try {
              const pending = await getPendingLocalChanges(savedLastSync);
              console.log('[useSyncSettings] Pending changes:', JSON.stringify(pending));
              setPendingChanges(pending);
            } catch (e) {
              console.error('[useSyncSettings] Failed to get pending changes:', e);
              setPendingChanges(null);
            }

            console.log('[useSyncSettings] Fetching remote sync info...');
            const remoteInfo = await cloudSyncManager.getRemoteSyncInfo();
            console.log('[useSyncSettings] Remote sync info result:', JSON.stringify(remoteInfo));

            if (remoteInfo.ok && remoteInfo.info) {
              console.log('[useSyncSettings] Setting remote sync info:', remoteInfo.info.deviceId, remoteInfo.info.deviceName);
              setRemoteSyncInfo(remoteInfo.info);
            } else {
              console.log('[useSyncSettings] No remote sync info available, ok:', remoteInfo.ok, 'error:', remoteInfo.error);
              setRemoteSyncInfo(null);
            }
          } catch (e) {
            console.error('[useSyncSettings] Failed to get remote sync info:', e);
            setRemoteSyncInfo(null);
          }
        }
      } else {
        setUserInfo(null);
        setRemoteSyncInfo(null);
        setCurrentDeviceId(null);
        setPendingChanges(null);
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

    // Check if data is from another device - inform about merge
    if (remoteSyncInfo && currentDeviceId && remoteSyncInfo.deviceId !== currentDeviceId) {
      return new Promise((resolve) => {
        Alert.alert(
          'Синхронизация',
          `В облаке есть данные с устройства "${remoteSyncInfo.deviceName}".\n\n` +
          `Ваши изменения будут объединены с облачными данными по принципу "последнее изменение побеждает".\n\n` +
          `Продолжить?`,
          [
            {
              text: 'Отмена',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Синхронизировать',
              style: 'default',
              onPress: () => {
                performSyncUp().then(resolve);
              },
            },
          ]
        );
      });
    }

    return performSyncUp();
  }, [activeProvider, remoteSyncInfo, currentDeviceId]);

  // Actual sync up logic
  const performSyncUp = useCallback(async (): Promise<boolean> => {
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
        await refresh(); // Update remote sync info
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
  }, [activeProvider, refresh]);

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
        await refresh(); // Update remote sync info
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
  }, [activeProvider, refresh]);

  return {
    providers,
    activeProvider,
    isLoading,
    isConnecting,
    isSyncing,
    lastSync,
    userInfo,
    remoteSyncInfo,
    currentDeviceId,
    pendingChanges,
    refresh,
    connectProvider,
    disconnectProvider,
    syncUp,
    syncDown,
  };
}
