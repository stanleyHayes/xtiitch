-- Right-to-erasure support (Data Protection Act, 2012 / Act 843). erased_at marks
-- a customer whose personal data has been anonymised platform-wide. Order and
-- payment records are retained for accounting/tax obligations; they reference the
-- customer by opaque UUID only, so they carry no personal data after erasure.

alter table customers
    add column if not exists erased_at timestamptz;
