import { describe, it, expect } from 'vitest';

/**
 * Collections and Filter Presets tests
 * Tests for collections state management
 */

describe('Collections', () => {
  describe('rebuildCollectionsState', () => {
    function rebuildCollectionsState(list = []) {
      const collectionsState = {
        list: [],
        byId: new Map(),
        byName: new Map(),
      };

      collectionsState.list = Array.isArray(list)
        ? list.map((collection) => ({
            ...collection,
            books: Array.isArray(collection.books) ? collection.books : [],
            filters: collection.type === 'filter' ? (collection.filters || {}) : null,
          }))
        : [];

      collectionsState.list.forEach((collection) => {
        collectionsState.byId.set(collection.id, collection);
        collectionsState.byName.set(collection.name, collection);
      });

      return collectionsState;
    }

    it('should create empty state from empty list', () => {
      const state = rebuildCollectionsState([]);

      expect(state.list).toEqual([]);
      expect(state.byId.size).toBe(0);
      expect(state.byName.size).toBe(0);
    });

    it('should normalize single collection', () => {
      const collections = [
        {
          id: 'col-1',
          name: 'Favorites',
          type: 'manual',
          books: ['book-1', 'book-2'],
        },
      ];

      const state = rebuildCollectionsState(collections);

      expect(state.list).toHaveLength(1);
      expect(state.list[0]).toEqual({
        id: 'col-1',
        name: 'Favorites',
        type: 'manual',
        books: ['book-1', 'book-2'],
        filters: null,
      });
    });

    it('should build byId index correctly', () => {
      const collections = [
        { id: 'col-1', name: 'Collection 1', type: 'manual', books: [] },
        { id: 'col-2', name: 'Collection 2', type: 'manual', books: [] },
      ];

      const state = rebuildCollectionsState(collections);

      expect(state.byId.get('col-1').name).toBe('Collection 1');
      expect(state.byId.get('col-2').name).toBe('Collection 2');
      expect(state.byId.get('col-3')).toBeUndefined();
    });

    it('should build byName index correctly', () => {
      const collections = [
        { id: 'col-1', name: 'Favorites', type: 'manual', books: [] },
        { id: 'col-2', name: 'To Read', type: 'manual', books: [] },
      ];

      const state = rebuildCollectionsState(collections);

      expect(state.byName.get('Favorites').id).toBe('col-1');
      expect(state.byName.get('To Read').id).toBe('col-2');
      expect(state.byName.get('NonExistent')).toBeUndefined();
    });

    it('should handle missing books array', () => {
      const collections = [
        { id: 'col-1', name: 'Collection', type: 'manual' },
      ];

      const state = rebuildCollectionsState(collections);

      expect(state.list[0].books).toEqual([]);
    });

    it('should set filters for filter-type collections', () => {
      const collections = [
        {
          id: 'col-1',
          name: 'Fantasy Books',
          type: 'filter',
          filters: { genres: ['Fantasy'] },
        },
      ];

      const state = rebuildCollectionsState(collections);

      expect(state.list[0].filters).toEqual({ genres: ['Fantasy'] });
    });

    it('should set filters to null for non-filter collections', () => {
      const collections = [
        {
          id: 'col-1',
          name: 'Manual Collection',
          type: 'manual',
          books: [],
        },
      ];

      const state = rebuildCollectionsState(collections);

      expect(state.list[0].filters).toBeNull();
    });

    it('should handle empty filters for filter collections', () => {
      const collections = [
        {
          id: 'col-1',
          name: 'Filter Collection',
          type: 'filter',
        },
      ];

      const state = rebuildCollectionsState(collections);

      expect(state.list[0].filters).toEqual({});
    });

    it('should handle multiple collections with same name', () => {
      // Note: This is technically invalid data, but we should handle it
      const collections = [
        { id: 'col-1', name: 'Favorites', type: 'manual', books: [] },
        { id: 'col-2', name: 'Favorites', type: 'manual', books: [] },
      ];

      const state = rebuildCollectionsState(collections);

      // The last one should win in byName index
      expect(state.byName.get('Favorites').id).toBe('col-2');
      expect(state.list).toHaveLength(2);
    });
  });

  describe('Filter Presets', () => {
    function rebuildFilterPresetsState(list = []) {
      const filterPresetsState = {
        list: [],
        byId: new Map(),
        last: null,
      };

      list.forEach((preset) => {
        const normalized = {
          ...preset,
          filters: (() => {
            if (preset && typeof preset.filters === 'object' && preset.filters !== null) {
              return { ...preset.filters };
            }
            return {};
          })(),
        };

        filterPresetsState.list.push(normalized);
        filterPresetsState.byId.set(normalized.id, normalized);

        if (preset.slug === 'last-used-filter') {
          filterPresetsState.last = normalized;
        }
      });

      return filterPresetsState;
    }

    it('should create empty state from empty list', () => {
      const state = rebuildFilterPresetsState([]);

      expect(state.list).toEqual([]);
      expect(state.byId.size).toBe(0);
      expect(state.last).toBeNull();
    });

    it('should normalize filter preset', () => {
      const presets = [
        {
          id: 'preset-1',
          name: 'My Filters',
          slug: 'my-filters',
          filters: { rating: { gte: 4 } },
        },
      ];

      const state = rebuildFilterPresetsState(presets);

      expect(state.list).toHaveLength(1);
      expect(state.list[0].filters).toEqual({ rating: { gte: 4 } });
    });

    it('should handle missing filters', () => {
      const presets = [
        {
          id: 'preset-1',
          name: 'Empty Preset',
          slug: 'empty',
        },
      ];

      const state = rebuildFilterPresetsState(presets);

      expect(state.list[0].filters).toEqual({});
    });

    it('should identify last-used-filter', () => {
      const presets = [
        { id: 'preset-1', name: 'Preset 1', slug: 'preset-1', filters: {} },
        { id: 'last', name: 'Last Used', slug: 'last-used-filter', filters: { year: 2020 } },
        { id: 'preset-2', name: 'Preset 2', slug: 'preset-2', filters: {} },
      ];

      const state = rebuildFilterPresetsState(presets);

      expect(state.last).toBeDefined();
      expect(state.last.id).toBe('last');
      expect(state.last.filters).toEqual({ year: 2020 });
    });

    it('should build byId index', () => {
      const presets = [
        { id: 'preset-1', name: 'Preset 1', slug: 'p1', filters: {} },
        { id: 'preset-2', name: 'Preset 2', slug: 'p2', filters: {} },
      ];

      const state = rebuildFilterPresetsState(presets);

      expect(state.byId.get('preset-1').name).toBe('Preset 1');
      expect(state.byId.get('preset-2').name).toBe('Preset 2');
    });

    it('should handle complex filter structures', () => {
      const presets = [
        {
          id: 'preset-1',
          name: 'Complex',
          slug: 'complex',
          filters: {
            genres: ['Fantasy', 'Sci-Fi'],
            rating: { gte: 4, lte: 5 },
            year: { gte: 2020 },
            authors: ['Brandon Sanderson'],
          },
        },
      ];

      const state = rebuildFilterPresetsState(presets);

      expect(state.list[0].filters).toEqual({
        genres: ['Fantasy', 'Sci-Fi'],
        rating: { gte: 4, lte: 5 },
        year: { gte: 2020 },
        authors: ['Brandon Sanderson'],
      });
    });

    it('should create shallow copy of filters object', () => {
      const original = { rating: { gte: 4 } };
      const presets = [
        {
          id: 'preset-1',
          name: 'Test',
          slug: 'test',
          filters: original,
        },
      ];

      const state = rebuildFilterPresetsState(presets);

      // Shallow copy means the filters object itself is different
      expect(state.list[0].filters).not.toBe(original);
      expect(state.list[0].filters).toEqual(original);

      // But nested objects/arrays are still shared (shallow copy limitation)
      // This is expected behavior with { ...filters }
      expect(state.list[0].filters.rating).toBe(original.rating);
    });
  });
});

