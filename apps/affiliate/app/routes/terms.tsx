import { Link, type MetaFunction } from "react-router";
import { Logo } from "../components/Logo";

export const meta: MetaFunction = () => [
  { title: "Xtiitch Affiliate Program terms | Xtiitch" },
  { name: "robots", content: "noindex, nofollow" },
];

// These terms describe the Xtiitch Affiliate Program as it actually operates:
// open enrollment, 20% recurring commission on directly referred subscriptions
// for as long as they keep paying, 14-day commission maturity, no downlines,
// and milestone rewards Xtiitch configures per campaign. They have NOT been
// reviewed by counsel — the wording is the product owner's, not a lawyer's.
//
// The product-promotion affiliate functionality (Affiliates earning from
// customer purchases of a business's products) is BUILT BUT PARKED. It is
// deliberately described here only as something Xtiitch may introduce later,
// never as a current earning opportunity — see the closing section.
const LAST_UPDATED = "4 September 2026";

// The plain-language summary that sits above the legal terms, so an Affiliate
// who reads nothing else still understands what they earn and when.
const SUMMARY: string[] = [
  "Refer businesses to Xtiitch and earn 20% recurring commission on qualifying paid subscription payments for as long as those businesses remain on eligible paid plans.",
  "If a referred business registers but has not activated a paid plan, it remains attributed to you but generates no commission yet. If it later upgrades, your recurring commission begins.",
  "If a referred business stops paying, your recurring commission pauses. If that same business later resumes an eligible paid subscription, your commission resumes too.",
  "Each qualifying commission is subject to a 14-day maturity period and applicable refund, fraud and eligibility checks.",
  "You may invite others to become Xtiitch Affiliates, but there is no commission or downstream earning for Affiliate recruitment.",
];

type Section = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  // Paragraphs printed after the bullet list, so a list can sit mid-section.
  afterBullets?: string[];
};

