// Unified source interface bridging Suwayomi GraphQL and fallback extensions
export interface UnifiedManga {
  id: string;
  title: string;
  thumbnailUrl: string;
  sourceId: string;
  sourceType: 'suwayomi' | 'wasm' | 'js';
}

export interface UnifiedChapter {
  id: string;
  name: string;
  url?: string;
  chapterNumber?: number;
}

export interface UnifiedPage {
  url: string;
  index: number;
}

export interface UnifiedEpisode {
  id: string;
  name: string;
  url: string;
}

export interface UnifiedVideoSource {
  serverName: string;
  qualities: Array<{ url: string; quality?: string }>;
}
