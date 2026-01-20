/**
 * Library Screen - displays list of all books
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  PanResponder,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBooks, useDatabaseInit } from '../hooks/useDatabase';
import { toggleBookPin } from '../services/database';
import { getCoverUri } from '../utils/covers';
import { AppEvents, eventEmitter } from '../services/events';
import { useTheme, ThemeColors } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { BookWithAuthors, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function BookItemContent({ book, onPress, colors, t }: { book: BookWithAuthors; onPress: () => void; colors: ThemeColors; t: (key: string) => string }) {
  const authorsText = book.authors.map((a) => a.name).join(', ') || t('library.unknownAuthor');
  const coverUri = getCoverUri(book.coverPath);
  const isPinned = book.isPinned === 1;

  return (
    <TouchableOpacity
      style={[styles.bookItem, { backgroundColor: colors.surface, borderColor: isPinned ? colors.accent : colors.border }]}
      onPress={onPress}
    >
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={[styles.bookCover, { backgroundColor: colors.mutedSurface }]} />
      ) : (
        <View style={[styles.bookCoverPlaceholder, { backgroundColor: colors.mutedSurface }]}>
          <Text style={styles.bookCoverPlaceholderText}>📚</Text>
        </View>
      )}
      <View style={styles.bookInfo}>
        {isPinned && (
          <View style={[styles.pinnedBadge, { backgroundColor: colors.accentGlow }]}>
            <Text style={[styles.pinnedBadgeText, { color: colors.accent }]}>📌 {t('library.pinned')}</Text>
          </View>
        )}
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

function SwipeableBookItem({
  book,
  onPress,
  onPin,
  colors,
  t,
}: {
  book: BookWithAuthors;
  onPress: () => void;
  onPin: () => void;
  colors: ThemeColors;
  t: (key: string) => string;
}) {
  const isPinned = book.isPinned === 1;
  const translateX = useRef(new Animated.Value(0)).current;
  const isSwipedOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderMove: (_, gestureState) => {
        // Allow swipe left (negative dx) to reveal action
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -80));
        } else if (isSwipedOpen.current) {
          // Allow swipe right to close
          translateX.setValue(Math.min(gestureState.dx - 80, 0));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -40) {
          // Open swipe action
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
          }).start();
          isSwipedOpen.current = true;
        } else {
          // Close swipe action
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          isSwipedOpen.current = false;
        }
      },
    })
  ).current;

  const handlePinPress = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
    isSwipedOpen.current = false;
    onPin();
  };

  // Animate button opacity based on swipe progress
  const actionOpacity = translateX.interpolate({
    inputRange: [-80, -20, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  // Animate button scale for nice effect
  const actionScale = translateX.interpolate({
    inputRange: [-80, -40, 0],
    outputRange: [1, 0.8, 0.5],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeContainer}>
      {/* Background action - animated */}
      <Animated.View
        style={[
          styles.swipeActionBg,
          {
            backgroundColor: isPinned ? colors.muted : colors.accent,
            opacity: actionOpacity,
            transform: [{ scale: actionScale }],
          }
        ]}
      >
        <TouchableOpacity style={styles.pinButtonInner} onPress={handlePinPress}>
          <Text style={styles.pinButtonIcon}>📌</Text>
          <Text style={styles.pinButtonText}>{isPinned ? t('library.unpin') : t('library.pin')}</Text>
        </TouchableOpacity>
      </Animated.View>
      {/* Foreground card */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <BookItemContent book={book} onPress={onPress} colors={colors} t={t} />
      </Animated.View>
    </View>
  );
}

export default function LibraryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { ready, error: dbError } = useDatabaseInit();
  const { books, loading, error, refresh } = useBooks();
  const { colors } = useTheme();
  const { t } = useLanguage();

  // All hooks must be called before any conditional returns
  const handlePinBook = useCallback(async (bookId: string) => {
    try {
      await toggleBookPin(bookId);
      eventEmitter.emit(AppEvents.DATA_CHANGED);
    } catch (e) {
      console.error('Failed to toggle pin:', e);
    }
  }, []);

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetails', { bookId });
  }, [navigation]);

  if (!ready) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>{t('library.initializingDb')}</Text>
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
        data={books}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableBookItem
            book={item}
            onPress={() => handleBookPress(item.id)}
            onPin={() => handlePinBook(item.id)}
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
            <Text style={[styles.emptyText, { color: colors.text }]}>{t('library.emptyTitle')}</Text>
            <Text style={[styles.emptySubtext, { color: colors.muted }]}>
              {t('library.emptySubtitle')}
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
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  bookCover: {
    width: 60,
    height: 90,
    borderRadius: 6,
    marginRight: 12,
  },
  bookCoverPlaceholder: {
    width: 60,
    height: 90,
    borderRadius: 6,
    marginRight: 12,
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
    marginBottom: 4,
  },
  bookAuthors: {
    fontSize: 14,
    marginBottom: 4,
  },
  bookYear: {
    fontSize: 12,
  },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pinnedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  pinnedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  swipeContainer: {
    position: 'relative',
    marginBottom: 12,
    overflow: 'hidden',
    borderRadius: 12,
  },
  swipeActionBg: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  pinButtonIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  pinButtonText: {
    color: 'white',
    fontSize: 11,
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
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
