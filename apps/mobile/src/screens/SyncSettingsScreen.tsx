/**
 * Sync Settings Screen - Provider selection and sync management
 * Ensures only ONE sync provider is active at a time
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSyncSettings } from '../hooks/useSyncSettings';
import type { SyncProviderType, SyncProviderInfo } from '../services/sync';

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function ProviderCard({
  provider,
  isConnecting,
  onConnect,
  onDisconnect,
}: {
  provider: SyncProviderInfo;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const getProviderIcon = (type: SyncProviderType): string => {
    switch (type) {
      case 'yandex':
        return '☁️';
      case 'googledrive':
        return '📁';
      case 'dropbox':
        return '📦';
      case 's3':
        return '🗄️';
      default:
        return '❌';
    }
  };

  return (
    <View style={[styles.providerCard, provider.active && styles.providerCardActive]}>
      <View style={styles.providerInfo}>
        <Text style={styles.providerIcon}>{getProviderIcon(provider.type)}</Text>
        <View style={styles.providerText}>
          <Text style={styles.providerName}>{provider.name}</Text>
          <Text style={styles.providerDescription}>{provider.description}</Text>
          {provider.active && (
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>Активный</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.providerActions}>
        {provider.active ? (
          <TouchableOpacity
            style={[styles.providerButton, styles.disconnectButton]}
            onPress={onDisconnect}
          >
            <Text style={styles.disconnectButtonText}>Отключить</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.providerButton, styles.connectButton, isConnecting && styles.disabledButton]}
            onPress={onConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color="#007AFF" size="small" />
            ) : (
              <Text style={styles.connectButtonText}>
                {provider.configured ? 'Подключить' : 'Настроить'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function SyncSettingsScreen() {
  const {
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
  } = useSyncSettings();

  const formatLastSync = (timestamp: string | null): string => {
    if (!timestamp) return 'Никогда';
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  const cloudProviders = providers.filter((p) => p.isCloud);
  const otherProviders = providers.filter((p) => !p.isCloud);
  const hasActiveProvider = activeProvider !== 'none';

  return (
    <ScrollView style={styles.container}>
      {/* Status Section */}
      <SettingsSection title="Статус синхронизации">
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Провайдер:</Text>
            <Text style={styles.statusValue}>
              {hasActiveProvider
                ? providers.find((p) => p.type === activeProvider)?.name || activeProvider
                : 'Не выбран'}
            </Text>
          </View>

          {userInfo && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Аккаунт:</Text>
              <Text style={styles.statusValue}>
                {userInfo.name}
                {userInfo.email && ` (${userInfo.email})`}
              </Text>
            </View>
          )}

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Последняя синхронизация:</Text>
            <Text style={styles.statusValue}>{formatLastSync(lastSync)}</Text>
          </View>
        </View>
      </SettingsSection>

      {/* Sync Actions */}
      {hasActiveProvider && activeProvider !== 's3' && (
        <View style={styles.syncActions}>
          <TouchableOpacity
            style={[styles.syncButton, styles.syncUpButton, isSyncing && styles.disabledButton]}
            onPress={syncUp}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Text style={styles.syncButtonIcon}>⬆️</Text>
                <Text style={styles.syncButtonText}>Загрузить в облако</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.syncButton, styles.syncDownButton, isSyncing && styles.disabledButton]}
            onPress={syncDown}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Text style={styles.syncButtonIcon}>⬇️</Text>
                <Text style={styles.syncButtonText}>Загрузить из облака</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Cloud Providers */}
      <SettingsSection title="Облачные провайдеры">
        <View style={styles.providerList}>
          {cloudProviders.map((provider) => (
            <ProviderCard
              key={provider.type}
              provider={provider}
              isConnecting={isConnecting}
              onConnect={() => connectProvider(provider.type)}
              onDisconnect={() => disconnectProvider(provider.type)}
            />
          ))}
        </View>
      </SettingsSection>

      {/* S3 Provider */}
      <SettingsSection title="S3-совместимые хранилища">
        <View style={styles.providerList}>
          {otherProviders.map((provider) => (
            <ProviderCard
              key={provider.type}
              provider={provider}
              isConnecting={isConnecting}
              onConnect={() => connectProvider(provider.type)}
              onDisconnect={() => disconnectProvider(provider.type)}
            />
          ))}
        </View>
        <Text style={styles.s3Note}>
          Для настройки S3 используйте раздел "Настройки S3" на главном экране настроек
        </Text>
      </SettingsSection>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Важно</Text>
        <Text style={styles.infoText}>
          Только один провайдер синхронизации может быть активен одновременно.
          При переключении на другой провайдер текущий будет автоматически отключен.
        </Text>
      </View>

      {/* Refresh */}
      <TouchableOpacity style={styles.refreshButton} onPress={refresh}>
        <Text style={styles.refreshButtonText}>Обновить статус</Text>
      </TouchableOpacity>

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e5e5',
  },
  statusContainer: {
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    color: '#1c1c1e',
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  syncActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  syncButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  syncUpButton: {
    backgroundColor: '#34C759',
  },
  syncDownButton: {
    backgroundColor: '#007AFF',
  },
  syncButtonIcon: {
    fontSize: 16,
  },
  syncButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  providerList: {
    padding: 12,
    gap: 12,
  },
  providerCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  providerCardActive: {
    backgroundColor: '#e8f4ff',
    borderColor: '#007AFF',
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  providerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  providerText: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 2,
  },
  providerDescription: {
    fontSize: 13,
    color: '#666',
  },
  activeTag: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  activeTagText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  providerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  providerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#e5e5e5',
  },
  disconnectButton: {
    backgroundColor: '#ff3b30',
  },
  connectButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  s3Note: {
    fontSize: 12,
    color: '#999',
    padding: 16,
    paddingTop: 4,
    fontStyle: 'italic',
  },
  infoContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 20,
  },
  refreshButton: {
    margin: 16,
    padding: 14,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  refreshButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    height: 40,
  },
});
