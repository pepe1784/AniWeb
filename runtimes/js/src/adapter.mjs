// Adapter: unify Mangayomi-style Source API to AniWeb extension contract
// AniWeb contract (subset): getPopular/getLatest/search + getDetail/getChapters/getPages/getEpisodes/getVideoSources
// Mangayomi Source methods: getPopular(page), getLatestUpdates(page), search(query,page), getDetail(url), getChapterList(url), getPageList(url), getVideoList(url) etc.

export function adaptSource(source) {
  return {
    id: source.id,
    name: source.name,
    lang: source.lang,
    baseUrl: source.baseUrl,
    isManga: source.isManga !== false,
    async getMangaPopular(page) {
      if (typeof source.getPopular === 'function') {
        return await source.getPopular(page);
      }
      if (typeof source.getPopularManga === 'function') {
        return await source.getPopularManga(page);
      }
      return { list: [], hasNextPage: false };
    },
    async getMangaRecent(page) {
      if (typeof source.getLatestUpdates === 'function') {
        return await source.getLatestUpdates(page);
      }
      if (typeof source.getLatest === 'function') {
        return await source.getLatest(page);
      }
      return { list: [], hasNextPage: false };
    },
    async searchManga(query, page) {
      if (typeof source.search === 'function') {
        return await source.search(query, page);
      }
      if (typeof source.searchManga === 'function') {
        return await source.searchManga(query, page);
      }
      return { list: [], hasNextPage: false };
    },
    async getMangaDetail(url) {
      if (typeof source.getDetail === 'function') return await source.getDetail(url);
      return { title: '', chapters: [] };
    },
    async getChapters(url) {
      if (typeof source.getChapterList === 'function') return await source.getChapterList(url);
      if (typeof source.getChapters === 'function') return await source.getChapters(url);
      return [];
    },
    async getMangaPages(url) {
      if (typeof source.getPageList === 'function') return await source.getPageList(url);
      return [];
    },
    async getAnimePopular(page) {
      if (source.isManga === true) return { list: [], hasNextPage: false };
      if (typeof source.getPopular === 'function' && source.isManga === false) return await source.getPopular(page);
      return { list: [], hasNextPage: false };
    },
    async getAnimeRecent(page) {
      if (source.isManga === true) return { list: [], hasNextPage: false };
      if (typeof source.getLatestUpdates === 'function' && source.isManga === false) return await source.getLatestUpdates(page);
      return { list: [], hasNextPage: false };
    },
    async searchAnime(query, page) {
      if (source.isManga === true) return { list: [], hasNextPage: false };
      if (typeof source.search === 'function') return await source.search(query, page);
      return { list: [], hasNextPage: false };
    },
    async getEpisodes(url) {
      if (typeof source.getEpisodeList === 'function') return await source.getEpisodeList(url);
      return [];
    },
    async getVideoSources(url) {
      if (typeof source.getVideoList === 'function') return await source.getVideoList(url);
      return [];
    },
  };
}
