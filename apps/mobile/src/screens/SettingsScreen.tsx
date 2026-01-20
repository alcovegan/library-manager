/**
 * Settings Screen with S3 sync configuration and Appearance settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBooksCount } from '../hooks/useDatabase';
import type { RootStackParamList } from '../types';
import { loadS3Config, saveS3Config, getLastSync } from '../services/settings';
import { configureSync, syncDown, getSyncStatus, initializeSync } from '../services/syncManager';
import type { S3Config } from '../services/s3Client';
import { useTheme, PALETTE_IDS, PALETTES, ThemeMode, PaletteId } from '../contexts/ThemeContext';
import { useOffline } from '../contexts/OfflineContext';
import { useLanguage, Language } from '../contexts/LanguageContext';

function SettingsSection({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  showArrow,
  colors,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  colors: any;
}) {
  const content = (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={[styles.rowValue, { color: colors.muted }]}>{value}</Text>}
        {showArrow && <Text style={[styles.arrow, { color: colors.muted }]}>›</Text>}
      </View>
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }

  return content;
}

// Language Section Component
function LanguageSection({ colors, t }: { colors: any; t: (key: string, options?: object) => string }) {
  const { language, setLanguage } = useLanguage();

  const languages: { id: Language; label: string; flag: string }[] = [
    { id: 'ru', label: t('settings.languageRu'), flag: '🇷🇺' },
    { id: 'en', label: t('settings.languageEn'), flag: '🇬🇧' },
  ];

  return (
    <SettingsSection title={t('settings.language')} colors={colors}>
      <View style={styles.appearanceContainer}>
        <View style={styles.themeRow}>
          {languages.map(({ id, label, flag }) => {
            const isActive = id === language;
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.themeButton,
                  {
                    backgroundColor: isActive ? colors.surface : colors.mutedSurface,
                    borderColor: isActive ? colors.accent : colors.border,
                    borderWidth: isActive ? 2 : 1,
                  },
                ]}
                onPress={() => setLanguage(id)}
              >
                <Text
                  style={[styles.themeButtonText, { color: isActive ? colors.accent : colors.text, fontWeight: isActive ? '700' : '600' }]}
                  numberOfLines={1}
                >
                  {flag} {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SettingsSection>
  );
}

// Appearance Section Component
function AppearanceSection({ colors, t }: { colors: any; t: (key: string, options?: object) => string }) {
  const { palette, theme, setPalette, setTheme, palettes, paletteIds } = useTheme();

  const themeModes: { id: ThemeMode; label: string; icon: string }[] = [
    { id: 'light', label: t('settings.themeLight'), icon: '☀️' },
    { id: 'dark', label: t('settings.themeDark'), icon: '🌙' },
    { id: 'system', label: t('settings.themeSystem'), icon: '💻' },
  ];

  return (
    <SettingsSection title={t('settings.appearance')} colors={colors}>
      <View style={[styles.appearanceContainer, { borderBottomColor: colors.border }]}>
        <Text style={[styles.appearanceLabel, { color: colors.muted }]}>{t('settings.colorPalette')}</Text>
        <View style={styles.paletteGrid}>
          {paletteIds.map((id: PaletteId) => {
            const p = palettes[id];
            const isActive = id === palette;
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.paletteButton,
                  { backgroundColor: colors.mutedSurface, borderColor: isActive ? colors.accent : colors.border },
                  isActive && { borderWidth: 2 },
                ]}
                onPress={() => setPalette(id)}
              >
                <View style={[styles.paletteDot, { backgroundColor: p.light.accent }]} />
                <Text style={[styles.paletteName, { color: isActive ? colors.text : colors.muted }]} numberOfLines={1}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={styles.appearanceContainer}>
        <Text style={[styles.appearanceLabel, { color: colors.muted }]}>{t('settings.theme')}</Text>
        <View style={styles.themeRow}>
          {themeModes.map(({ id, label, icon }) => {
            const isActive = id === theme;
            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.themeButton,
                  {
                    backgroundColor: isActive ? colors.surface : colors.mutedSurface,
                    borderColor: isActive ? colors.accent : colors.border,
                    borderWidth: isActive ? 2 : 1,
                  },
                ]}
                onPress={() => setTheme(id)}
              >
                <Text
                  style={[styles.themeButtonText, { color: isActive ? colors.accent : colors.text, fontWeight: isActive ? '700' : '600' }]}
                  numberOfLines={1}
                >
                  {icon} {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SettingsSection>
  );
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { count } = useBooksCount();
  const { colors } = useTheme();
  const { debugForceOffline, setDebugForceOffline, isOffline } = useOffline();
  const { t } = useLanguage();
  const [showS3Config, setShowS3Config] = useState(false);
  const [s3Config, setS3Config] = useState<S3Config>({
    endpoint: '',
    accessKey: '',
    secretKey: '',
    bucket: '',
    region: 'us-east-1',
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // Load saved config and status
  useEffect(() => {
    loadSavedConfig();
  }, []);

  const loadSavedConfig = async () => {
    const config = await loadS3Config();
    if (config) {
      setS3Config(config);
      setIsConfigured(true);
    }
    const lastSyncTime = await getLastSync();
    setLastSync(lastSyncTime);
  };

  const handleTestConnection = async () => {
    if (!s3Config.endpoint || !s3Config.accessKey || !s3Config.secretKey || !s3Config.bucket) {
      Alert.alert(t('common.error'), t('settings.fillAllFields'));
      return;
    }

    setIsTesting(true);
    try {
      const result = await configureSync(s3Config);
      if (result.ok) {
        Alert.alert(t('common.ok'), t('settings.connectionSuccess'));
        setIsConfigured(true);
      } else {
        Alert.alert(t('common.error'), result.error || t('settings.connectionFailed'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('settings.connectionFailed'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Initialize if needed
      await initializeSync();

      const result = await syncDown();
      if (result.success) {
        Alert.alert(
          t('settings.syncSuccess'),
          t('settings.syncSuccessMessage', { books: result.booksImported || 0, covers: result.coversDownloaded || 0 }),
          [{ text: t('common.ok') }]
        );
        setLastSync(new Date().toISOString());
        // Reload the saved config to update counts
        loadSavedConfig();
      } else {
        Alert.alert(t('settings.syncError'), result.error || t('common.error'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('common.error'));
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (timestamp: string | null): string => {
    if (!timestamp) return t('settings.lastSyncNever');
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (showS3Config) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
        <SettingsSection title={t('settings.s3Settings')} colors={colors}>
          <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.muted }]}>{t('settings.s3Endpoint')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.mutedSurface, color: colors.text }]}
              value={s3Config.endpoint}
              onChangeText={(text) => setS3Config({ ...s3Config, endpoint: text })}
              placeholder="https://s3.example.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.muted }]}>{t('settings.s3AccessKey')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.mutedSurface, color: colors.text }]}
              value={s3Config.accessKey}
              onChangeText={(text) => setS3Config({ ...s3Config, accessKey: text })}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.muted }]}>{t('settings.s3SecretKey')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.mutedSurface, color: colors.text }]}
              value={s3Config.secretKey}
              onChangeText={(text) => setS3Config({ ...s3Config, secretKey: text })}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>

          <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.muted }]}>{t('settings.s3Bucket')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.mutedSurface, color: colors.text }]}
              value={s3Config.bucket}
              onChangeText={(text) => setS3Config({ ...s3Config, bucket: text })}
              placeholder="my-library-bucket"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.muted }]}>{t('settings.s3Region')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.mutedSurface, color: colors.text }]}
              value={s3Config.region}
              onChangeText={(text) => setS3Config({ ...s3Config, region: text })}
              placeholder="us-east-1"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </SettingsSection>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.mutedSurface }]}
            onPress={() => setShowS3Config(false)}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.accent }, isTesting && styles.disabledButton]}
            onPress={handleTestConnection}
            disabled={isTesting}
          >
            {isTesting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('settings.testConnection')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      <LanguageSection colors={colors} t={t} />
      <AppearanceSection colors={colors} t={t} />

      <SettingsSection title={t('settings.librarySection')} colors={colors}>
        <SettingsRow label={t('settings.totalBooks')} value={count.toString()} colors={colors} />
      </SettingsSection>

      <SettingsSection title={t('settings.syncSection')} colors={colors}>
        <SettingsRow
          label={t('settings.cloudSync')}
          value={t('settings.cloudSyncProviders')}
          onPress={() => navigation.navigate('SyncSettings')}
          showArrow
          colors={colors}
        />
        <SettingsRow
          label={t('settings.s3Settings')}
          value={isConfigured ? t('settings.s3Configured') : t('settings.s3NotConfigured')}
          onPress={() => setShowS3Config(true)}
          showArrow
          colors={colors}
        />
        <SettingsRow
          label={t('settings.lastSync')}
          value={formatLastSync(lastSync)}
          colors={colors}
        />
      </SettingsSection>

      {isConfigured && (
        <View style={styles.syncButtonContainer}>
          <TouchableOpacity
            style={[styles.syncButton, { backgroundColor: colors.success }, isSyncing && styles.disabledButton]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <View style={styles.syncingContainer}>
                <ActivityIndicator color="white" size="small" />
                <Text style={styles.syncButtonText}>{t('settings.syncing')}</Text>
              </View>
            ) : (
              <Text style={styles.syncButtonText}>{t('settings.syncButton')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <SettingsSection title={t('settings.aboutSection')} colors={colors}>
        <SettingsRow label={t('settings.version')} value="1.0.0" colors={colors} />
        <SettingsRow label={t('settings.database')} value="SQLite (expo-sqlite)" colors={colors} />
      </SettingsSection>

      <SettingsSection title={t('settings.developerSection')} colors={colors}>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={styles.switchRowLeft}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.forceOffline')}</Text>
            <Text style={[styles.switchRowHint, { color: colors.muted }]}>
              {t('settings.forceOfflineHint')}
            </Text>
          </View>
          <Switch
            value={debugForceOffline}
            onValueChange={setDebugForceOffline}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={debugForceOffline ? colors.surface : colors.surface}
          />
        </View>
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.networkStatus')}</Text>
          <Text style={[styles.rowValue, { color: isOffline ? colors.danger : colors.success }]}>
            {isOffline ? `📡 ${t('settings.statusOffline')}` : `✓ ${t('settings.statusOnline')}`}
          </Text>
        </View>
      </SettingsSection>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.muted }]}>{t('settings.footerTitle')}</Text>
        <Text style={[styles.footerSubtext, { color: colors.muted }]}>
          {t('settings.footerSubtitle')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionContent: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  // Appearance styles
  appearanceContainer: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appearanceLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paletteButton: {
    width: '18%',
    minWidth: 56,
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  paletteDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 4,
  },
  paletteName: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 16,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 16,
  },
  arrow: {
    fontSize: 20,
    marginLeft: 8,
  },
  switchRowLeft: {
    flex: 1,
  },
  switchRowHint: {
    fontSize: 12,
    marginTop: 2,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    fontSize: 16,
    padding: 10,
    borderRadius: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  syncButtonContainer: {
    padding: 16,
  },
  syncButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
