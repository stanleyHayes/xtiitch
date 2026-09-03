const resources = [
  {
    title: "Understand Xtiitch",
    description:
      "Review the product, audience, and approved public claims before you publish.",
    href: "https://xtiitch.com/features",
    action: "Open product guide",
  },
  {
    title: "Plans and pricing",
    description:
      "Use the current public pricing page when explaining paid plans. Never promise unpublished discounts.",
    href: "https://xtiitch.com/pricing",
    action: "View current pricing",
  },
  {
    title: "Payments and trust",
    description:
      "Share the official explanation of payment handling, safety, and platform responsibilities.",
    href: "https://xtiitch.com/security",
    action: "Read trust guide",
  },
  {
    title: "Common questions",
    description:
      "Use approved answers for recurring questions from prospective businesses.",
    href: "https://xtiitch.com/faq",
    action: "Open FAQ",
  },
] as const;

export function ResourcesSection() {
  return (
    <div className="section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Training & updates</p>
          <h1>Affiliate resources</h1>
          <p className="muted">
            Current public materials for accurate, responsible Xtiitch
            promotion.
          </p>
        </div>
      </div>
      <section className="links-grid">
        {resources.map((resource) => (
          <article className="card" key={resource.href}>
            <div className="card-head">
              <div>
                <h2>{resource.title}</h2>
                <p className="muted">{resource.description}</p>
              </div>
            </div>
            <a
              className="small-button secondary"
              href={resource.href}
              target="_blank"
              rel="noreferrer"
            >
              {resource.action}
            </a>
          </article>
        ))}
      </section>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Promotion guidelines</h2>
            <p className="muted">
              Use your own Affiliate link and code. Describe the 20% recurring
              commission as your Affiliate earnings—not a discount for the
              business. Do not make guaranteed-income claims, invent offers, or
              request a business owner's payment or personal information.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
