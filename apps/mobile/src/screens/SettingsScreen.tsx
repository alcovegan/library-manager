/**
 * Settings Screen with S3 sync configuration
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBooksCount } from '../hooks/useDatabase';
import type { RootStackParamList } from '../types';
import { loadS3Config, saveS3Config, getLastSync } from '../services/settings';
import { configureSync, syncDown, getSyncStatus, initializeSync } from '../services/syncManager';
import type { S3Config } from '../services/s3Client';

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  showArrow,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
}) {
  const content = (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {showArrow && <Text style={styles.arrow}>›</Text>}
      </View>
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }

  return content;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { count } = useBooksCount();
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
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }

    setIsTesting(true);
    try {
      const result = await configureSync(s3Config);
      if (result.ok) {
        Alert.alert('Успешно', 'Подключение установлено');
        setIsConfigured(true);
      } else {
        Alert.alert('Ошибка', result.error || 'Не удалось подключиться');
      }
    } catch (error) {
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Неизвестная ошибка');
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
          'Синхронизация завершена',
          `Импортировано книг: ${result.booksImported || 0}\nЗагружено обложек: ${result.coversDownloaded || 0}`,
          [{ text: 'OK' }]
        );
        setLastSync(new Date().toISOString());
        // Reload the saved config to update counts
        loadSavedConfig();
      } else {
        Alert.alert('Ошибка синхронизации', result.error || 'Неизвестная ошибка');
      }
    } catch (error) {
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (timestamp: string | null): string => {
    if (!timestamp) return 'Никогда';
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU');
  };

  if (showS3Config) {
    return (
      <ScrollView style={styles.container}>
        <SettingsSection title="Настройки S3">
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Endpoint (URL)</Text>
            <TextInput
              style={styles.input}
              value={s3Config.endpoint}
              onChangeText={(text) => setS3Config({ ...s3Config, endpoint: text })}
              placeholder="https://s3.example.com"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Access Key</Text>
            <TextInput
              style={styles.input}
              value={s3Config.accessKey}
              onChangeText={(text) => setS3Config({ ...s3Config, accessKey: text })}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Secret Key</Text>
            <TextInput
              style={styles.input}
              value={s3Config.secretKey}
              onChangeText={(text) => setS3Config({ ...s3Config, secretKey: text })}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Bucket</Text>
            <TextInput
              style={styles.input}
              value={s3Config.bucket}
              onChangeText={(text) => setS3Config({ ...s3Config, bucket: text })}
              placeholder="my-library-bucket"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Region</Text>
            <TextInput
              style={styles.input}
              value={s3Config.region}
              onChangeText={(text) => setS3Config({ ...s3Config, region: text })}
              placeholder="us-east-1"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </SettingsSection>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setShowS3Config(false)}
          >
            <Text style={styles.secondaryButtonText}>Назад</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, isTesting && styles.disabledButton]}
            onPress={handleTestConnection}
            disabled={isTesting}
          >
            {isTesting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Проверить</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <SettingsSection title="Библиотека">
        <SettingsRow label="Всего книг" value={count.toString()} />
      </SettingsSection>

      <SettingsSection title="Синхронизация">
        <SettingsRow
          label="Облачная синхронизация"
          value="Yandex, Google, Dropbox"
          onPress={() => navigation.navigate('SyncSettings')}
          showArrow
        />
        <SettingsRow
          label="Настройки S3"
          value={isConfigured ? 'Настроено' : 'Не настроено'}
          onPress={() => setShowS3Config(true)}
          showArrow
        />
        <SettingsRow
          label="Последняя синхронизация"
          value={formatLastSync(lastSync)}
        />
      </SettingsSection>

      {isConfigured && (
        <View style={styles.syncButtonContainer}>
          <TouchableOpacity
            style={[styles.syncButton, isSyncing && styles.disabledButton]}
            onPress={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <View style={styles.syncingContainer}>
                <ActivityIndicator color="white" size="small" />
                <Text style={styles.syncButtonText}>Синхронизация...</Text>
              </View>
            ) : (
              <Text style={styles.syncButtonText}>Синхронизировать</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <SettingsSection title="О приложении">
        <SettingsRow label="Версия" value="1.0.0" />
        <SettingsRow label="База данных" value="SQLite (expo-sqlite)" />
      </SettingsSection>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Library Manager Mobile</Text>
        <Text style={styles.footerSubtext}>
          Синхронизируйте данные с десктопной версией через S3-совместимое хранилище
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  rowLabel: {
    fontSize: 16,
    color: '#1c1c1e',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 16,
    color: '#666',
  },
  arrow: {
    fontSize: 20,
    color: '#c7c7cc',
    marginLeft: 8,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    fontSize: 16,
    color: '#1c1c1e',
    padding: 10,
    backgroundColor: '#f5f5f5',
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
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#e5e5e5',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#1c1c1e',
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
    backgroundColor: '#34C759',
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
    color: '#666',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});
