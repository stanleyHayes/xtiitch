// Single source of marketing copy for the site. Every claim here is grounded in
// Xtiitch-Product-Definition.pdf / Xtiitch-Technical-Specification.pdf and the
// compliance rules in docs/marketing/marketing-site-plan.md. Do not add claims
// the product does not yet make.

export const site = {
  name: "Xtiitch",
  company: "XCreativs Technologies",
  tagline: "The operating system for fashion.",
  motto: "Fashion, in good order.",
  promise:
    "Give your fashion business a real online store, one place to run orders and customers, and a clean way to take payment — and finally let your customers see where their garment has reached.",
  oneLiner:
    "A real shop, a simple way to run it, and an answer to “where is my cloth?”",
  primaryCta: {
    label: "Start for free",
    href: "https://business.xtiitch.com/register",
  },
  secondaryCta: { label: "See how it works", href: "/how-it-works" },
  whatsappNote:
    "Custom orders settle the final price with a quick WhatsApp chat, started straight from the dashboard.",
} as const;

export type NavLink = { label: string; href: string };

export const navLinks: NavLink[] = [
  { label: "Features", href: "/features" },
  { label: "Growth", href: "/growth" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "For customers", href: "/for-customers" },
  { label: "Security", href: "/security" },
  { label: "FAQ", href: "/faq" },
];
