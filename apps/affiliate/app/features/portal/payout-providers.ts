export const MOBILE_MONEY_PROVIDERS = [
  "MTN MoMo",
  "Telecel Cash",
  "AT Money",
] as const;

// Paystack's current Ghana GIP-supported institution list. The field remains an
// autocomplete rather than a closed select so a newly-supported institution
// does not strand an affiliate before this list is refreshed.
export const BANK_PROVIDERS = [
  "Absa Bank Ghana Ltd",
  "Access Bank",
  "ADB Bank Limited",
  "Adehyeman Savings and Loans LTD",
  "Affinity Ghana Savings and Loans",
  "ARB Apex Bank",
  "Bank of Africa Ghana",
  "Bank of Ghana",
  "Best Point Savings & Loans",
  "CAL Bank Limited",
  "Consolidated Bank Ghana Limited",
  "Ecobank Ghana Limited",
  "FBNBank Ghana Limited",
  "Fidelity Bank Ghana Limited",
  "First Atlantic Bank Limited",
  "First National Bank Ghana Limited",
  "GCB Bank Limited",
  "Guaranty Trust Bank (Ghana) Limited",
  "National Investment Bank Limited",
  "OmniBSCI Bank",
  "Prudential Bank Limited",
  "Republic Bank (GH) Limited",
  "Services Integrity Savings and Loans",
  "Sinapi ABA Savings And Loans",
  "Société Générale Ghana Limited",
  "Stanbic Bank Ghana Limited",
  "Standard Chartered Bank Ghana Limited",
  "United Bank for Africa Ghana Limited",
  "Universal Merchant Bank Ghana Limited",
  "Zenith Bank Ghana",
] as const;
