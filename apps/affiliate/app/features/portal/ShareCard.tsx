import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ShareIcon,
} from "../../components/Icons";

export function ShareCard({
  code,
  url,
  cookieWindowDays,
}: {
  code: string;
  url: string;
  cookieWindowDays: number;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [search] = useSearchParams();

  // The QR route sends the affiliate back here with ?qr=unavailable when it
  // cannot produce the code, rather than replacing the portal with a
  // full-screen error page. Keep them on the tab they were using.
  const qrUnavailable = search.get("qr") === "unavailable";
  const tab = search.get("tab") ?? "";
  const qrHref = tab
    ? `/portal/qr.png?tab=${encodeURIComponent(tab)}`
    : "/portal/qr.png";

  // "Copied" used to latch on forever. Reset it so a second copy reads as a
  // second copy rather than a button that did nothing.
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    // navigator.clipboard is undefined outside a secure context and can reject
    // when permission is denied. Unhandled, that used to throw straight out of
    // the click handler; now it falls back to selecting the text so the link
    // is still gettable.
    try {
      if (!navigator.clipboard) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(url);
      setFailed(false);
      setCopied(true);
    } catch {
      setFailed(true);
      setCopied(false);
    }
  };

  const share = async () => {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: "Join Xtiitch", url });
    } catch {
      // Dismissing the OS share sheet rejects with AbortError. That is a
      // normal outcome, not an error worth showing.
    }
  };

  return (
    <section className="share-card" aria-label="Your referral link">
      <div className="share-card-head">
        <span className="share-label">Your referral code</span>
        <strong className="share-code">{code}</strong>
      </div>
      <div className="share-url" title={url}>
        {url}
      </div>
      <div className="share-actions">
        <button className="small-button" onClick={copy} type="button">
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          className="small-button secondary"
          onClick={share}
          type="button"
        >
          <ShareIcon />
          Share
        </button>
        <a className="small-button secondary" href={qrHref} download>
          <DownloadIcon />
          Download QR
        </a>
      </div>
      {qrUnavailable ? (
        <p className="share-note error-text" role="alert">
          We couldn't build your QR code just then. Your link above still works
          — try the download again in a moment, and contact support if it keeps
          failing.
        </p>
      ) : null}
      {failed ? (
        <p className="share-note error-text" role="alert">
          Couldn't copy automatically — select the link above and copy it.
        </p>
      ) : (
        <p className="share-note">
          Eligible clicks are captured for {cookieWindowDays} days. Once a
          business registers, its Affiliate attribution remains in place.
        </p>
      )}
    </section>
  );
}
