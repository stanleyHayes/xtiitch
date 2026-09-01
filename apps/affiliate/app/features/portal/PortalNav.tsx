import type { ComponentType, KeyboardEvent } from "react";
import {
  ChartIcon,
  LinkIcon,
  LockIcon,
  WalletIcon,
} from "../../components/Icons";

export type TabID = "overview" | "referrals" | "links" | "earnings" | "settings";

const TABS: {
  id: TabID;
  label: string;
  icon: ComponentType<{ size?: number }>;
}[] = [
  { id: "overview", label: "Overview", icon: ChartIcon },
	{ id: "referrals", label: "My referrals", icon: ChartIcon },
  { id: "links", label: "Links", icon: LinkIcon },
  { id: "earnings", label: "Earnings", icon: WalletIcon },
  { id: "settings", label: "Settings", icon: LockIcon },
];

// Real tabs, not links: `aria-selected` plus roving focus is what a screen
// reader needs to announce this as a tab strip. The panel itself is the <main>
// the shell renders, tied back here by id.
export function PortalNav({
  active,
  onSelect,
}: {
  active: TabID;
  onSelect: (tab: TabID) => void;
}) {
  const moveFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    if (event.key === "ArrowLeft")
      next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    const tab = TABS[next];
    if (!tab) return;
    onSelect(tab.id);
    document.getElementById(`tab-${tab.id}`)?.focus();
  };

  return (
    <div className="portal-nav-wrap">
      {/* A plain div, not <nav>: role="tablist" would override the navigation
          landmark and leave the page with a landmark that announces as a tab
          strip. */}
      <div className="portal-nav" role="tablist" aria-label="Portal sections">
        {TABS.map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={active === id}
            aria-controls="portal-main"
            tabIndex={active === id ? 0 : -1}
            className={active === id ? "portal-tab is-active" : "portal-tab"}
            onClick={() => onSelect(id)}
            onKeyDown={(event) => moveFocus(event, index)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
