/**
 * Book Details Screen
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useBook, useCollections } from '../hooks/useDatabase';
import { addBookToCollection, removeBookFromCollection } from '../services/database';
import type { CollectionWithCount } from '../services/database';
import { getCoverUri } from '../utils/covers';
import { AppEvents, eventEmitter } from '../services/events';
import { useTheme } from '../contexts/ThemeContext';
import { useOffline } from '../contexts/OfflineContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BookDetails'>;

function DetailRow({ label, value, colors }: { label: string; value: string | null | undefined; colors: ReturnType<typeof useTheme>['colors'] }) {
  if (!value) return null;

  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

export default function BookDetailsScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const { book, loading, error } = useBook(bookId);
  const { collections } = useCollections();
  const { colors } = useTheme();
  const { isOffline } = useOffline();
  const { t, pluralizeBooks, language } = useLanguage();

  const [collectionModalVisible, setCollectionModalVisible] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);

  // Set up header edit button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('EditBook', { bookId })}
          style={[styles.headerButton, isOffline && styles.headerButtonDisabled]}
          disabled={isOffline}
        >
          <Text style={[styles.headerButtonText, isOffline && styles.headerButtonTextDisabled]}>
            {t('bookDetails.edit')}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, bookId, isOffline, t]);

  // Filter to only static collections (can't manually add to filter collections)
  const staticCollections = collections.filter(c => c.type === 'static');

  const handleAddToCollection = useCallback(async (collection: CollectionWithCount) => {
    setSavingCollection(true);
    try {
      await addBookToCollection(collection.id, bookId);
      eventEmitter.emit(AppEvents.DATA_CHANGED);
      setCollectionModalVisible(false);
      Alert.alert(t('common.done'), t('bookDetails.addedToCollection', { name: collection.name }));
    } catch (e) {
      Alert.alert(t('common.error'), t('bookDetails.addToCollectionFailed'));
    } finally {
      setSavingCollection(false);
    }
  }, [bookId, t]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !book) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {error?.message || t('bookDetails.bookNotFound')}
        </Text>
      </View>
    );
  }

  const authorsText = book.authors.map((a) => a.name).join(', ') || t('library.unknownAuthor');
  const genresText = book.genres ? JSON.parse(book.genres).join(', ') : null;
  const tagsText = book.tags ? JSON.parse(book.tags).join(', ') : null;
  const coverUri = getCoverUri(book.coverPath);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={[styles.coverImage, { backgroundColor: colors.mutedSurface }]} />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: colors.mutedSurface }]}>
              <Text style={styles.coverPlaceholderText}>📚</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={[styles.title, { color: colors.text }]}>{book.title}</Text>
            {book.titleAlt && (
              <Text style={[styles.titleAlt, { color: colors.muted }]}>{book.titleAlt}</Text>
            )}
            <Text style={[styles.authors, { color: colors.muted }]}>{authorsText}</Text>
          </View>
        </View>
      </View>

      {/* Add to Collection button */}
      <TouchableOpacity
        style={[styles.addToCollectionButton, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        onPress={() => setCollectionModalVisible(true)}
        disabled={isOffline}
      >
        <Text style={[styles.addToCollectionText, { color: isOffline ? colors.muted : colors.accent }]}>
          📁 {t('bookDetails.addToCollection')}{isOffline ? t('bookDetails.offlineSuffix') : ''}
        </Text>
      </TouchableOpacity>

      {book.rating && (
        <View style={[styles.ratingContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.ratingStars, { color: colors.accent }]}>
            {'★'.repeat(Math.floor(book.rating))}
            {'☆'.repeat(5 - Math.floor(book.rating))}
          </Text>
          <Text style={[styles.ratingValue, { color: colors.text }]}>{book.rating.toFixed(1)}</Text>
        </View>
      )}

      <Section title={t('bookDetails.info')} colors={colors}>
        <DetailRow label={t('bookDetails.year')} value={book.year?.toString()} colors={colors} />
        <DetailRow label={t('bookDetails.publisher')} value={book.publisher} colors={colors} />
        <DetailRow label={t('bookDetails.isbn')} value={book.isbn} colors={colors} />
        <DetailRow label={t('bookDetails.language')} value={book.language} colors={colors} />
        <DetailRow label={t('bookDetails.format')} value={book.format} colors={colors} />
        {book.series && (
          <DetailRow
            label={t('bookDetails.series')}
            value={
              book.seriesIndex
                ? `${book.series} (#${book.seriesIndex})`
                : book.series
            }
            colors={colors}
          />
        )}
      </Section>

      {genresText && (
        <Section title={t('bookDetails.genres')} colors={colors}>
          <Text style={[styles.tagsText, { color: colors.text }]}>{genresText}</Text>
        </Section>
      )}

      {tagsText && (
        <Section title={t('bookDetails.tags')} colors={colors}>
          <Text style={[styles.tagsText, { color: colors.text }]}>{tagsText}</Text>
        </Section>
      )}

      {book.notes && (
        <Section title={t('bookDetails.notes')} colors={colors}>
          <Text style={[styles.notesText, { color: colors.text }]}>{book.notes}</Text>
        </Section>
      )}

      {book.goodreadsRating && (
        <Section title="Goodreads" colors={colors}>
          <DetailRow
            label={t('bookDetails.rating')}
            value={`${book.goodreadsRating.toFixed(2)} (${t('bookDetails.goodreadsRatings', { count: book.goodreadsRatingsCount })})`}
            colors={colors}
          />
          {book.goodreadsUrl && (
            <DetailRow label={t('bookDetails.page')} value={t('bookDetails.openInBrowser')} colors={colors} />
          )}
        </Section>
      )}

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.muted }]}>
          {t('bookDetails.createdAt')}: {new Date(book.createdAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
        </Text>
        <Text style={[styles.footerText, { color: colors.muted }]}>
          {t('bookDetails.updatedAt')}: {new Date(book.updatedAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
        </Text>
      </View>

      {/* Collection selection modal */}
      <Modal
        visible={collectionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCollectionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('bookDetails.selectCollection')}</Text>

            {staticCollections.length === 0 ? (
              <Text style={[styles.noCollectionsText, { color: colors.muted }]}>
                {t('bookDetails.noCollections')}
              </Text>
            ) : (
              <FlatList
                data={staticCollections}
                keyExtractor={(item) => item.id}
                style={styles.collectionList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.collectionOption, { borderBottomColor: colors.border }]}
                    onPress={() => handleAddToCollection(item)}
                    disabled={savingCollection}
                  >
                    <Text style={[styles.collectionOptionText, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.collectionOptionCount, { color: colors.muted }]}>
                      {pluralizeBooks(item.bookCount)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setCollectionModalVisible(false)}
            >
              <Text style={[styles.modalCloseButtonText, { color: colors.accent }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
  errorText: {
    color: '#ff3b30',
    textAlign: 'center',
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerContent: {
    flexDirection: 'row',
  },
  coverImage: {
    width: 100,
    height: 150,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: '#f0f0f0',
  },
  coverPlaceholder: {
    width: 100,
    height: 150,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    fontSize: 40,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  titleAlt: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  authors: {
    fontSize: 16,
    color: '#666',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  ratingStars: {
    fontSize: 24,
    color: '#ffc107',
    marginRight: 8,
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    color: '#1c1c1e',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  tagsText: {
    fontSize: 16,
    color: '#1c1c1e',
    lineHeight: 24,
  },
  notesText: {
    fontSize: 16,
    color: '#1c1c1e',
    lineHeight: 24,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  addToCollectionButton: {
    backgroundColor: 'white',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    alignItems: 'center',
  },
  addToCollectionText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
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
    padding: 20,
    width: '100%',
    maxWidth: 340,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 16,
    textAlign: 'center',
  },
  noCollectionsText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
    lineHeight: 22,
  },
  collectionList: {
    maxHeight: 250,
  },
  collectionOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  collectionOptionText: {
    fontSize: 16,
    color: '#1c1c1e',
    flex: 1,
  },
  collectionOptionCount: {
    fontSize: 14,
    color: '#999',
    marginLeft: 8,
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '500',
  },
  headerButtonTextDisabled: {
    color: '#999',
  },
});
