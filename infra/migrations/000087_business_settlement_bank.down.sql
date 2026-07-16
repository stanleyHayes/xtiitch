alter table businesses
  drop column if exists settlement_momo_verified_at;

alter table businesses
  drop column if exists settlement_bank;
