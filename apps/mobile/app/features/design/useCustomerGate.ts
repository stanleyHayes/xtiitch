import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useFocusEffect, useRouter } from "expo-router";

import {
  fetchCustomerProfile,
  loadSession,
  type CustomerSession,
} from "../../../src/customerAuth";
import type { ContactFields } from "./DesignContactFields";

// §3b gate for the order forms: paying requires a verified customer session.
// Mirrors the web storefront exactly — the checkout loader redirects guests to
// /account (apps/storefront/app/routes/checkout.tsx:46-53, enforced again on
// submit at :90-95) and the design action gates its whole "custom" bespoke
// intent the same way (app/routes/design.tsx:213-218). Browsing stays free;
// only the pay moment is gated. The account screen is pushed on top with a
// returnTo hint, so this screen (and everything already typed) stays mounted
// and the flow resumes after sign-in.
export function useCustomerGate(designHandle: string) {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);

  // Re-read the session whenever the screen regains focus — returning from
  // the sign-in detour must see the just-verified session.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((next) => {
        if (active) setSession(next);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (session ?? (await loadSession())) return true;
    router.push({
      pathname: "/account",
      params: { returnTo: `/design/${encodeURIComponent(designHandle)}` },
    });
    return false;
  }, [router, session, designHandle]);

  return { session, ensureSession };
}

// Prefill the contact fields from the signed-in profile (the web checkout
// loader does the same from /customer/me) — but only into fields the shopper
// has not already typed into.
export function useContactPrefill(
  session: CustomerSession | null,
  setContact: Dispatch<SetStateAction<ContactFields>>,
): void {
  useEffect(() => {
    if (!session) return;
    let active = true;
    fetchCustomerProfile()
      .then((profile) => {
        if (!active || !profile) return;
        setContact((prev) => ({
          ...prev,
          name: prev.name || profile.display_name,
          phone: prev.phone || profile.phone,
          email: prev.email || profile.email,
          whatsapp: prev.whatsapp || profile.whatsapp_phone,
        }));
      })
      .catch(() => {
        // Session expired mid-fill — leave the fields exactly as typed.
      });
    return () => {
      active = false;
    };
  }, [session, setContact]);
}
