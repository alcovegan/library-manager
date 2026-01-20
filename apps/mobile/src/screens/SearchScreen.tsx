/**
 * Search Screen - search and filter books
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBookFilter, useFilterOptions } from '../hooks/useDatabase';
import { getCoverUri } from '../utils/covers';
import { useTheme, ThemeColors } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { BookWithAuthors, RootStackParamList, ReadingStatus } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Filter state
interface Filters {
  query: string;
  author: string;
  format: string;
  status: string;
  language: string;
  yearFrom: string;
  yearTo: string;
  genres: string;
  tags: string;
}

const EMPTY_FILTERS: Filters = {
  query: '',
  author: '',
  format: '',
  status: '',
  language: '',
  yearFrom: '',
  yearTo: '',
  genres: '',
  tags: '',
};

function getStatusOptions(t: (key: string) => string) {
  return [
    { value: '', label: t('search.allStatuses') },
    { value: 'reading', label: t('search.statusReading') },
    { value: 'finished', label: t('search.statusFinished') },
    { value: 'want_to_read', label: t('search.statusWantToRead') },
    { value: 'on_hold', label: t('search.statusOnHold') },
    { value: 'abandoned', label: t('search.statusAbandoned') },
    { value: 're_reading', label: t('search.statusReReading') },
    { value: 'no_status', label: t('search.statusNoStatus') },
  ];
}

function SearchResultItem({ book, onPress, colors, t }: { book: BookWithAuthors; onPress: () => void; colors: ThemeColors; t: (key: string) => string }) {
  const authorsText = book.authors.map((a) => a.name).join(', ') || t('library.unknownAuthor');
  const coverUri = getCoverUri(book.coverPath);

  return (
    <TouchableOpacity style={[styles.resultItem, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={[styles.bookCover, { backgroundColor: colors.mutedSurface }]} />
      ) : (
        <View style={[styles.bookCoverPlaceholder, { backgroundColor: colors.mutedSurface }]}>
          <Text style={styles.bookCoverPlaceholderText}>📚</Text>
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={[styles.resultAuthors, { color: colors.muted }]} numberOfLines={1}>
          {authorsText}
        </Text>
        {book.year && <Text style={[styles.resultYear, { color: colors.muted }]}>{book.year}</Text>}
      </View>
      {book.rating && (
        <View style={[styles.ratingBadge, { backgroundColor: colors.accentGlow }]}>
          <Text style={[styles.ratingText, { color: colors.accent }]}>★ {book.rating}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  colors,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  colors: ThemeColors;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.modalClose, { color: colors.muted }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  { borderBottomColor: colors.border },
                  selected === option.value && { backgroundColor: colors.accentGlow },
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: colors.text },
                    selected === option.value && { color: colors.accent, fontWeight: '600' },
                  ]}
                >
                  {option.label}
                </Text>
                {selected === option.value && (
                  <Text style={[styles.modalOptionCheck, { color: colors.accent }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [pickerModal, setPickerModal] = useState<{
    visible: boolean;
    type: 'author' | 'format' | 'status' | 'language';
  }>({ visible: false, type: 'author' });

  const { results, loading, error, applyFilters } = useBookFilter();
  const { authors, formats, languages } = useFilterOptions();
  const STATUS_OPTIONS = getStatusOptions(t);

  // Apply filters when they change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      applyFilters({
        query: filters.query || undefined,
        author: filters.author || undefined,
        format: filters.format || undefined,
        status: filters.status || undefined,
        language: filters.language || undefined,
        yearFrom: filters.yearFrom ? parseInt(filters.yearFrom, 10) : undefined,
        yearTo: filters.yearTo ? parseInt(filters.yearTo, 10) : undefined,
        genres: filters.genres ? filters.genres.split(',').map(g => g.trim()).filter(Boolean) : undefined,
        tags: filters.tags ? filters.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      });
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [filters, applyFilters]);

  const handleBookPress = (bookId: string) => {
    navigation.navigate('BookDetails', { bookId });
  };

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  const activeFiltersCount = [
    filters.author,
    filters.format,
    filters.status,
    filters.language,
    filters.yearFrom,
    filters.yearTo,
    filters.genres,
    filters.tags,
  ].filter(Boolean).length;

  const getPickerOptions = () => {
    switch (pickerModal.type) {
      case 'author':
        return [{ value: '', label: t('search.allAuthors') }, ...authors.map(a => ({ value: a, label: a }))];
      case 'format':
        return [{ value: '', label: t('search.allFormats') }, ...formats.map(f => ({ value: f, label: f }))];
      case 'status':
        return STATUS_OPTIONS;
      case 'language':
        return [{ value: '', label: t('search.allLanguages') }, ...languages.map(l => ({ value: l, label: l }))];
      default:
        return [];
    }
  };

  const getPickerTitle = () => {
    switch (pickerModal.type) {
      case 'author': return t('search.author');
      case 'format': return t('search.format');
      case 'status': return t('search.status');
      case 'language': return t('search.language');
    }
  };

  const getPickerValue = () => {
    return filters[pickerModal.type];
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Search bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.mutedSurface, color: colors.text }]}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.muted}
            value={filters.query}
            onChangeText={(text) => updateFilter('query', text)}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: colors.mutedSurface }, showFilters && { backgroundColor: colors.accent }]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Text style={styles.filterButtonText}>
              {activeFiltersCount > 0 ? `⚙️ ${activeFiltersCount}` : '⚙️'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filters panel */}
        {showFilters && (
          <View style={[styles.filtersPanel, { borderTopColor: colors.mutedSurface }]}>
            {/* Dropdown filters row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
              <TouchableOpacity
                style={[styles.filterDropdown, { backgroundColor: colors.mutedSurface }, filters.author && { backgroundColor: colors.accent }]}
                onPress={() => setPickerModal({ visible: true, type: 'author' })}
              >
                <Text style={[styles.filterDropdownText, { color: colors.muted }, filters.author && { color: 'white' }]}>
                  {filters.author || t('search.author')}
                </Text>
                <Text style={[styles.filterDropdownArrow, { color: colors.muted }]}>▼</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterDropdown, { backgroundColor: colors.mutedSurface }, filters.format && { backgroundColor: colors.accent }]}
                onPress={() => setPickerModal({ visible: true, type: 'format' })}
              >
                <Text style={[styles.filterDropdownText, { color: colors.muted }, filters.format && { color: 'white' }]}>
                  {filters.format || t('search.format')}
                </Text>
                <Text style={[styles.filterDropdownArrow, { color: colors.muted }]}>▼</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterDropdown, { backgroundColor: colors.mutedSurface }, filters.status && { backgroundColor: colors.accent }]}
                onPress={() => setPickerModal({ visible: true, type: 'status' })}
              >
                <Text style={[styles.filterDropdownText, { color: colors.muted }, filters.status && { color: 'white' }]}>
                  {STATUS_OPTIONS.find(s => s.value === filters.status)?.label || t('search.status')}
                </Text>
                <Text style={[styles.filterDropdownArrow, { color: colors.muted }]}>▼</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterDropdown, { backgroundColor: colors.mutedSurface }, filters.language && { backgroundColor: colors.accent }]}
                onPress={() => setPickerModal({ visible: true, type: 'language' })}
              >
                <Text style={[styles.filterDropdownText, { color: colors.muted }, filters.language && { color: 'white' }]}>
                  {filters.language || t('search.language')}
                </Text>
                <Text style={[styles.filterDropdownArrow, { color: colors.muted }]}>▼</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Year range */}
            <View style={styles.filterInputRow}>
              <Text style={[styles.filterLabel, { color: colors.muted }]}>{t('search.year')}:</Text>
              <TextInput
                style={[styles.yearInput, { backgroundColor: colors.mutedSurface, color: colors.text }]}
                placeholder={t('search.from')}
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={filters.yearFrom}
                onChangeText={(text) => updateFilter('yearFrom', text)}
              />
              <Text style={[styles.filterDash, { color: colors.muted }]}>—</Text>
              <TextInput
                style={[styles.yearInput, { backgroundColor: colors.mutedSurface, color: colors.text }]}
                placeholder={t('search.to')}
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={filters.yearTo}
                onChangeText={(text) => updateFilter('yearTo', text)}
              />
            </View>

            {/* Genres and tags */}
            <TextInput
              style={[styles.filterTextInput, { backgroundColor: colors.mutedSurface, color: colors.text }]}
              placeholder={t('search.genres')}
              placeholderTextColor={colors.muted}
              value={filters.genres}
              onChangeText={(text) => updateFilter('genres', text)}
            />
            <TextInput
              style={[styles.filterTextInput, { backgroundColor: colors.mutedSurface, color: colors.text }]}
              placeholder={t('search.tags')}
              placeholderTextColor={colors.muted}
              value={filters.tags}
              onChangeText={(text) => updateFilter('tags', text)}
            />

            {/* Reset button */}
            {activeFiltersCount > 0 && (
              <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                <Text style={[styles.resetButtonText, { color: colors.danger }]}>{t('search.resetFilters')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Results count */}
      {(filters.query || activeFiltersCount > 0) && !loading && (
        <View style={[styles.resultsCount, { backgroundColor: colors.bg }]}>
          <Text style={[styles.resultsCountText, { color: colors.muted }]}>
            {t('search.found')}: {results.length}
          </Text>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: colors.dangerGlow }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{t('common.error')}: {error.message}</Text>
        </View>
      )}

      {/* Results list */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SearchResultItem book={item} onPress={() => handleBookPress(item.id)} colors={colors} t={t} />
        )}
        contentContainerStyle={results.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          !loading && (filters.query || activeFiltersCount > 0) ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={[styles.emptyText, { color: colors.text }]}>{t('search.noResultsTitle')}</Text>
              <Text style={[styles.emptySubtext, { color: colors.muted }]}>
                {t('search.noResultsSubtitle')}
              </Text>
            </View>
          ) : !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📖</Text>
              <Text style={[styles.emptyText, { color: colors.text }]}>{t('search.emptyTitle')}</Text>
              <Text style={[styles.emptySubtext, { color: colors.muted }]}>
                {t('search.emptySubtitle')}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Picker modal */}
      <PickerModal
        visible={pickerModal.visible}
        title={getPickerTitle()}
        options={getPickerOptions()}
        selected={getPickerValue()}
        onSelect={(value) => updateFilter(pickerModal.type, value)}
        onClose={() => setPickerModal({ ...pickerModal, visible: false })}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1c1c1e',
  },
  filterButton: {
    width: 50,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 16,
  },
  filtersPanel: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  filtersRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  filterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterDropdownActive: {
    backgroundColor: '#007AFF',
  },
  filterDropdownText: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  filterDropdownTextActive: {
    color: 'white',
  },
  filterDropdownArrow: {
    fontSize: 10,
    color: '#999',
  },
  filterInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  yearInput: {
    width: 70,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1c1c1e',
    textAlign: 'center',
  },
  filterDash: {
    marginHorizontal: 8,
    color: '#666',
  },
  filterTextInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1c1c1e',
    marginBottom: 10,
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resetButtonText: {
    fontSize: 14,
    color: '#ff3b30',
  },
  resultsCount: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  resultsCountText: {
    fontSize: 13,
    color: '#666',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  resultItem: {
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
    width: 50,
    height: 75,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  bookCoverPlaceholder: {
    width: 50,
    height: 75,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookCoverPlaceholderText: {
    fontSize: 20,
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  resultAuthors: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  resultYear: {
    fontSize: 12,
    color: '#999',
  },
  ratingBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginLeft: 8,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  modalClose: {
    fontSize: 20,
    color: '#999',
    padding: 4,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  modalOptionSelected: {
    backgroundColor: '#f0f8ff',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1c1c1e',
  },
  modalOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  modalOptionCheck: {
    fontSize: 18,
    color: '#007AFF',
  },
});
