/**
 * Reading status constants
 */
const READING_STATUS = {
  WANT_TO_READ: 'want_to_read',
  READING: 'reading',
  FINISHED: 'finished',
  RE_READING: 're_reading',
  ABANDONED: 'abandoned',
  ON_HOLD: 'on_hold',
};

const VALID_READING_STATUSES = Object.values(READING_STATUS);

/**
 * Vocabulary domains
 */
const VOCAB_DOMAINS = ['authors', 'series', 'publisher', 'genres', 'tags'];

/**
 * Storage action types
 */
const STORAGE_ACTIONS = {
  MOVE: 'move',
  LEND: 'lend',
  RETURN: 'return',
};

/**
 * Collection types
 */
const COLLECTION_TYPES = {
  STATIC: 'static',
  FILTER: 'filter',
};

module.exports = {
  READING_STATUS,
  VALID_READING_STATUSES,
  VOCAB_DOMAINS,
  STORAGE_ACTIONS,
  COLLECTION_TYPES,
};
