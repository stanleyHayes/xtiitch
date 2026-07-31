// The Xtiitch mark, inline rather than an <img> so it inherits colour and
// never flashes unstyled while the asset loads. Same geometry as the favicon
// the other four apps ship, so the affiliate portal reads as the same product.
//
// `tone` picks the rendering: "brand" paints the burgundy tile (light
// backgrounds), "inverse" drops the tile and draws the mark in the current text
// colour (for the burgundy auth panel, where a burgundy tile would vanish).
export function LogoMark({
  size = 36,
  tone = "brand"
}: {
  size?: number;
  tone?: "brand" | "inverse";
}) {
  const inverse = tone === "inverse";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Xtiitch"
      focusable="false"
    >
      {inverse ? null : <rect width="64" height="64" rx="14" fill="#800020" />}
      <g
        fill="none"
        stroke={inverse ? "currentColor" : "#faf6f2"}
        strokeLinecap="round"
      >
        <line x1="26" y1="28" x2="26" y2="44" strokeWidth="6.4" />
        <line x1="38" y1="28" x2="38" y2="44" strokeWidth="6.4" />
        <path d="M26 43 Q32 52.5 38 43" strokeWidth="2.6" />
      </g>
      <circle
        cx="26"
        cy="18.6"
        r="3.9"
        fill={inverse ? "currentColor" : "#faf6f2"}
      />
      <circle
        cx="38"
        cy="18.6"
        r="3.9"
        fill={inverse ? "currentColor" : "#faf6f2"}
      />
    </svg>
  );
}

// Mark plus wordmark. `href` makes it a link; without one it renders as plain
// content, which is what the login page wants (nothing to navigate to yet).
export function Logo({
  href,
  tone = "brand",
  size = 36,
  subtitle
}: {
  href?: string;
  tone?: "brand" | "inverse";
  size?: number;
  subtitle?: string;
}) {
  const content = (
    <>
      <LogoMark size={size} tone={tone} />
      <span className="logo-text">
        <span className="logo-word">Xtiitch</span>
        {subtitle ? <span className="logo-sub">{subtitle}</span> : null}
      </span>
    </>
  );
  if (href) {
    return (
      <a className="logo" href={href}>
        {content}
      </a>
    );
  }
  return <span className="logo">{content}</span>;
}
