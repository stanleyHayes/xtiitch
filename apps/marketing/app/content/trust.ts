export type TrustPoint = { title: string; body: string };

export const trustPoints: TrustPoint[] = [
  {
    title: "We never hold your money",
    body: "Customer payments settle directly to your own settlement account through Paystack. Our small commission is split off automatically as the money flows. Xtiitch runs no wallet and no escrow.",
  },
  {
    title: "Card details never touch Xtiitch",
    body: "Paystack handles card collection on its own secure surfaces. Xtiitch never receives or stores raw card data.",
  },
  {
    title: "Each business is sealed off",
    body: "One business can never see another business’s designs, orders, customers or money. Tenant isolation is the system’s most important rule.",
  },
  {
    title: "Verified businesses only",
    body: "To receive customer payments a business is verified with settlement details in its own name. We make that smooth, but the information must be real.",
  },
  {
    title: "Your personal data is protected",
    body: "Measurements, contact and identity details are kept within your business’s own scope and protected in transit and at rest.",
  },
  {
    title: "An honest record of every payment",
    body: "Money movements and order-stage changes are recorded so a question about an order or a payment can be answered with certainty.",
  },
];
