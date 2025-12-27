/**
 * Application State Management
 * Centralized state factory for the library manager
 */

(function(global) {
  'use strict';

  /**
   * Create initial application state
   * @returns {Object} Complete application state
   */
  function createState() {
    return {
      // Library state - main book management
      library: {
        books: [],
        visibleBooks: [],
        searchActive: false,
        editId: null,
        coverSourcePath: null,
        storageLocationId: null,
        selectedId: null,
        currentStaticCollection: null,
        bulkMode: false,
        bulkSelectedIds: new Set(),
        bulkBusy: false,
        customVocabulary: {
          authors: [],
          series: [],
          publisher: [],
          genres: [],
          tags: [],
        },
      },

      // Modal state - edit/create book dialog
      modal: {
        id: null,
        coverSourcePath: null,
        titleAlt: null,
        authorsAlt: [],
        snapshot: null,
        storageLocationId: null,
        goodreads: null,
        originalTitleEn: null,
        originalAuthorsEn: [],
        goodreadsFetchedAt: null,
      },

      // Settings state
      settings: {
        snapshot: null,
      },

      // Activity state - history/log tracking
      activity: {
        items: [],
        nextCursor: null,
        loading: false,
        initialized: false,
        filters: { category: 'all', search: '' },
        needsRefresh: true,
        pendingReload: false,
      },

      // CSV Import state
      csvImport: {
        headers: [],
        rows: [],
        mapping: {
          title: '',
          authors: '',
          isbn: '',
          publisher: '',
          year: '',
          language: '',
          series: '',
          seriesIndex: '',
          format: '',
          genres: '',
          tags: '',
          rating: '',
          notes: '',
          cover: '',
        },
        fileName: '',
      },

      // Enrichment state - batch ISBN/Goodreads enrichment
      enrich: {
        headers: [],
        rows: [],
        mapping: { title: null, authors: null, publisher: null, year: null },
        running: false,
        cursor: 0,
        ignoreCache: false,
      },

      // Cover search state
      coverSearch: {
        context: null,
        results: [],
        loading: false,
        query: '',
        source: null,
        escapeHandler: null,
      },

      // Storage locations state
      storage: {
        locations: [],
        loading: false,
      },

      // Collections state
      collections: {
        items: [],
        loading: false,
        byId: new Map(),
        byName: new Map(),
      },

      // Filter presets state
      filterPresets: {
        items: [],
        loading: false,
        byId: new Map(),
        last: null,
      },
    };
  }

  /**
   * Get empty custom vocabulary structure
   * @returns {Object} Empty vocabulary object
   */
  function getEmptyCustomVocabulary() {
    return {
      authors: [],
      series: [],
      publisher: [],
      genres: [],
      tags: [],
    };
  }

  // Export for Node.js (tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      createState,
      getEmptyCustomVocabulary,
    };
  }

  // Make available globally in browser
  if (typeof window !== 'undefined') {
    window.AppState = {
      create: createState,
      getEmptyCustomVocabulary,
    };
  }

})(typeof window !== 'undefined' ? window : global);
