// Platform branding: fetch the operator's custom logo once at app launch from
// the unauthenticated `/branding` endpoint (mounted under the `/v1` prefix the
// same way the catalogue client resolves it) and expose `logoUrl`. Empty when
// no custom logo is configured — callers fall back to the built-in XtiitchMark.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiBaseUrl } from "./api";

type BrandingContextValue = {
  logoUrl: string;
};

const BrandingContext = createContext<BrandingContextValue>({ logoUrl: "" });

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${apiBaseUrl()}/branding`, { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { logo_url?: string } | null) => {
        if (active && data?.logo_url) setLogoUrl(data.logo_url);
      })
      .catch(() => {
        /* offline / API down — keep the built-in mark */
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<BrandingContextValue>(() => ({ logoUrl }), [logoUrl]);

  return (
    <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}
