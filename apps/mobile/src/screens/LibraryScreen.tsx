/**
 * Library Screen - displays list of all books
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBooks, useDatabaseInit } from '../hooks/useDatabase';
import { getCoverUri } from '../utils/covers';
import type { BookWithAuthors, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function BookItem({ book, onPress }: { book: BookWithAuthors; onPress: () => void }) {
  const authorsText = book.authors.map((a) => a.name).join(', ') || 'Автор неизвестен';
  const coverUri = getCoverUri(book.coverPath);

  return (
    <TouchableOpacity style={styles.bookItem} onPress={onPress}>
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={styles.bookCover} />
      ) : (
        <View style={styles.bookCoverPlaceholder}>
          <Text style={styles.bookCoverPlaceholderText}>📚</Text>
        </View>
      )}
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.bookAuthors} numberOfLines={1}>
          {authorsText}
        </Text>
        {book.year && (
          <Text style={styles.bookYear}>{book.year}</Text>
        )}
      </View>
      {book.rating && (
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>★ {book.rating}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function LibraryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { ready, error: dbError } = useDatabaseInit();
  const { books, loading, error, refresh } = useBooks();

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Инициализация базы данных...</Text>
      </View>
    );
  }

  if (dbError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Ошибка базы данных: {dbError.message}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Ошибка: {error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBookPress = (bookId: string) => {
    navigation.navigate('BookDetails', { bookId });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={books}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookItem book={item} onPress={() => handleBookPress(item.id)} />
        )}
        contentContainerStyle={books.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyText}>Библиотека пуста</Text>
            <Text style={styles.emptySubtext}>
              Добавьте книги на десктопной версии, они появятся здесь после синхронизации
            </Text>
          </View>
        }
      />
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
  bookItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bookCover: {
    width: 60,
    height: 90,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  bookCoverPlaceholder: {
    width: 60,
    height: 90,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookCoverPlaceholderText: {
    fontSize: 24,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  bookAuthors: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  bookYear: {
    fontSize: 12,
    color: '#999',
  },
  ratingBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  ratingText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '600',
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
});
