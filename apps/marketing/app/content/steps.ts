export type Step = { number: string; title: string; body: string };

export const steps: Step[] = [
  {
    number: "1",
    title: "Set up your store",
    body: "Add your name, logo and colours, then switch on only what fits how you work — bespoke, measurements, customisation, collections, delivery.",
  },
  {
    number: "2",
    title: "Add designs and sizes",
    body: "Upload designs with photos and prices, set up your own size bands and charts, and group designs into collections if you use them.",
  },
  {
    number: "3",
    title: "Share your links",
    body: "Post a single design or a whole collection to Instagram, Facebook or WhatsApp. Customers can browse with no account needed.",
  },
  {
    number: "4",
    title: "Receive orders and take payment",
    body: "Standard orders are paid in full at checkout. Custom orders are confirmed with a deposit, and the balance is settled your way.",
  },
  {
    number: "5",
    title: "Move work through the stages",
    body: "Advance each order through your production stages. The customer’s red/yellow/green view updates automatically.",
  },
  {
    number: "6",
    title: "Watch your takings",
    body: "Sales through Xtiitch record themselves; log offline takings by hand. See an honest picture of money coming in, all in one place.",
  },
];

export type TrackStage = {
  label: string;
  customerText: string;
  colour: "red" | "yellow" | "green";
};

// The default bespoke journey from the product definition.
export const bespokeStages: TrackStage[] = [
  { label: "Order received", customerText: "Order received", colour: "red" },
  {
    label: "Being made",
    customerText: "Your outfit is being made",
    colour: "yellow",
  },
  {
    label: "Ready for fitting",
    customerText: "Ready for your fitting",
    colour: "yellow",
  },
  {
    label: "Ready / delivered",
    customerText: "Ready — come for your outfit",
    colour: "green",
  },
];
