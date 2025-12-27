/**
 * Type declarations for @library-manager/shared
 */

declare module '@library-manager/shared' {
  export const SCHEMA_VERSION: number;
  export const SCHEMA_SQL: string;
  export const MIGRATIONS: Record<number, string | null>;

  export const READING_STATUS: {
    WANT_TO_READ: 'want_to_read';
    READING: 'reading';
    FINISHED: 'finished';
    RE_READING: 're_reading';
    ABANDONED: 'abandoned';
    ON_HOLD: 'on_hold';
  };

  export const VALID_READING_STATUSES: string[];

  export const VOCAB_DOMAINS: string[];

  export const STORAGE_ACTIONS: {
    MOVE: 'move';
    LEND: 'lend';
    RETURN: 'return';
  };

  export const COLLECTION_TYPES: {
    STATIC: 'static';
    FILTER: 'filter';
  };
}