const SECTIONS: Section[] = [
  {
    heading: "1. The Xtiitch Affiliate Program",
    paragraphs: [
      "These terms govern participation in the Xtiitch Affiliate Program (the \"Program\"), operated by Xtiitch / XCreativs (\"Xtiitch\", \"we\", \"us\"). Participants in the Program are referred to as Xtiitch Affiliates, or simply Affiliates.",
      "An Affiliate is an individual or entity enrolled in the Xtiitch Affiliate Program and permitted to promote Xtiitch using an assigned affiliate or referral link, code, or other referral mechanism approved by Xtiitch.",
      "The Program currently exists for one purpose: for Affiliates to refer business owners to Xtiitch subscription plans. Affiliates earn from qualifying Xtiitch subscriptions taken by businesses they directly refer.",
      "Functionality allowing Affiliates to promote products belonging to Xtiitch businesses and earn from customer purchases of those products is not part of the active Program. It is currently deactivated and must not be treated as a present earning opportunity. See section 15.",
    ],
  },
  {
    heading: "2. Eligibility and enrollment",
    paragraphs: [
      "Enrollment is open. There is currently no credential or qualification approval process: anyone who meets Xtiitch's basic eligibility requirements may create an Affiliate account and begin promoting Xtiitch.",
      "You must be at least 18 years old and provide accurate registration details. A WhatsApp number is required during Affiliate registration and must be kept current.",
      "Open enrollment does not limit our right to act on abuse. We may suspend, restrict, deactivate or terminate an Affiliate account for fraud, abuse, unlawful conduct, or breach of these terms.",
    ],
  },
  {
    heading: "3. Referral links and attribution",
    paragraphs: [
      "You will be issued a referral code and link. An eligible click is captured for 30 days, and when a business registers through your referral mechanism within that window, that business is attributed to you under Xtiitch's referral rules.",
      "Attribution is persistent. A validly referred business remains attributed to its original Affiliate across the Not Activated, Active and Inactive states. A later Affiliate cannot ordinarily claim a business that has already been validly attributed to another Affiliate.",
      "You earn commission only from qualifying businesses directly attributed to you. There is no commission for indirect, downstream or second-hand referrals.",
      "Xtiitch retains authority to investigate and resolve duplicate referrals, self-referrals, technical attribution errors, fraudulent attribution and other referral disputes. Xtiitch's verified system records determine final attribution.",
    ],
  },
  {
    heading: "4. Commission",
    paragraphs: [
      "Affiliates currently earn 20% recurring commission on eligible Xtiitch subscription revenue from directly referred businesses, subject to these terms.",
      "There is currently no 12-month limit on recurring commission. You continue to earn eligible recurring commission for as long as the validly attributed referred business continues making qualifying paid subscription payments.",
      "If a referred business registers but remains on Free, or has not activated an eligible paid subscription, the business remains attributed to you but no commission is payable yet.",
      "If an attributed Free or Not Activated business later subscribes to an eligible paid plan, you automatically become eligible for the applicable recurring commission on qualifying subscription payments from that point.",
      "If a referred business cancels, stops renewing, fails to make a qualifying payment, or otherwise ceases to maintain an eligible paid subscription, new recurring commissions stop or pause.",
      "If that same business subsequently resumes an eligible paid subscription, your recurring commission eligibility automatically resumes, provided the referral and your Affiliate account remain eligible under these terms.",
    ],
  },
  {
    heading: "5. When commission becomes payable",
    paragraphs: [
      "Each qualifying commission is subject to a 14-day maturity period before it becomes available for payout, and remains subject to refund, dispute, fraud and eligibility checks throughout.",
      "A newly generated commission may initially appear as Pending. Pending commission is not final and must not be treated as payable until the maturity and eligibility requirements have been satisfied.",
      "We may place a specific commission, or an Affiliate account, on Hold where reasonably necessary to investigate suspected fraud, refunds, disputes, duplicate referrals, abnormal activity or other legitimate concerns.",
      "You are not entitled to retain commission on revenue that is subsequently refunded, reversed, charged back, fraudulent or otherwise invalid. We may reverse pending commissions or make appropriate adjustments against future Affiliate earnings where necessary.",
      "Duplicate commissions, incorrect calculations, attribution errors and other genuine system errors may be corrected. Amounts displayed in the Affiliate Dashboard are indicative and remain subject to verification against Xtiitch's authoritative transaction and commission records.",
    ],
  },
  {
    heading: "6. Payouts",
    paragraphs: [
      "Xtiitch determines reasonable payout methods, schedules, thresholds and verification requirements for the Program, and may change them prospectively. Current payout details are published in your Affiliate portal.",
      "Keep your payout details accurate and complete. We are not responsible for funds sent to an account you entered incorrectly, and we may withhold a payout pending identity or eligibility verification.",
      "You remain responsible for any taxes and statutory obligations relating to your earnings, subject to any withholding, reporting or other obligations Xtiitch is itself legally required to perform.",
    ],
  },
  {
    heading: "7. Inviting other Affiliates",
    paragraphs: [
      "You may invite other people to join the Xtiitch Affiliate Program.",
      "Inviting another person to become an Affiliate generates no commission, percentage, cash reward or downstream earnings of any kind.",
      "There are no downlines. If Affiliate A invites Affiliate B, and Affiliate B subsequently refers 100 paying businesses, Affiliate B earns their applicable commissions and Affiliate A earns nothing from Affiliate B's referrals. The Xtiitch Affiliate Program is not a multi-level commission structure.",
    ],
  },
  {
    heading: "8. What you can see about referred businesses",
    paragraphs: [
      "Your portal shows only the registered Xtiitch handles of businesses attributed to you, together with the applicable status:",
    ],
    bullets: ["Active", "Inactive", "Not Activated"],
    afterBullets: [
      "Participation in the Program gives you no entitlement to a referred business's owner name, phone or WhatsApp number, email, address, subscription amount, payment history, sales, revenue, orders, customers, measurements, banking information, analytics or any other private merchant information.",
      "You must not attempt to obtain, infer or misuse that information, and you must not represent to anyone that you have access to it.",
    ],
  },
  {
    heading: "9. Your contact details and Program communications",
    paragraphs: [
      "A WhatsApp number is required at registration. We use the contact information you provide — including your WhatsApp number and email address — for Program communications, support, service updates, campaigns, training and Affiliate-community activities.",
      "You may adjust your notification preferences in your portal where we offer that choice. Some messages are operational (for example, security, payout and account notices) and cannot be switched off while your account is open.",
    ],
  },
  {
    heading: "10. Milestones and rewards",
    paragraphs: [
      "Xtiitch may operate performance milestones for Affiliates. These initially include the following counts of qualifying paid business referrals:",
    ],
    bullets: ["10 referrals", "50 referrals", "100 referrals", "500 referrals", "1,000 referrals"],
    afterBullets: [
      "Only qualifying paid business referrals count toward these milestones. Businesses that remain Free or Not Activated do not count, and people you invite to become Affiliates never count as paid-business referrals.",
      "Xtiitch determines the reward attached to each milestone, which may include cash bonuses, gifts, merchandise, recognition, access, experiences or other benefits. Reward types, values and availability may change according to the applicable program or campaign rules.",
      "Reaching a milestone does not entitle you to any particular prize unless that reward has been officially configured or announced by Xtiitch for the applicable milestone and program period.",
    ],
  },
  {
    heading: "11. How you may promote Xtiitch",
    paragraphs: [
      "You must not create fake businesses, duplicate accounts, fabricated identities, artificial subscriptions, or otherwise manipulate the system to generate commissions or milestone progress. Self-referral to earn commission on your own subscription is prohibited.",
      "You must not spam, impersonate Xtiitch employees, make unauthorized promises, guarantee sales, income or results, misrepresent Xtiitch features or pricing, or use deceptive practices to generate referrals.",
      "You may use Xtiitch-approved marketing materials to promote the platform. You may not present yourself as Xtiitch itself, create confusingly similar domains or accounts, materially alter Xtiitch branding in misleading ways, or claim authority to bind Xtiitch.",
      "Disclose that you earn commission wherever applicable law requires it.",
    ],
  },
  {
    heading: "12. Your relationship with Xtiitch",
    paragraphs: [
      "Participation in the Xtiitch Affiliate Program does not make you an employee, representative, agent, franchisee, or a person authorized to enter into contracts on behalf of Xtiitch or XCreativs. You take part as an independent participant.",
    ],
  },
  {
    heading: "13. Suspension, deactivation and termination",
    paragraphs: [
      "We may temporarily suspend an Affiliate account, or place commissions on hold, while we investigate suspected fraud, abuse, violations of these terms, or other legitimate Program concerns.",
      "We may deactivate or terminate an Affiliate for fraud, material breach of these terms, abuse, unlawful conduct, or other grounds set out in these terms. You may leave the Program at any time from your portal or by contacting support.",
      "On termination, your referral mechanisms stop creating new attribution. Commission that was validly earned and has satisfied the maturity and eligibility requirements remains payable, subject to any lawful hold, reversal or set-off. Commission arising from fraud or material breach may be cancelled, and we may recover amounts already paid on that basis.",
    ],
  },
  {
    heading: "14. Changes to the Program and these terms",
    paragraphs: [
      "We may modify the Program prospectively, including eligible plans, commission rates, maturity periods, milestone structures, earning rules and features. We will communicate material changes appropriately, and will post the updated terms here.",
      "Historical commissions are treated according to the rules that applied when they arose. Continuing in the Program after a change takes effect means you accept it.",
    ],
  },
  {
    heading: "15. Beta Launch, and what comes later",
    paragraphs: [
      "Xtiitch and/or the Affiliate Program may operate during a Beta Launch period while we validate and improve functionality under real-world usage. Features, workflows and functionality may be refined during Beta.",
      "Beta is not a blanket waiver. It does not remove our responsibilities concerning money, privacy or security, or any obligation imposed on us by applicable law.",
      "Xtiitch may later introduce functionality allowing Affiliates to promote products sold by Xtiitch businesses and potentially earn commission from qualifying customer purchases. That functionality is not currently active, is not promised under these terms, and any future introduction may be subject to separate or additional terms.",
    ],
  },
];

