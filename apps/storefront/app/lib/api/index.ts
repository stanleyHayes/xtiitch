export * from "./types";
export { enc, getJSON, postJSON } from "./core";

import * as catalogue from "./catalogue";
import * as checkout from "./checkout";
import * as custom from "./custom";
import * as rewards from "./rewards";
import { tracking } from "./tracking";
import { joinWaitlist } from "./waitlist";

export const api = {
  store: catalogue.store,
  design: catalogue.design,
  collection: catalogue.collection,
  search: catalogue.search,
  availability: catalogue.availability,
  shops: catalogue.shops,
  sponsored: catalogue.sponsored,
  tracking,
  referral: rewards.referral,
  recordAffiliateClick: rewards.recordAffiliateClick,
  placeOrder: checkout.placeOrder,
  placeCartOrder: checkout.placeCartOrder,
  checkoutQuote: checkout.checkoutQuote,
  deliveryZones: checkout.deliveryZones,
  placeCustomOrder: custom.placeCustomOrder,
  placeBooking: custom.placeBooking,
  joinWaitlist,
};
