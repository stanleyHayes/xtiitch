import { enc, postJSON, type TenantScope } from "./core";

export const joinWaitlist = (
  storeHandle: string,
  designHandle: string,
  input: { customer_name: string; customer_contact: string; note: string },
  tenant?: TenantScope,
) =>
  postJSON<{ status: string }>(
    `/public/stores/${enc(storeHandle)}/designs/${enc(designHandle)}/waitlist`,
    input,
    tenant,
  );
