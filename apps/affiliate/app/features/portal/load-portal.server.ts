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
	PartnerReferral,
  PortalData,
  ShareLinks,
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

// Runs a non-critical endpoint, falling back rather than failing the load.
//
// A 401 is the one error that MUST still propagate: withAffiliateAuth catches
// it, refreshes the access token and retries this whole function. Swallowing it
// here would leave the affiliate on fallback data forever and eventually sign
// them out, which is the exact bounce that path exists to prevent.
async function optional<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof Response && error.status === 401) {
      throw error;
    }
    return fallback;
  }
}

// Errors from the two CRITICAL endpoints deliberately propagate — without the
// dashboard or the share link there is no portal to draw.
//
// Everything else degrades. This used to be a flat Promise.all over eight
// endpoints, which rejects on the FIRST failure: one hiccup from any single one
// of them — a cold-starting API, a transient 500 on the referrals list — threw
// out of the loader and replaced the whole portal with the root error boundary.
// That is not hypothetical. The portal revalidates itself every 15 seconds and
// on every window focus (see PortalPage), so returning to the tab after an
// iOS download completed was enough to blank a working page: the download
// succeeded, focus fired, one endpoint failed, and the affiliate lost their
// portal to "Something went wrong". A stale list is a far better outcome than
// a destroyed page, and the next refresh repairs it.
async function loadPortalData(headers: HeadersInit): Promise<PortalData> {
  const [
    dashboard,
    conversions,
    payouts,
    share,
    campaigns,
    profile,
    preferences,
    account,
		referrals,
  ] = await Promise.all([
    affiliateAPI<Dashboard>("/affiliate/dashboard", { headers }),
    optional(
      () =>
        affiliateAPI<{ conversions: Conversion[] }>("/affiliate/conversions", {
          headers,
        }),
      { conversions: [] },
    ),
    optional(
      () => affiliateAPI<{ payouts: Payout[] }>("/affiliate/payouts", { headers }),
      { payouts: [] },
    ),
    affiliateAPI<ShareLinks>("/affiliate/share-links", { headers }),
    optional(
      () =>
        affiliateAPI<{ campaign_links: CampaignLink[] }>(
          "/affiliate/campaign-links",
          { headers },
        ),
      { campaign_links: [] },
    ),
    // Payout and notification settings degrade to null rather than to an empty
    // object: Settings renders form defaults from these, and a blank payout
    // form would read as "no payout account on file" to an affiliate who has
    // one — inviting them to re-enter bank details that were never lost.
    optional<PayoutProfile | null>(
      () => affiliateAPI<PayoutProfile>("/affiliate/payout-profile", { headers }),
      null,
    ),
    optional<NotificationPreferences | null>(
      () =>
        affiliateAPI<NotificationPreferences>(
          "/affiliate/notification-preferences",
          { headers },
        ),
      null,
    ),
    // Settings shows which account is signed in and sends password resets to
    // its email. A failure here must not blank the whole portal, so it
    // degrades to null and Settings hides the account card.
    optional<Account | null>(
      () => affiliateAPI<Account>("/affiliate/me", { headers }),
      null,
    ),
		optional(
			() =>
				affiliateAPI<{ referrals: PartnerReferral[] }>("/affiliate/referrals", {
					headers,
				}),
			{ referrals: [] },
		),
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
		referrals: referrals.referrals,
    displayName: account?.display_name,
  };
}
