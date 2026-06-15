import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { CacheProvider } from "@emotion/react";
import { createEmotionCache } from "./emotion/cache";

const emotionCache = createEmotionCache();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <CacheProvider value={emotionCache}>
        <HydratedRouter />
      </CacheProvider>
    </StrictMode>,
  );
});
