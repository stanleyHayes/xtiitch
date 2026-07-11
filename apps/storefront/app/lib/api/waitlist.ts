import { enc, postJSON } from "./core";

export const joinWaitlist = (
  storeHandle: string,
  designHandle: string,
  input: { customer_name: string; customer_contact: string; note: string },
) =>
  postJSON<{ status: string }>(
    `/public/stores/${enc(storeHandle)}/designs/${enc(designHandle)}/waitlist`,
    input,
  );
