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
import { useTheme } from '../contexts/ThemeContext';
import { useOffline } from '../contexts/OfflineContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { SyncProviderType, SyncProviderInfo } from '../services/sync';

function SettingsSection({ title, children, colors }: { title: string; children: React.ReactNode; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function ProviderCard({
  provider,
  isConnecting,
  onConnect,
  onDisconnect,
  colors,
  disabled,
  t,
}: {
  provider: SyncProviderInfo;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  disabled?: boolean;
  t: (key: string) => string;
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
    <View style={[styles.providerCard, { backgroundColor: colors.mutedSurface }, provider.active && { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}>
      <View style={styles.providerInfo}>
        <Text style={styles.providerIcon}>{getProviderIcon(provider.type)}</Text>
        <View style={styles.providerText}>
          <Text style={[styles.providerName, { color: colors.text }]}>{provider.name}</Text>
          <Text style={[styles.providerDescription, { color: colors.muted }]}>{provider.description}</Text>
          {provider.active && (
            <View style={[styles.activeTag, { backgroundColor: colors.success }]}>
              <Text style={styles.activeTagText}>{t('syncSettings.active')}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.providerActions}>
        {provider.active ? (
          <TouchableOpacity
            style={[styles.providerButton, styles.disconnectButton, { backgroundColor: colors.danger }, disabled && styles.disabledButton]}
            onPress={onDisconnect}
            disabled={disabled}
          >
            <Text style={styles.disconnectButtonText}>{t('syncSettings.disconnect')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.providerButton, styles.connectButton, { backgroundColor: colors.border }, (isConnecting || disabled) && styles.disabledButton]}
            onPress={onConnect}
            disabled={isConnecting || disabled}
          >
            {isConnecting ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={[styles.connectButtonText, { color: disabled ? colors.muted : colors.accent }]}>
                {provider.configured ? t('syncSettings.connect') : t('syncSettings.configure')}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function SyncSettingsScreen() {
  const { colors } = useTheme();
  const { isOffline } = useOffline();
  const { t, language } = useLanguage();
  const {
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
  } = useSyncSettings();

  const formatLastSync = (timestamp: string | null): string => {
    if (!timestamp) return t('syncSettings.never');
    const date = new Date(timestamp);
    return date.toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US');
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>{t('common.loading')}</Text>
      </View>
    );
  }

  const cloudProviders = providers.filter((p) => p.isCloud);
  const otherProviders = providers.filter((p) => !p.isCloud);
  const hasActiveProvider = activeProvider !== 'none';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Offline Warning */}
      {isOffline && (
        <View style={[styles.offlineWarning, { backgroundColor: colors.dangerGlow, borderColor: colors.danger }]}>
          <Text style={[styles.offlineWarningText, { color: colors.danger }]}>
            {t('syncSettings.noConnection')}
          </Text>
        </View>
      )}

      {/* Status Section */}
      <SettingsSection title={t('syncSettings.syncStatus')} colors={colors}>
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.muted }]}>{t('syncSettings.providerLabel')}</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>
              {hasActiveProvider
                ? providers.find((p) => p.type === activeProvider)?.name || activeProvider
                : t('syncSettings.notSelected')}
            </Text>
          </View>

          {userInfo && (
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.muted }]}>{t('syncSettings.account')}</Text>
              <Text style={[styles.statusValue, { color: colors.text }]}>
                {userInfo.name}
                {userInfo.email && ` (${userInfo.email})`}
              </Text>
            </View>
          )}

          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.muted }]}>{t('syncSettings.lastSyncLabel')}</Text>
            <Text style={[styles.statusValue, { color: colors.text }]}>{formatLastSync(lastSync)}</Text>
          </View>
        </View>
      </SettingsSection>

      {/* Pending Local Changes */}
      {hasActiveProvider && activeProvider !== 's3' && pendingChanges && (
        <SettingsSection title={t('syncSettings.localChanges')} colors={colors}>
          <View style={styles.pendingChangesContainer}>
            {pendingChanges.hasChanges ? (
              <>
                <Text style={[styles.pendingChangesTitle, { color: colors.accent }]}>
                  {t('syncSettings.unsyncedChanges', { count: pendingChanges.total })}
                </Text>
                <View style={[styles.pendingChangesList, { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}>
                  {pendingChanges.books > 0 && (
                    <Text style={[styles.pendingChangesItem, { color: colors.accent }]}>{t('syncSettings.booksLabel', { count: pendingChanges.books })}</Text>
                  )}
                  {pendingChanges.authors > 0 && (
                    <Text style={[styles.pendingChangesItem, { color: colors.accent }]}>{t('syncSettings.authorsLabel', { count: pendingChanges.authors })}</Text>
                  )}
                  {pendingChanges.collections > 0 && (
                    <Text style={[styles.pendingChangesItem, { color: colors.accent }]}>{t('syncSettings.collectionsLabel', { count: pendingChanges.collections })}</Text>
                  )}
                  {pendingChanges.readingSessions > 0 && (
                    <Text style={[styles.pendingChangesItem, { color: colors.accent }]}>{t('syncSettings.readingSessionsLabel', { count: pendingChanges.readingSessions })}</Text>
                  )}
                  {pendingChanges.storageLocations > 0 && (
                    <Text style={[styles.pendingChangesItem, { color: colors.accent }]}>{t('syncSettings.storageLocationsLabel', { count: pendingChanges.storageLocations })}</Text>
                  )}
                  {pendingChanges.filterPresets > 0 && (
                    <Text style={[styles.pendingChangesItem, { color: colors.accent }]}>{t('syncSettings.filterPresetsLabel', { count: pendingChanges.filterPresets })}</Text>
                  )}
                  {pendingChanges.vocabCustom > 0 && (
                    <Text style={[styles.pendingChangesItem, { color: colors.accent }]}>{t('syncSettings.vocabLabel', { count: pendingChanges.vocabCustom })}</Text>
                  )}
                </View>
              </>
            ) : (
              <View style={[styles.noChangesBox, { backgroundColor: colors.successGlow, borderColor: colors.success }]}>
                <Text style={[styles.noChangesText, { color: colors.success }]}>{t('syncSettings.allSynced')}</Text>
              </View>
            )}
          </View>
        </SettingsSection>
      )}

      {/* Remote Sync Info - shows who last synced to cloud */}
      {remoteSyncInfo && hasActiveProvider && activeProvider !== 's3' && (
        <SettingsSection title={t('syncSettings.cloudData')} colors={colors}>
          <View style={styles.remoteInfoContainer}>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.muted }]}>{t('syncSettings.lastUpdate')}</Text>
              <Text style={[styles.statusValue, { color: colors.text }]}>{formatLastSync(remoteSyncInfo.syncedAt)}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.muted }]}>{t('syncSettings.source')}</Text>
              <Text style={[styles.statusValue, { color: colors.text }]}>
                {remoteSyncInfo.deviceName} ({remoteSyncInfo.platform})
              </Text>
            </View>

            {/* Status based on whether we have this data */}
            {remoteSyncInfo.isUpToDate ? (
              <View style={[styles.successBox, { backgroundColor: colors.successGlow, borderColor: colors.success }]}>
                <Text style={[styles.successText, { color: colors.success }]}>
                  {t('syncSettings.dataUpToDate')}
                </Text>
              </View>
            ) : (
              <View style={[styles.warningBox, { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}>
                <Text style={[styles.warningText, { color: colors.accent }]}>
                  {t('syncSettings.newDataAvailable', { device: remoteSyncInfo.deviceName })}
                </Text>
              </View>
            )}
          </View>
        </SettingsSection>
      )}

      {/* Sync Actions */}
      {hasActiveProvider && activeProvider !== 's3' && (
        <View style={styles.syncActions}>
          <TouchableOpacity
            style={[styles.syncButton, styles.syncUpButton, { backgroundColor: colors.success }, (isSyncing || isOffline) && styles.disabledButton]}
            onPress={syncUp}
            disabled={isSyncing || isOffline}
          >
            {isSyncing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Text style={styles.syncButtonIcon}>⬆️</Text>
                <Text style={styles.syncButtonText}>{t('syncSettings.uploadToCloud')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.syncButton, styles.syncDownButton, { backgroundColor: colors.accent }, (isSyncing || isOffline) && styles.disabledButton]}
            onPress={syncDown}
            disabled={isSyncing || isOffline}
          >
            {isSyncing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Text style={styles.syncButtonIcon}>⬇️</Text>
                <Text style={styles.syncButtonText}>{t('syncSettings.downloadFromCloud')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Cloud Providers */}
      <SettingsSection title={t('syncSettings.cloudProviders')} colors={colors}>
        <View style={styles.providerList}>
          {cloudProviders.map((provider) => (
            <ProviderCard
              key={provider.type}
              provider={provider}
              isConnecting={isConnecting}
              onConnect={() => connectProvider(provider.type)}
              onDisconnect={() => disconnectProvider(provider.type)}
              colors={colors}
              disabled={isOffline}
              t={t}
            />
          ))}
        </View>
      </SettingsSection>

      {/* S3 Provider */}
      <SettingsSection title={t('syncSettings.s3Storage')} colors={colors}>
        <View style={styles.providerList}>
          {otherProviders.map((provider) => (
            <ProviderCard
              key={provider.type}
              provider={provider}
              isConnecting={isConnecting}
              onConnect={() => connectProvider(provider.type)}
              onDisconnect={() => disconnectProvider(provider.type)}
              colors={colors}
              disabled={isOffline}
              t={t}
            />
          ))}
        </View>
        <Text style={[styles.s3Note, { color: colors.muted }]}>
          {t('syncSettings.s3Note')}
        </Text>
      </SettingsSection>

      {/* Info */}
      <View style={[styles.infoContainer, { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}>
        <Text style={[styles.infoTitle, { color: colors.accent }]}>{t('syncSettings.important')}</Text>
        <Text style={[styles.infoText, { color: colors.accent }]}>
          {t('syncSettings.oneProviderNote')}
        </Text>
      </View>

      {/* Refresh */}
      <TouchableOpacity style={[styles.refreshButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={refresh}>
        <Text style={[styles.refreshButtonText, { color: colors.accent }]}>{t('syncSettings.refreshStatus')}</Text>
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
  offlineWarning: {
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  offlineWarningText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
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
  pendingChangesContainer: {
    padding: 16,
  },
  pendingChangesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  pendingChangesList: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  pendingChangesItem: {
    fontSize: 13,
    color: '#856404',
    paddingVertical: 2,
  },
  noChangesBox: {
    backgroundColor: '#d4edda',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  noChangesText: {
    fontSize: 14,
    color: '#155724',
    fontWeight: '500',
    textAlign: 'center',
  },
  remoteInfoContainer: {
    padding: 16,
  },
  warningBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
  successBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#d4edda',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  successText: {
    fontSize: 14,
    color: '#155724',
    fontWeight: '500',
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
