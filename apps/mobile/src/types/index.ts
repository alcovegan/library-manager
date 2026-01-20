/**
 * Type definitions for Library Manager Mobile
 */

export interface Book {
  id: string;
  title: string;
  coverPath: string | null;
  createdAt: string;
  updatedAt: string;
  series: string | null;
  seriesIndex: number | null;
  year: number | null;
  publisher: string | null;
  isbn: string | null;
  language: string | null;
  rating: number | null;
  notes: string | null;
  tags: string | null;
  titleAlt: string | null;
  authorsAlt: string | null;
  format: string | null;
  genres: string | null;
  storageLocationId: string | null;
  goodreadsRating: number | null;
  goodreadsRatingsCount: number | null;
  goodreadsReviewsCount: number | null;
  goodreadsUrl: string | null;
  originalTitleEn: string | null;
  originalAuthorsEn: string | null;
  goodreadsFetchedAt: string | null;
  currentReadingSessionId: string | null;
  isPinned: number;
  pinnedAt: string | null;
}

export interface Author {
  id: string;
  name: string;
}

export interface BookWithAuthors extends Book {
  authors: Author[];
}

export interface ReadingSession {
  id: string;
  bookId: string;
  status: ReadingStatus;
  startedAt: string | null;
  finishedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReadingStatus =
  | 'want_to_read'
  | 'reading'
  | 'finished'
  | 're_reading'
  | 'abandoned'
  | 'on_hold';

export interface StorageLocation {
  id: string;
  code: string;
  title: string | null;
  note: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  name: string;
  type: 'static' | 'filter';
  filters: string | null;
  created_at: string;
  updated_at: string;
}

export type RootStackParamList = {
  Main: undefined;
  BookDetails: { bookId: string };
  CollectionDetails: { collectionId: string };
  AddBook: undefined;
  EditBook: { bookId: string };
  SyncSettings: undefined;
};

export type MainTabParamList = {
  Library: undefined;
  Search: undefined;
  Collections: undefined;
  Settings: undefined;
};
