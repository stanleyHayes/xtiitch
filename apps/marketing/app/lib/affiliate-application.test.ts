import assert from "node:assert/strict";
import test from "node:test";
import { parseAffiliateApplication } from "./affiliate-application";

function validApplication(): FormData {
  const form = new FormData();
  form.set("company_url", "");
  form.set("applicant_type", "person");
  form.set("display_name", "Ama Creates");
  form.set("contact_name", "Ama Mensah");
  form.set("email", "ama@example.com");
  form.set("phone", "+233200000000");
  form.set("website_url", "https://example.com/ama");
  form.set("requested_code", "AMACREATES");
  form.set(
    "audience_summary",
    "I create Ghana fashion videos for an active shopping community.",
  );
  form.append("promotion_channels", "instagram");
  form.append("promotion_channels", "whatsapp");
  form.set("consent", "on");
  return form;
}

test("parses a valid affiliate application with all channels", () => {
  const parsed = parseAffiliateApplication(validApplication());

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.values.promotion_channels, [
      "instagram",
      "whatsapp",
    ]);
    assert.equal(parsed.values.requested_code, "AMACREATES");
  }
});

test("rejects a malformed code and missing consent", () => {
  const form = validApplication();
  form.set("requested_code", "bad code");
  form.delete("consent");

  const parsed = parseAffiliateApplication(form);

  assert.equal(parsed.ok, false);
  if (!parsed.ok && !parsed.result.ok) {
    assert.match(parsed.result.errors.requested_code ?? "", /letters/);
    assert.match(parsed.result.errors.consent ?? "", /Confirm/);
  }
});
