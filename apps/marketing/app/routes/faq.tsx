import type { MetaDescriptor } from "react-router";
import { pageMeta } from "../components/seo";
import { CtaBand, FaqList, PageHero, Section } from "../components/ui";
import { faqs } from "../content";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "FAQ",
    description:
      "Answers on getting paid, pricing, deposits on custom orders, mobile money and cards, cash sales, order tracking, cancellations, and data safety.",
    path: "/faq",
  });
}

export default function Faq() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Questions, answered plainly"
        subtitle="The things fashion businesses and their customers ask most. If something isn’t here, reach out when you join the waitlist."
      />

      <Section>
        <FaqList items={faqs} />
      </Section>

      <CtaBand
        title="Still have a question?"
        body="Join the waitlist and tell us what you sell — we’ll get back to you."
      />
    </>
  );
}
