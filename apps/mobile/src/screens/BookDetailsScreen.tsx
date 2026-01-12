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
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BookDetails'>;

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

export default function BookDetailsScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const { book, loading, error } = useBook(bookId);
  const { collections } = useCollections();

  const [collectionModalVisible, setCollectionModalVisible] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);

  // Set up header edit button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('EditBook', { bookId })}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>Изменить</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, bookId]);

  // Filter to only static collections (can't manually add to filter collections)
  const staticCollections = collections.filter(c => c.type === 'static');

  const handleAddToCollection = useCallback(async (collection: CollectionWithCount) => {
    setSavingCollection(true);
    try {
      await addBookToCollection(collection.id, bookId);
      eventEmitter.emit(AppEvents.DATA_CHANGED);
      setCollectionModalVisible(false);
      Alert.alert('Готово', `Книга добавлена в "${collection.name}"`);
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось добавить книгу в коллекцию');
    } finally {
      setSavingCollection(false);
    }
  }, [bookId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error || !book) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {error?.message || 'Книга не найдена'}
        </Text>
      </View>
    );
  }

  const authorsText = book.authors.map((a) => a.name).join(', ') || 'Автор неизвестен';
  const genresText = book.genres ? JSON.parse(book.genres).join(', ') : null;
  const tagsText = book.tags ? JSON.parse(book.tags).join(', ') : null;
  const coverUri = getCoverUri(book.coverPath);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverPlaceholderText}>📚</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{book.title}</Text>
            {book.titleAlt && (
              <Text style={styles.titleAlt}>{book.titleAlt}</Text>
            )}
            <Text style={styles.authors}>{authorsText}</Text>
          </View>
        </View>
      </View>

      {/* Add to Collection button */}
      <TouchableOpacity
        style={styles.addToCollectionButton}
        onPress={() => setCollectionModalVisible(true)}
      >
        <Text style={styles.addToCollectionText}>📁 Добавить в коллекцию</Text>
      </TouchableOpacity>

      {book.rating && (
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingStars}>
            {'★'.repeat(Math.floor(book.rating))}
            {'☆'.repeat(5 - Math.floor(book.rating))}
          </Text>
          <Text style={styles.ratingValue}>{book.rating.toFixed(1)}</Text>
        </View>
      )}

      <Section title="Информация">
        <DetailRow label="Год" value={book.year?.toString()} />
        <DetailRow label="Издательство" value={book.publisher} />
        <DetailRow label="ISBN" value={book.isbn} />
        <DetailRow label="Язык" value={book.language} />
        <DetailRow label="Формат" value={book.format} />
        {book.series && (
          <DetailRow
            label="Серия"
            value={
              book.seriesIndex
                ? `${book.series} (#${book.seriesIndex})`
                : book.series
            }
          />
        )}
      </Section>

      {genresText && (
        <Section title="Жанры">
          <Text style={styles.tagsText}>{genresText}</Text>
        </Section>
      )}

      {tagsText && (
        <Section title="Теги">
          <Text style={styles.tagsText}>{tagsText}</Text>
        </Section>
      )}

      {book.notes && (
        <Section title="Заметки">
          <Text style={styles.notesText}>{book.notes}</Text>
        </Section>
      )}

      {book.goodreadsRating && (
        <Section title="Goodreads">
          <DetailRow
            label="Рейтинг"
            value={`${book.goodreadsRating.toFixed(2)} (${book.goodreadsRatingsCount} оценок)`}
          />
          {book.goodreadsUrl && (
            <DetailRow label="Страница" value="Открыть в браузере" />
          )}
        </Section>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Добавлено: {new Date(book.createdAt).toLocaleDateString('ru-RU')}
        </Text>
        <Text style={styles.footerText}>
          Обновлено: {new Date(book.updatedAt).toLocaleDateString('ru-RU')}
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Выберите коллекцию</Text>

            {staticCollections.length === 0 ? (
              <Text style={styles.noCollectionsText}>
                Нет доступных коллекций. Создайте коллекцию во вкладке "Коллекции".
              </Text>
            ) : (
              <FlatList
                data={staticCollections}
                keyExtractor={(item) => item.id}
                style={styles.collectionList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.collectionOption}
                    onPress={() => handleAddToCollection(item)}
                    disabled={savingCollection}
                  >
                    <Text style={styles.collectionOptionText}>{item.name}</Text>
                    <Text style={styles.collectionOptionCount}>
                      {item.bookCount} книг
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setCollectionModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Отмена</Text>
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
  headerButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '500',
  },
});