export default function Terms() {
  return (
    <div className="doc-shell">
      <header className="doc-header">
        <Logo href="/login" size={32} subtitle="Affiliates" />
        <Link className="ghost-button" to="/signup">
          Back to signup
        </Link>
      </header>

      <main className="doc">
        <p className="eyebrow">Xtiitch Affiliate Program</p>
        <h1>Terms and conditions</h1>
        <p className="muted doc-meta">Last updated {LAST_UPDATED}</p>

        <div className="doc-banner" role="note">
          <strong>Beta Launch.</strong> Xtiitch and the Affiliate Program may
          operate during a Beta Launch period while we validate and improve the
          product under real-world usage. Features and workflows may be refined
          during Beta — see section 15.
        </div>

        <section className="doc-summary" aria-labelledby="how-it-works">
          <h2 id="how-it-works">How the Xtiitch Affiliate Program works</h2>
          {SUMMARY.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
          <p className="doc-summary-note">
            This summary is for orientation only. The full terms below govern
            your participation.
          </p>
        </section>

        {SECTIONS.map((section) => (
          <section className="doc-section" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            {section.bullets ? (
              <ul className="doc-list">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {section.afterBullets?.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </section>
        ))}

        <section className="doc-section">
          <h2>Questions</h2>
          <p>
            Email <a href="mailto:support@xtiitch.com">support@xtiitch.com</a>{" "}
            and we'll help.
          </p>
        </section>

        <footer className="doc-foot">
          <Link className="button" to="/signup">
            Back to signup
          </Link>
        </footer>
      </main>
    </div>
  );
}
