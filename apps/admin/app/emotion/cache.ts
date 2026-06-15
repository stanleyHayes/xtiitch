import createCache, { type EmotionCache } from "@emotion/cache";

export const EMOTION_CACHE_KEY = "xt-admin";

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
