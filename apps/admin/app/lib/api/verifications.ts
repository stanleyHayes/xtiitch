import { requestJSON } from "./utils";

export type AdminVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";
export type AdminVerificationDecision = "approved" | "rejected" | "held";
export type AdminRiskLevel = "low" | "medium" | "high";
export type AdminVerificationCase = {
  id: string;
  businessName: string;
  handle: string;
  ownerName: string;
  ownerEmail: string;
  submittedAt: string;
  updatedAt: string;
  plan: string;
  status: AdminVerificationStatus;
  riskLevel: AdminRiskLevel;
  documents: string[];
  checks: string[];
  evidence: string[];
  notes: string;
  idCardNumber: string;
  fullLegalName: string;
  idPhotoURL: string;
  idPhotoBackURL: string;
};

type AdminVerificationCasePayload = {
  business_id: string;
  business_name: string;
  handle: string;
  owner_name: string;
  owner_email: string;
  submitted_at: string;
  updated_at: string;
  plan: string;
  status: AdminVerificationStatus;
  risk_level: AdminRiskLevel;
  documents: string[];
  checks: string[];
  evidence: string[];
  notes: string;
  id_card_number: string;
  full_legal_name?: string;
  id_photo_url: string;
  id_photo_back_url: string;
};
function mapVerificationCase(
  payload: AdminVerificationCasePayload,
): AdminVerificationCase {
  return {
    id: payload.business_id,
    businessName: payload.business_name,
    handle: payload.handle,
    ownerName: payload.owner_name,
    ownerEmail: payload.owner_email,
    submittedAt: payload.submitted_at,
    updatedAt: payload.updated_at,
    plan: payload.plan,
    status: payload.status,
    riskLevel: payload.risk_level,
    documents: payload.documents,
    checks: payload.checks,
    evidence: payload.evidence,
    notes: payload.notes,
    idCardNumber: payload.id_card_number ?? "",
    // §2.3: the name exactly as it appears on the Ghana Card. Rows submitted
    // before this field was collected have no value — the card shows "—".
    fullLegalName: payload.full_legal_name ?? "",
    idPhotoURL: payload.id_photo_url ?? "",
    // Older submissions predate back-photo capture, so this can be empty.
    idPhotoBackURL: payload.id_photo_back_url ?? "",
  };
}

export const verificationsApi = {
  verificationCases: async (accessToken: string) => {
    const payload = await requestJSON<{
      cases: AdminVerificationCasePayload[];
    }>("/admin/business-verifications", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.cases.map(mapVerificationCase);
  },
  decideVerification: (
    accessToken: string,
    businessId: string,
    input: { decision: AdminVerificationDecision; note: string },
  ) =>
    requestJSON<AdminVerificationCasePayload>(
      `/admin/business-verifications/${encodeURIComponent(businessId)}/decision`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ decision: input.decision, note: input.note }),
      },
    ).then(mapVerificationCase),
};
