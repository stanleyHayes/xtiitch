import { Form, useNavigation } from "react-router";
import { ArrowRightIcon, LinkIcon } from "../../components/Icons";
import { FormStatus } from "./FormStatus";
import { ShareCard } from "./ShareCard";
import type { CampaignLink, PortalActionResult, ShareLinks } from "./types";

export function LinksSection({
  campaigns,
  share,
  result
}: {
  campaigns: CampaignLink[];
  share: ShareLinks;
  result?: PortalActionResult;
}) {
  const navigation = useNavigation();
  const saving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "campaign";

  return (
    <div className="section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Campaigns</p>
          <h1>Links</h1>
          <p className="muted">
            Your main referral link, plus named links so you can tell channels
            apart.
          </p>
        </div>
      </div>

      <div className="links-grid">
        <ShareCard
          code={share.code}
          url={share.canonical_url}
          cookieWindowDays={share.cookie_window_days}
        />

        <section className="card">
          <div className="card-head">
            <span className="card-icon">
              <LinkIcon size={18} />
            </span>
            <div>
              <h2>Create a campaign link</h2>
              <p className="muted">
                Point a named link at any Xtiitch page. Clicks still attribute
                to you.
              </p>
            </div>
          </div>
          <Form method="post" className="compact-form">
            <input type="hidden" name="intent" value="campaign" />
            <label>
              Name
              <input
                name="name"
                type="text"
                placeholder="e.g. Instagram bio"
                required
              />
            </label>
            <label>
              Slug
              <input
                name="slug"
                type="text"
                placeholder="e.g. ig-bio"
                pattern="[a-zA-Z0-9-]+"
                title="Letters, numbers and hyphens only"
                required
              />
            </label>
            <label>
              Destination URL
              <input
                name="destination_url"
                type="url"
                placeholder="https://xtiitch.com/pricing"
                required
              />
            </label>
            <FormStatus intent="campaign" result={result} />
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create link"}
              <ArrowRightIcon />
            </button>
          </Form>
        </section>
      </div>

      <h2 className="section-subhead">Your campaign links</h2>
      {campaigns.length === 0 ? (
        <section className="card empty-state">
          <LinkIcon size={22} />
          <p className="empty-title">No campaign links yet</p>
          <p className="muted">
            Create one above to track which channel your signups come from.
          </p>
        </section>
      ) : (
        <section className="card list">
          {campaigns.map((campaign) => (
            <article className="list-row" key={campaign.campaign_link_id}>
              <div className="list-main">
                <strong>{campaign.name}</strong>
                <span className="muted list-url">
                  {campaign.destination_url}
                </span>
              </div>
              <span className="pill">/{campaign.slug}</span>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
