/**
 * Collections Screen - displays list of all collections
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useCollections, useDatabaseInit } from '../hooks/useDatabase';
import {
  createCollection,
  updateCollection,
  deleteCollection,
} from '../services/database';
import type { CollectionWithCount } from '../services/database';
import type { RootStackParamList } from '../types';
import { AppEvents, eventEmitter } from '../services/events';
import { useTheme } from '../contexts/ThemeContext';
import { useOffline } from '../contexts/OfflineContext';
import { useLanguage } from '../contexts/LanguageContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function CollectionItem({
  collection,
  onPress,
  onLongPress,
  colors,
  t,
  pluralizeBooks,
}: {
  collection: CollectionWithCount;
  onPress: () => void;
  onLongPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  t: (key: string, options?: object) => string;
  pluralizeBooks: (count: number) => string;
}) {
  const typeLabel = collection.type === 'filter' ? t('collections.typeFilter') : t('collections.typeStatic');
  const typeColor = collection.type === 'filter' ? colors.accent : colors.success;

  return (
    <TouchableOpacity
      style={[styles.collectionItem, { backgroundColor: colors.surface }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
    >
      <View style={[styles.collectionIcon, { backgroundColor: colors.mutedSurface }]}>
        <Text style={styles.collectionIconText}>
          {collection.type === 'filter' ? '🔍' : '📁'}
        </Text>
      </View>
      <View style={styles.collectionInfo}>
        <Text style={[styles.collectionName, { color: colors.text }]} numberOfLines={1}>
          {collection.name}
        </Text>
        <View style={styles.collectionMeta}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
            <Text style={[styles.typeText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
          <Text style={[styles.bookCount, { color: colors.muted }]}>
            {pluralizeBooks(collection.bookCount)}
          </Text>
        </View>
      </View>
      <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>
    </TouchableOpacity>
  );
}

export default function CollectionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { ready, error: dbError } = useDatabaseInit();
  const { collections, loading, error, refresh } = useCollections();
  const { colors } = useTheme();
  const { isOffline } = useOffline();
  const { t, pluralizeBooks } = useLanguage();

  // Modal state for create/edit
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionWithCount | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCollectionPress = useCallback((collectionId: string) => {
    navigation.navigate('CollectionDetails', { collectionId });
  }, [navigation]);

  const handleLongPress = useCallback((collection: CollectionWithCount) => {
    if (isOffline) {
      Alert.alert(t('offline.banner'), t('offline.editingUnavailable'));
      return;
    }

    Alert.alert(
      collection.name,
      t('collections.selectAction'),
      [
        {
          text: t('common.edit'),
          onPress: () => {
            setEditingCollection(collection);
            setCollectionName(collection.name);
            setModalVisible(true);
          },
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('collections.deleteConfirmTitle'),
              t('collections.deleteConfirmMessage', { name: collection.name }),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('common.delete'),
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteCollection(collection.id);
                      eventEmitter.emit(AppEvents.DATA_CHANGED);
                    } catch (e) {
                      Alert.alert(t('common.error'), t('collections.deleteFailed'));
                    }
                  },
                },
              ]
            );
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  }, [isOffline, t]);

  const handleAddPress = useCallback(() => {
    if (isOffline) {
      Alert.alert(t('offline.banner'), t('offline.creationUnavailable'));
      return;
    }
    setEditingCollection(null);
    setCollectionName('');
    setModalVisible(true);
  }, [isOffline, t]);

  const handleSave = useCallback(async () => {
    const name = collectionName.trim();
    if (!name) {
      Alert.alert(t('common.error'), t('collections.enterName'));
      return;
    }

    setSaving(true);
    try {
      if (editingCollection) {
        await updateCollection(editingCollection.id, { name });
      } else {
        await createCollection(name, 'static');
      }
      eventEmitter.emit(AppEvents.DATA_CHANGED);
      setModalVisible(false);
      setCollectionName('');
      setEditingCollection(null);
    } catch (e) {
      Alert.alert(t('common.error'), t('collections.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [collectionName, editingCollection, t]);

  const handleCancel = useCallback(() => {
    setModalVisible(false);
    setCollectionName('');
    setEditingCollection(null);
  }, []);

  if (!ready) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (dbError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>{t('collections.dbError')}: {dbError.message}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>{t('common.error')}: {error.message}</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.accent }]} onPress={refresh}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CollectionItem
            collection={item}
            onPress={() => handleCollectionPress(item.id)}
            onLongPress={() => handleLongPress(item)}
            colors={colors}
            t={t}
            pluralizeBooks={pluralizeBooks}
          />
        )}
        contentContainerStyle={collections.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={[styles.emptyText, { color: colors.text }]}>{t('collections.emptyTitle')}</Text>
            <Text style={[styles.emptySubtext, { color: colors.muted }]}>
              {t('collections.emptySubtitle')}
            </Text>
          </View>
        }
      />

      {/* FAB for adding new collection */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }, isOffline && styles.fabDisabled]}
        onPress={handleAddPress}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal for create/edit */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingCollection ? t('collections.editCollection') : t('collections.newCollection')}
            </Text>

            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, backgroundColor: colors.mutedSurface, color: colors.text }]}
              value={collectionName}
              onChangeText={setCollectionName}
              placeholder={t('collections.collectionName')}
              placeholderTextColor={colors.muted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.mutedSurface }]}
                onPress={handleCancel}
                disabled={saving}
              >
                <Text style={[styles.modalButtonCancelText, { color: colors.muted }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave, { backgroundColor: colors.accent }]}
                onPress={handleSave}
                disabled={saving || !collectionName.trim()}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonSaveText}>
                    {editingCollection ? t('common.save') : t('common.create')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    color: '#ff3b30',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryText: {
    color: 'white',
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  collectionItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  collectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  collectionIconText: {
    fontSize: 24,
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 6,
  },
  collectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  bookCount: {
    fontSize: 13,
    color: '#666',
  },
  chevron: {
    fontSize: 24,
    color: '#c7c7cc',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    fontSize: 32,
    color: 'white',
    fontWeight: '300',
    marginTop: -2,
  },
  fabDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1c1c1e',
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  modalButtonSave: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
