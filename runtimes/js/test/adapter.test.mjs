import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { adaptSource } from '../src/adapter.mjs';

describe('adapter', () => {
  test('adapts mangayomi style source', async () => {
    const source = {
      id: 'test',
      name: 'Test',
      lang: 'en',
      baseUrl: 'https://example.com',
      isManga: true,
      getPopular: async (page) => ({ list: [{ title: 'A' }], hasNextPage: false }),
      getLatestUpdates: async (page) => ({ list: [], hasNextPage: false }),
      search: async (q, p) => ({ list: [], hasNextPage: false }),
      getDetail: async (url) => ({ title: 'A', chapters: [] }),
      getChapterList: async (url) => [{ name: '1' }],
      getPageList: async (url) => ['p1.jpg'],
    };
    const adapted = adaptSource(source);
    assert.equal(adapted.id, 'test');
    assert.equal(adapted.isManga, true);
    assert.deepEqual(await adapted.getMangaPopular(1), { list: [{ title: 'A' }], hasNextPage: false });
    assert.deepEqual(await adapted.getChapters('u'), [{ name: '1' }]);
    assert.deepEqual(await adapted.getMangaPages('u'), ['p1.jpg']);
  });
});
