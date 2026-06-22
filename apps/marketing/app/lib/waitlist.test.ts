import assert from "node:assert/strict";
import test from "node:test";
import { parseWaitlist } from "./waitlist";

function waitlistForm(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

test("parseWaitlist accepts a valid consented lead", () => {
  const result = parseWaitlist(
    waitlistForm({
      website: "",
      name: "  Ama  ",
      business: "Ama Stitch House",
      phone: "0240000000",
      email: "",
      city: "Accra",
      message: "Bespoke womenswear",
      consent: "on",
    }),
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.values.name, "Ama");
    assert.equal(result.values.business, "Ama Stitch House");
  }
});

test("parseWaitlist requires contact consent", () => {
  const result = parseWaitlist(
    waitlistForm({
      website: "",
      name: "Ama",
      business: "Ama Stitch House",
      phone: "0240000000",
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.errors.consent,
      "Please confirm that Xtiitch can contact you about onboarding.",
    );
  }
});

test("parseWaitlist requires a town or city", () => {
  const result = parseWaitlist(
    waitlistForm({
      website: "",
      name: "Ama",
      business: "Ama Stitch House",
      phone: "0240000000",
      consent: "on",
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.city, "Please enter your town or city");
  }
});

test("parseWaitlist rejects filled honeypot submissions", () => {
  const result = parseWaitlist(
    waitlistForm({
      website: "https://spam.example",
      name: "Ama",
      business: "Ama Stitch House",
      phone: "0240000000",
      consent: "on",
    }),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.errors.website,
      "Something went wrong. Please try again.",
    );
  }
});
