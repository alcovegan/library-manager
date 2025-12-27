/**
 * React hooks for database operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getAllBooks,
  getBookById,
  searchBooks,
  filterBooks,
  getBooksCount,
  getDatabase,
  getAuthors,
  getFormats,
  getLanguages,
  type BookFilters,
} from '../services/database';
import { subscribe, AppEvents } from '../services/events';
import type { BookWithAuthors } from '../types';

/**
 * Hook to get all books
 */
export function useBooks() {
  const [books, setBooks] = useState<BookWithAuthors[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllBooks();
      setBooks(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load books'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Subscribe to data changes (e.g., after sync)
    const unsubscribe = subscribe(AppEvents.DATA_CHANGED, () => {
      console.log('[useBooks] Data changed, refreshing...');
      refresh();
    });

    return unsubscribe;
  }, [refresh]);

  return { books, loading, error, refresh };
}

/**
 * Hook to get a single book by ID
 */
export function useBook(bookId: string | null) {
  const [book, setBook] = useState<BookWithAuthors | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!bookId) {
      setBook(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getBookById(bookId);
      setBook(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load book'));
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { book, loading, error, refresh };
}

/**
 * Hook for searching books
 */
export function useBookSearch() {
  const [results, setResults] = useState<BookWithAuthors[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await searchBooks(query);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Search failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { results, loading, error, search, clear };
}

/**
 * Hook for filtering books with all options
 */
export function useBookFilter() {
  const [results, setResults] = useState<BookWithAuthors[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const filtersRef = useRef<BookFilters>({});

  const applyFilters = useCallback(async (filters: BookFilters) => {
    filtersRef.current = filters;
    try {
      setLoading(true);
      setError(null);
      const data = await filterBooks(filters);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Filter failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await applyFilters(filtersRef.current);
  }, [applyFilters]);

  // Subscribe to data changes
  useEffect(() => {
    const unsubscribe = subscribe(AppEvents.DATA_CHANGED, refresh);
    return unsubscribe;
  }, [refresh]);

  const clear = useCallback(() => {
    filtersRef.current = {};
    setResults([]);
    setError(null);
  }, []);

  return { results, loading, error, applyFilters, clear, refresh };
}

/**
 * Hook to get filter options (authors, formats, languages)
 */
export function useFilterOptions() {
  const [authors, setAuthors] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [authorsData, formatsData, languagesData] = await Promise.all([
        getAuthors(),
        getFormats(),
        getLanguages(),
      ]);
      setAuthors(authorsData);
      setFormats(formatsData);
      setLanguages(languagesData);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(AppEvents.DATA_CHANGED, refresh);
    return unsubscribe;
  }, [refresh]);

  return { authors, formats, languages, loading };
}

/**
 * Hook to get books count
 */
export function useBooksCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const newCount = await getBooksCount();
    setCount(newCount);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    // Subscribe to data changes
    const unsubscribe = subscribe(AppEvents.DATA_CHANGED, refresh);
    return unsubscribe;
  }, [refresh]);

  return { count, loading };
}

/**
 * Hook to initialize database
 */
export function useDatabaseInit() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        console.log('[Hook] Starting database initialization...');
        await getDatabase();
        if (mounted) {
          console.log('[Hook] Database ready');
          setReady(true);
        }
      } catch (err) {
        console.error('[Hook] Database init error:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Database init failed'));
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  return { ready, error };
}
