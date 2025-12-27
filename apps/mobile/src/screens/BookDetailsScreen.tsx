/**
 * Book Details Screen
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useBook } from '../hooks/useDatabase';
import { getCoverUri } from '../utils/covers';
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

export default function BookDetailsScreen({ route }: Props) {
  const { bookId } = route.params;
  const { book, loading, error } = useBook(bookId);

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
});
