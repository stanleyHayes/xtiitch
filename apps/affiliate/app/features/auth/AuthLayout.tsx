import type { ReactNode } from "react";
import { Logo } from "../../components/Logo";

// The split shell every auth page sits in: brand panel on the left, form on
// the right. Shared so sign-in, apply, forgot-password and reset-password
// cannot drift apart, which is what happens when each page owns its own
// header markup.
//
// The left panel is burgundy, so the logo renders in "inverse" tone — the
// brand tile would disappear against its own colour.
export function AuthLayout({
  title,
  lede,
  children,
  wide = false
}: {
  title: string;
  lede: string;
  children: ReactNode;
  // Apply-to-join has far more fields than a sign-in form and needs the room.
  wide?: boolean;
}) {
  return (
    <main className={wide ? "auth-layout auth-layout-wide" : "auth-layout"}>
      <section className="auth-intro">
        <Logo href="https://xtiitch.com" tone="inverse" size={40} />
        <div className="auth-intro-body">
          <p className="eyebrow">Affiliate portal</p>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
        </div>
        <p className="auth-intro-foot">
          Questions? <a href="mailto:support@xtiitch.com">support@xtiitch.com</a>
        </p>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
