import { useSearchParams } from "react-router";
import { ArrowRightIcon, WalletIcon } from "../../components/Icons";
import { EarningsSection } from "./EarningsSection";
import { LinksSection } from "./LinksSection";
import { OverviewSection } from "./OverviewSection";
import { PortalHeader } from "./PortalHeader";
import { PortalNav, type TabID } from "./PortalNav";
import { SettingsSection } from "./SettingsSection";
import type { PortalActionResult, PortalData } from "./types";

const TABS: TabID[] = ["overview", "links", "earnings", "settings"];

// The portal used to be one long scroll: overview, campaign tools, settings,
// earnings and both ledgers stacked in a single column, so finding payout
// details meant scrolling past every metric on the page.
//
// It is now four sections behind tabs, and the tab lives in the URL
// (?tab=settings) rather than component state. That keeps it server-rendered,
// linkable, survivable across a reload, and — the reason it matters here —
// still on the right section after a form posts, since an action response
// re-renders the route.
export function PortalPage({
  data,
  actionData,
}: {
  data: PortalData;
  actionData?: PortalActionResult;
}) {
  const [search, setSearch] = useSearchParams();
  const requested = search.get("tab") ?? "";
  const active: TabID = TABS.includes(requested as TabID)
    ? (requested as TabID)
    : "overview";

  const selectTab = (tab: TabID) => {
    const next = new URLSearchParams(search);
    if (tab === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    // replace: tabbing around should not fill the back button with history.
    setSearch(next, { replace: true, preventScrollReset: true });
  };

  return (
    <div className="portal-shell">
      <PortalHeader displayName={data.displayName} code={data.share.code} />
      <PortalNav active={active} onSelect={selectTab} />
      <main className="portal" id="portal-main">
        {!data.profile.masked_identifier && active !== "settings" ? (
          <button
            className="payout-setup-banner"
            type="button"
            onClick={() => selectTab("settings")}
          >
            <span className="payout-banner-icon">
              <WalletIcon size={30} />
            </span>
            <span className="payout-banner-copy">
              <span className="payout-banner-eyebrow">Action required</span>
              <strong>Set up where your commission should be paid</strong>
              <span>
                Add your mobile money or bank details now so your cleared
                earnings are ready for payout.
              </span>
            </span>
            <span className="payout-banner-action">
              Set up payouts <ArrowRightIcon />
            </span>
          </button>
        ) : null}
        {active === "overview" ? (
          <OverviewSection
            dashboard={data.dashboard}
            share={data.share}
            displayName={data.displayName}
          />
        ) : null}
        {active === "links" ? (
          <LinksSection
            campaigns={data.campaigns}
            share={data.share}
            result={actionData}
          />
        ) : null}
        {active === "earnings" ? (
          <EarningsSection
            dashboard={data.dashboard}
            conversions={data.conversions}
            payouts={data.payouts}
          />
        ) : null}
        {active === "settings" ? (
          <SettingsSection
            profile={data.profile}
            preferences={data.preferences}
            account={data.account}
            result={actionData}
          />
        ) : null}
      </main>
    </div>
  );
}
