import createCache, { type EmotionCache } from "@emotion/cache";

// A single, shared Emotion cache key keeps server-extracted critical CSS and
// client-inserted styles in the same bucket so hydration stays consistent.
export const EMOTION_CACHE_KEY = "xt";

// On the client we anchor inserted styles to a known <meta> element so MUI's
// runtime styles always land after the server-rendered critical CSS. On the
// server `document` is undefined, so the cache has no insertion point.
export function createEmotionCache(): EmotionCache {
  let insertionPoint: HTMLElement | undefined;

  if (typeof document !== "undefined") {
    const marker = document.querySelector<HTMLMetaElement>(
      'meta[name="emotion-insertion-point"]',
    );
    insertionPoint = marker ?? undefined;
  }

  return createCache({ key: EMOTION_CACHE_KEY, insertionPoint });
}
