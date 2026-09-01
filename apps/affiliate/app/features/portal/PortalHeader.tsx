import { Form } from "react-router";
import { Logo } from "../../components/Logo";
import { LogOutIcon } from "../../components/Icons";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "A";
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function PortalHeader({
  displayName,
  code
}: {
  displayName?: string;
  code?: string;
}) {
  const name = displayName?.trim() ?? "";
  return (
    <header className="portal-header">
      <div className="portal-header-inner">
				<Logo href="/portal" size={32} subtitle="Partners" />
        <div className="header-actions">
          {code ? (
            <span className="header-code" title="Your referral code">
              {code}
            </span>
          ) : null}
          <span className="header-account">
            <span className="avatar" aria-hidden="true">
              {initials(name)}
            </span>
						<span className="header-name">{name || "Partner"}</span>
          </span>
          {/* POST, not a link: signing out revokes the refresh token server
              side, and a GET would let any page prefetch you out of session. */}
          <Form action="/logout" method="post">
            <button className="ghost-button" type="submit">
              <LogOutIcon />
              <span>Sign out</span>
            </button>
          </Form>
        </div>
      </div>
    </header>
  );
}
