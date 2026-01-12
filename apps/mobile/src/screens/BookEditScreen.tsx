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
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditBook'>;

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function RatingSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>Рейтинг</Text>
      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(value === star ? null : star)}
            style={styles.starButton}
          >
            <Text style={[styles.starText, value !== null && value >= star && styles.starActive]}>
              {value !== null && value >= star ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        ))}
        {value && (
          <TouchableOpacity onPress={() => onChange(null)} style={styles.clearRating}>
            <Text style={styles.clearRatingText}>Сбросить</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function BookEditScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const { book, loading, error } = useBook(bookId);

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
      Alert.alert('Ошибка', 'Название книги обязательно');
      return;
    }

    setSaving(true);
    try {
      // Parse tags and genres back to JSON arrays
      const tagsArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);
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
      Alert.alert('Ошибка', 'Не удалось сохранить изменения');
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
  ]);

  // Set up header save button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.headerButton}>
          {saving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.headerButtonText}>Сохранить</Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleSave, saving]);

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
        <Text style={styles.errorText}>{error?.message || 'Книга не найдена'}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <FormField
          label="Название *"
          value={title}
          onChangeText={setTitle}
          placeholder="Название книги"
        />

        <FormField
          label="Альтернативное название"
          value={titleAlt}
          onChangeText={setTitleAlt}
          placeholder="Оригинальное название"
        />

        <FormField
          label="Авторы"
          value={authors}
          onChangeText={setAuthors}
          placeholder="Автор 1, Автор 2"
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <FormField
              label="Год"
              value={year}
              onChangeText={setYear}
              placeholder="2024"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfField}>
            <FormField
              label="Язык"
              value={language}
              onChangeText={setLanguage}
              placeholder="ru"
            />
          </View>
        </View>

        <RatingSelector value={rating} onChange={setRating} />

        <FormField
          label="Серия"
          value={series}
          onChangeText={setSeries}
          placeholder="Название серии"
        />

        <FormField
          label="Номер в серии"
          value={seriesIndex}
          onChangeText={setSeriesIndex}
          placeholder="1"
          keyboardType="numeric"
        />

        <FormField
          label="Издательство"
          value={publisher}
          onChangeText={setPublisher}
          placeholder="Название издательства"
        />

        <FormField
          label="ISBN"
          value={isbn}
          onChangeText={setIsbn}
          placeholder="978-..."
        />

        <FormField
          label="Формат"
          value={format}
          onChangeText={setFormat}
          placeholder="epub, fb2, бумажная..."
        />

        <FormField
          label="Жанры"
          value={genres}
          onChangeText={setGenres}
          placeholder="Фантастика, Детектив"
        />

        <FormField
          label="Теги"
          value={tags}
          onChangeText={setTags}
          placeholder="тег1, тег2"
        />

        <FormField
          label="Заметки"
          value={notes}
          onChangeText={setNotes}
          placeholder="Ваши заметки о книге..."
          multiline
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
