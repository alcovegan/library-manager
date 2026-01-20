/**
 * Book Edit Screen - edit book details
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useBook } from '../hooks/useDatabase';
import { updateBook } from '../services/database';
import { AppEvents, eventEmitter } from '../services/events';
import { useTheme } from '../contexts/ThemeContext';
import { useOffline } from '../contexts/OfflineContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditBook'>;

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function RatingSelector({
  value,
  onChange,
  colors,
  t,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  t: (key: string) => string;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{t('bookDetails.rating')}</Text>
      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(value === star ? null : star)}
            style={styles.starButton}
          >
            <Text style={[styles.starText, { color: colors.border }, value !== null && value >= star && { color: colors.accent }]}>
              {value !== null && value >= star ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        ))}
        {value && (
          <TouchableOpacity onPress={() => onChange(null)} style={styles.clearRating}>
            <Text style={[styles.clearRatingText, { color: colors.accent }]}>{t('bookDetails.resetRating')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function BookEditScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const { book, loading, error } = useBook(bookId);
  const { colors } = useTheme();
  const { isOffline } = useOffline();
  const { t } = useLanguage();

  // Redirect back if offline
  useEffect(() => {
    if (isOffline) {
      Alert.alert(
        t('offline.banner'),
        t('offline.editingUnavailable'),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      );
    }
  }, [isOffline, navigation, t]);

  // Form state
  const [title, setTitle] = useState('');
  const [titleAlt, setTitleAlt] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [publisher, setPublisher] = useState('');
  const [isbn, setIsbn] = useState('');
  const [language, setLanguage] = useState('');
  const [format, setFormat] = useState('');
  const [series, setSeries] = useState('');
  const [seriesIndex, setSeriesIndex] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [genres, setGenres] = useState('');

  const [saving, setSaving] = useState(false);

  // Initialize form with book data
  useEffect(() => {
    if (book) {
      setTitle(book.title || '');
      setTitleAlt(book.titleAlt || '');
      setAuthors(book.authors.map((a) => a.name).join(', '));
      setYear(book.year?.toString() || '');
      setPublisher(book.publisher || '');
      setIsbn(book.isbn || '');
      setLanguage(book.language || '');
      setFormat(book.format || '');
      setSeries(book.series || '');
      setSeriesIndex(book.seriesIndex?.toString() || '');
      setRating(book.rating);
      setNotes(book.notes || '');
      try {
        setTags(book.tags ? JSON.parse(book.tags).join(', ') : '');
        setGenres(book.genres ? JSON.parse(book.genres).join(', ') : '');
      } catch {
        setTags(book.tags || '');
        setGenres(book.genres || '');
      }
    }
  }, [book]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('bookDetails.titleRequired'));
      return;
    }

    setSaving(true);
    try {
      // Parse tags and genres back to JSON arrays
      const tagsArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag);
      const genresArray = genres
        .split(',')
        .map((g) => g.trim())
        .filter((g) => g);

      // Parse authors
      const authorsArray = authors
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a);

      await updateBook(bookId, {
        title: title.trim(),
        titleAlt: titleAlt.trim() || null,
        year: year ? parseInt(year, 10) : null,
        publisher: publisher.trim() || null,
        isbn: isbn.trim() || null,
        language: language.trim() || null,
        format: format.trim() || null,
        series: series.trim() || null,
        seriesIndex: seriesIndex ? parseInt(seriesIndex, 10) : null,
        rating,
        notes: notes.trim() || null,
        tags: tagsArray.length > 0 ? JSON.stringify(tagsArray) : null,
        genres: genresArray.length > 0 ? JSON.stringify(genresArray) : null,
        authors: authorsArray,
      });

      eventEmitter.emit(AppEvents.DATA_CHANGED);
      navigation.goBack();
    } catch (e) {
      console.error('Failed to save book:', e);
      Alert.alert(t('common.error'), t('bookDetails.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [
    bookId,
    title,
    titleAlt,
    authors,
    year,
    publisher,
    isbn,
    language,
    format,
    series,
    seriesIndex,
    rating,
    notes,
    tags,
    genres,
    navigation,
    t,
  ]);

  // Set up header save button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.headerButton}>
          {saving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.headerButtonText}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleSave, saving, t]);

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
        <Text style={[styles.errorText, { color: colors.danger }]}>{error?.message || t('bookDetails.bookNotFound')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <FormField
          label={t('bookDetails.titleLabel')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('bookDetails.titlePlaceholder')}
          colors={colors}
        />

        <FormField
          label={t('bookDetails.titleAltLabel')}
          value={titleAlt}
          onChangeText={setTitleAlt}
          placeholder={t('bookDetails.titleAltPlaceholder')}
          colors={colors}
        />

        <FormField
          label={t('bookDetails.authorsLabel')}
          value={authors}
          onChangeText={setAuthors}
          placeholder={t('bookDetails.authorsPlaceholder')}
          colors={colors}
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <FormField
              label={t('bookDetails.year')}
              value={year}
              onChangeText={setYear}
              placeholder={t('bookDetails.yearPlaceholder')}
              keyboardType="numeric"
              colors={colors}
            />
          </View>
          <View style={styles.halfField}>
            <FormField
              label={t('bookDetails.language')}
              value={language}
              onChangeText={setLanguage}
              placeholder={t('bookDetails.languagePlaceholder')}
              colors={colors}
            />
          </View>
        </View>

        <RatingSelector value={rating} onChange={setRating} colors={colors} t={t} />

        <FormField
          label={t('bookDetails.series')}
          value={series}
          onChangeText={setSeries}
          placeholder={t('bookDetails.seriesPlaceholder')}
          colors={colors}
        />

        <FormField
          label={t('bookDetails.seriesIndex')}
          value={seriesIndex}
          onChangeText={setSeriesIndex}
          placeholder={t('bookDetails.seriesIndexPlaceholder')}
          keyboardType="numeric"
          colors={colors}
        />

        <FormField
          label={t('bookDetails.publisher')}
          value={publisher}
          onChangeText={setPublisher}
          placeholder={t('bookDetails.publisherPlaceholder')}
          colors={colors}
        />

        <FormField
          label={t('bookDetails.isbn')}
          value={isbn}
          onChangeText={setIsbn}
          placeholder={t('bookDetails.isbnPlaceholder')}
          colors={colors}
        />

        <FormField
          label={t('bookDetails.format')}
          value={format}
          onChangeText={setFormat}
          placeholder={t('bookDetails.formatPlaceholder')}
          colors={colors}
        />

        <FormField
          label={t('bookDetails.genres')}
          value={genres}
          onChangeText={setGenres}
          placeholder={t('bookDetails.genresPlaceholder')}
          colors={colors}
        />

        <FormField
          label={t('bookDetails.tags')}
          value={tags}
          onChangeText={setTags}
          placeholder={t('bookDetails.tagsPlaceholder')}
          colors={colors}
        />

        <FormField
          label={t('bookDetails.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('bookDetails.notesPlaceholder')}
          multiline
          colors={colors}
        />

        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
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
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  fieldInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -8,
  },
  halfField: {
    flex: 1,
    paddingHorizontal: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    padding: 4,
  },
  starText: {
    fontSize: 32,
    color: '#ccc',
  },
  starActive: {
    color: '#ffc107',
  },
  clearRating: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearRatingText: {
    fontSize: 14,
    color: '#007AFF',
  },
  bottomPadding: {
    height: 40,
  },
});
