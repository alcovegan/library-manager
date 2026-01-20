/**
 * Collection Details Screen - displays books in a collection
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { useCollectionBooks, useCollection } from '../hooks/useDatabase';
import { removeBookFromCollection } from '../services/database';
import { getCoverUri } from '../utils/covers';
import { AppEvents, eventEmitter } from '../services/events';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { BookWithAuthors, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type CollectionDetailsRouteProp = RouteProp<RootStackParamList, 'CollectionDetails'>;

function BookItem({
  book,
  onPress,
  onLongPress,
  colors,
  t,
}: {
  book: BookWithAuthors;
  onPress: () => void;
  onLongPress?: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  t: (key: string) => string;
}) {
  const authorsText = book.authors.map((a) => a.name).join(', ') || t('library.unknownAuthor');
  const coverUri = getCoverUri(book.coverPath);

  return (
    <TouchableOpacity
      style={[styles.bookItem, { backgroundColor: colors.surface }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
    >
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={[styles.bookCover, { backgroundColor: colors.mutedSurface }]} />
      ) : (
        <View style={[styles.bookCoverPlaceholder, { backgroundColor: colors.mutedSurface }]}>
          <Text style={styles.bookCoverPlaceholderText}>📚</Text>
        </View>
      )}
      <View style={styles.bookInfo}>
        <Text style={[styles.bookTitle, { color: colors.text }]} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={[styles.bookAuthors, { color: colors.muted }]} numberOfLines={1}>
          {authorsText}
        </Text>
        {book.year && (
          <Text style={[styles.bookYear, { color: colors.muted }]}>{book.year}</Text>
        )}
      </View>
      {book.rating && (
        <View style={[styles.ratingBadge, { backgroundColor: colors.accentGlow }]}>
          <Text style={[styles.ratingText, { color: colors.accent }]}>★ {book.rating}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function CollectionDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CollectionDetailsRouteProp>();
  const { collectionId } = route.params;
  const { colors } = useTheme();
  const { t } = useLanguage();

  const { collection } = useCollection(collectionId);
  const { books, loading, error, refresh } = useCollectionBooks(collectionId);

  const isStaticCollection = collection?.type === 'static';

  const handleRemoveBook = useCallback((book: BookWithAuthors) => {
    if (!isStaticCollection) return;

    Alert.alert(
      t('collections.removeFromCollection'),
      t('collections.removeFromCollectionMessage', { book: book.title, collection: collection?.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeBookFromCollection(collectionId, book.id);
              eventEmitter.emit(AppEvents.DATA_CHANGED);
            } catch (e) {
              Alert.alert(t('common.error'), t('collections.removeFromCollectionFailed'));
            }
          },
        },
      ]
    );
  }, [collectionId, collection?.name, isStaticCollection, t]);

  if (loading && books.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>{t('common.loading')}</Text>
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

  const handleBookPress = (bookId: string) => {
    navigation.navigate('BookDetails', { bookId });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={books}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookItem
            book={item}
            onPress={() => handleBookPress(item.id)}
            onLongPress={isStaticCollection ? () => handleRemoveBook(item) : undefined}
            colors={colors}
            t={t}
          />
        )}
        contentContainerStyle={books.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={[styles.emptyText, { color: colors.text }]}>{t('collections.emptyCollection')}</Text>
            <Text style={[styles.emptySubtext, { color: colors.muted }]}>
              {t('collections.emptyCollectionSubtitle')}
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
