import { affiliateAPI } from "../../lib/api.server";
import { withAffiliateAuth } from "../../lib/auth.server";
import type {
  Account,
  CampaignLink,
  Conversion,
  Dashboard,
  NotificationPreferences,
  Payout,
  PayoutProfile,
  PortalData,
  ShareLinks
} from "./types";

// Returns the portal data plus, when the access token had to be refreshed
// mid-load, the Set-Cookie carrying the rotated tokens. The route must pass
// that header on — see routes/portal.tsx.
export async function loadPortal(
  request: Request,
): Promise<{ data: PortalData; setCookie?: string }> {
  return withAffiliateAuth(request, (headers: HeadersInit) =>
    loadPortalData(headers),
  );
}

async function loadPortalData(headers: HeadersInit): Promise<PortalData> {
  try {
    const [
      dashboard,
      conversions,
      payouts,
      share,
      campaigns,
      profile,
      preferences,
      account
    ] = await Promise.all([
      affiliateAPI<Dashboard>("/affiliate/dashboard", { headers }),
      affiliateAPI<{ conversions: Conversion[] }>("/affiliate/conversions", {
        headers
      }),
      affiliateAPI<{ payouts: Payout[] }>("/affiliate/payouts", { headers }),
      affiliateAPI<ShareLinks>("/affiliate/share-links", { headers }),
      affiliateAPI<{ campaign_links: CampaignLink[] }>(
        "/affiliate/campaign-links",
        { headers }
      ),
      affiliateAPI<PayoutProfile>("/affiliate/payout-profile", { headers }),
      affiliateAPI<NotificationPreferences>(
        "/affiliate/notification-preferences",
        { headers }
      ),
      // Settings shows which account is signed in and sends password resets to
      // its email. A failure here must not blank the whole portal, so it
      // degrades to null and Settings hides the account card.
      affiliateAPI<Account>("/affiliate/me", { headers }).catch(() => null)
    ]);

    return {
      dashboard,
      conversions: conversions.conversions,
      payouts: payouts.payouts,
      share,
      campaigns: campaigns.campaign_links,
      profile,
      preferences,
      account,
      displayName: account?.display_name
    };
  } catch (error) {
    // 401 is no longer terminal here: withAffiliateAuth catches it, refreshes,
    // and retries. Rethrow so it can.
    throw error;
  }
}
