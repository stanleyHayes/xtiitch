import { Link, type MetaFunction } from "react-router";
import { Logo } from "../components/Logo";

export const meta: MetaFunction = () => [
  { title: "Affiliate programme terms | Xtiitch" },
  { name: "robots", content: "noindex, nofollow" },
];

// PLACEHOLDER TERMS — NOT LEGAL COPY.
//
// The signup form must link somewhere before an applicant ticks "I accept",
// so this page exists to hold the shape of the agreement: the sections a real
// affiliate agreement needs, in the order an applicant reads them. Every
// clause below is a stand-in written from how the product actually behaves
// (30-day attribution, approval window, payout runs) and must be replaced by
// counsel-reviewed copy before launch.
//
// To replace: swap the SECTIONS array. The banner and LAST_UPDATED come with
// it — delete the banner once the copy is real.
const LAST_UPDATED = "31 July 2026";

const SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "1. Joining the programme",
    paragraphs: [
      "Creating an affiliate account enrolls you immediately under Xtiitch's current default programme. You'll receive an activation link by email to set a password and open your portal.",
      "You must be at least 18 years old and provide accurate details. One person or business may hold one affiliate account unless we agree otherwise in writing.",
    ],
  },
  {
    heading: "2. Your referral link",
    paragraphs: [
      "You'll be issued a referral code and link. A signup or purchase is attributed to you when it follows an eligible click on your link within the attribution window shown in your portal (currently 30 days).",
      "You may create named campaign links to tell your channels apart. You may not bid on Xtiitch brand terms in paid search, or present your link as an official Xtiitch page.",
    ],
  },
  {
    heading: "3. How you may promote Xtiitch",
    paragraphs: [
      "Promote honestly. Do not misstate what Xtiitch costs or does, do not promise outcomes we have not published, and disclose that you earn commission where the law requires it.",
      "You may not use spam, unsolicited bulk messaging, misleading advertising, incentivised clicks, cookie stuffing, or any automated traffic. Any of these void the commission involved and may end your participation.",
    ],
  },
  {
    heading: "4. Commission and approval",
    paragraphs: [
      "Commission is earned on qualified conversions as described in your portal. Newly recorded commission is Pending while it sits inside the approval window, then becomes Available once it clears.",
      "Commission on a transaction that is refunded, charged back, cancelled, or found to breach these terms is reversed, and may be deducted from your balance.",
    ],
  },
  {
    heading: "5. Payouts",
    paragraphs: [
      "Available commission is paid to the payout account on your profile during our regular payout runs. Keep those details accurate — we are not responsible for funds sent to an account you entered incorrectly.",
      "You are responsible for any taxes due on what you earn. We may withhold a payout while we investigate suspected fraud or a breach of these terms.",
    ],
  },
  {
    heading: "6. Ending your participation",
    paragraphs: [
      "You may leave the programme at any time from your portal or by contacting support. We may suspend or end your participation, with notice where reasonable, and immediately in cases of fraud or abuse.",
      "When participation ends, your links stop attributing. Commission already cleared and not forfeited under these terms remains payable.",
    ],
  },
  {
    heading: "7. Brand and data",
    paragraphs: [
      "You may use Xtiitch names and logos only to promote Xtiitch, in their supplied form, and we may ask you to stop at any time. You gain no other rights in our brand.",
      "Your portal reports aggregate performance only. You will not receive personal details of the customers or businesses you refer, and you must not attempt to identify them.",
    ],
  },
  {
    heading: "8. Changes to these terms",
    paragraphs: [
      "We may update these terms as the programme evolves. We'll post the updated version here and, for material changes, email you. Continuing in the programme after a change means you accept it.",
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
        <p className="eyebrow">Affiliate programme</p>
        <h1>Terms and conditions</h1>
        <p className="muted doc-meta">Last updated {LAST_UPDATED}</p>

        <div className="doc-banner" role="note">
          <strong>Draft for review.</strong> This is placeholder wording that
          describes how the programme currently works. It has not been reviewed
          by a lawyer and will be replaced before launch.
        </div>

        <p className="lede">
          These terms cover taking part in the Xtiitch affiliate programme — how
          you're accepted, how referrals are attributed, how commission is
          earned and paid, and what ends participation. Read them before you
          join.
        </p>

        {SECTIONS.map((section) => (
          <section className="doc-section" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </section>
        ))}

        <section className="doc-section">
          <h2>Questions</h2>
          <p>
            Email <a href="mailto:support@xtiitch.com">support@xtiitch.com</a>{" "}
            and we'll come back to you.
          </p>
        </section>

        <div className="doc-foot">
          <Link className="button" to="/signup">
            Back to signup
          </Link>
        </div>
      </main>
    </div>
  );
}
