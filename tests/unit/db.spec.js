import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, dbLayer } from '../helpers/db.js';

let ctx;
let cleanup;

describe('db layer — книги и словари', () => {
  beforeEach(async () => {
    const result = await createTestContext();
    ctx = result.ctx;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    if (cleanup) cleanup();
  });

  function createSampleBook(overrides = {}) {
    const base = {
      title: 'Тестовая книга',
      authors: ['Автор Один'],
      tags: ['тег-1'],
      genres: ['жанр-1'],
      series: 'Серия A',
      publisher: 'Издательство A',
      rating: 4.5,
      goodreadsRating: 4.5,
      goodreadsFetchedAt: '2024-01-01T00:00:00.000Z',
    };
    return dbLayer.createBook(ctx, { ...base, ...overrides });
  }

  it('создаёт книгу с авторами, тегами и жанрами', () => {
    const created = createSampleBook({ tags: ['тег-1', 'тег-2'], genres: ['жанр-1'] });
    expect(created.id).toBeTruthy();

    const stored = dbLayer.getBookById(ctx, created.id);
    expect(stored.title).toBe('Тестовая книга');
    expect(stored.authors).toEqual(['Автор Один']);
    expect(stored.tags).toEqual(['тег-1', 'тег-2']);
    expect(stored.genres).toEqual(['жанр-1']);
    expect(stored.goodreadsRating).toBeCloseTo(4.5);
    expect(stored.goodreadsFetchedAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('обновляет авторов и массивы', () => {
    const created = createSampleBook({ tags: ['тег-старый'], genres: ['жанр-старый'] });
    const originalUpdatedAt = dbLayer.getBookById(ctx, created.id).updatedAt;

    const updated = dbLayer.updateBook(ctx, {
      id: created.id,
      title: created.title,
      authors: ['Автор Новый'],
      tags: ['тег-новый'],
      genres: ['жанр-новый'],
      series: 'Серия B',
      publisher: 'Издательство B',
      rating: 4.8,
      goodreadsRating: 4.8,
      goodreadsFetchedAt: '2024-02-01T00:00:00.000Z',
    });

    expect(updated.authors).toEqual(['Автор Новый']);

    const stored = dbLayer.getBookById(ctx, created.id);
    expect(stored.authors).toEqual(['Автор Новый']);
    expect(stored.tags).toEqual(['тег-новый']);
    expect(stored.genres).toEqual(['жанр-новый']);
    expect(new Date(stored.updatedAt).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());
  });

  it('переименовывает словарь авторов и обновляет книги', () => {
    const created = createSampleBook();
    const before = dbLayer.getBookById(ctx, created.id);

    const result = dbLayer.renameVocabularyValue(ctx, 'authors', 'Автор Один', 'Автор Два');
    expect(result.affected).toBe(1);

    const after = dbLayer.getBookById(ctx, created.id);
    expect(after.authors).toEqual(['Автор Два']);
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(new Date(before.updatedAt).getTime());

    const vocab = dbLayer.listVocabulary(ctx);
    const authorEntry = vocab.authors.find((entry) => entry.value === 'Автор Два');
    expect(authorEntry?.count).toBe(1);
    const oldEntry = vocab.authors.find((entry) => entry.value === 'Автор Один');
    expect(oldEntry).toBeUndefined();
  });

  it('агрегирует значения словаря и учитывает пользовательские записи', () => {
    createSampleBook({ tags: ['тег-A', 'тег-B'], genres: ['жанр-A'] });
    dbLayer.addCustomVocabularyEntry(ctx, 'tags', 'пользовательский');

    const vocab = dbLayer.listVocabulary(ctx);

    const tagA = vocab.tags.find((entry) => entry.value === 'тег-A');
    expect(tagA?.count).toBe(1);
    expect(tagA?.sources?.books).toBe(true);
    expect(tagA?.sources?.custom).toBe(false);

    const customTag = vocab.tags.find((entry) => entry.value === 'пользовательский');
    expect(customTag?.count).toBe(0);
    expect(customTag?.sources?.custom).toBe(true);
    expect(typeof customTag?.customId).toBe('string');
  });

  it('возвращает книги для значения словаря и учитывает лимит', () => {
    const first = createSampleBook({ title: 'Первая книга', tags: ['общий', 'уникальный'], authors: ['Автор A'] });
    const second = createSampleBook({ title: 'Вторая книга', tags: ['общий'], authors: ['Автор B'] });

    const allMatches = dbLayer.listVocabularyBooks(ctx, 'tags', 'общий', { limit: 10 });
    expect(allMatches).toHaveLength(2);
    const titles = allMatches.map((item) => item.title).sort();
    expect(titles).toEqual(['Вторая книга', 'Первая книга']);

    const limited = dbLayer.listVocabularyBooks(ctx, 'tags', 'общий', { limit: 1 });
    expect(limited).toHaveLength(1);
    expect(['Первая книга', 'Вторая книга']).toContain(limited[0].title);
    expect(Array.isArray(limited[0].authors)).toBe(true);
  });
});
