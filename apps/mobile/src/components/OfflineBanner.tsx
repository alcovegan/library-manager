/**
 * Offline Banner Component
 * Shows a banner when the device is offline
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOffline } from '../contexts/OfflineContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

export function OfflineBanner() {
  const { isOffline } = useOffline();
  const { colors } = useTheme();
  const { t } = useLanguage();

  if (!isOffline) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.mutedSurface, borderBottomColor: colors.border }]}>
      <Text style={[styles.icon]}>📡</Text>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]}>{t('offline.banner')}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>{t('offline.bannerSubtitle')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
});
