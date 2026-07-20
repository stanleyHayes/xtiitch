-- Partial reverse of 000114: flips the customers.phone storage convention back
-- from canonical 233XXXXXXXXX to the local 0XXXXXXXXX form the pre-migration
-- code wrote, and does the same for outstanding OTP challenge rows.
--
-- NOT reversed (unknowable): merged duplicate customers stay merged — the
-- deleted loser rows and their original phone strings were not retained, and
-- dependent rows re-pointed to the surviving customer stay re-pointed (the
-- same convention as the one-way data fixes in 000057 and 000093). Restoring
-- the string form cannot resurrect those identities, and must not: re-pointed
-- orders belong to the survivor regardless of how its phone is spelled.
select set_config('xtiitch.bypass', 'on', false);

update customers
set phone = '0' || substring(phone from 4)
where phone ~ '^233[0-9]{9}$';

update customer_otp_challenges
set phone = '0' || substring(phone from 4)
where phone ~ '^233[0-9]{9}$';

select set_config('xtiitch.bypass', 'off', false);
