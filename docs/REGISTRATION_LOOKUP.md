# Irish registration lookup (feature branch)

MotoTrack's **Add Vehicle** screen can now request an Irish number-plate lookup using a Supabase Edge Function. The user confirms/edit results before saving. Manual entry remains available.

## Set up provider
1. Create a trial account at https://www.carregistrationapi.ie/ (10 trial credits advertised).
2. Use your trial account username. The documented HTTP/XML `CheckIreland` endpoint requires a username only; no REST API key is needed.
3. In the Supabase project, configure Edge Function secrets `REGCHECK_USERNAME`. **Do not place the username in a `VITE_` variable or frontend code.**
4. Deploy `supabase/functions/vehicle-lookup/index.ts` as the Edge Function named `vehicle-lookup`, with JWT verification enabled.
5. Sign into MotoTrack and try a known Irish plate. Confirm data before saving. Missing fields remain editable.
6. Test unknown registration, bad input, no credits, and unavailable service. All should allow manual entry.

## Notes
- The function returns make, model, year, and colour if supplied by the provider. Colour may be empty.
- NCT, tax, VIN, mileage and exact manufacture date are **not** inferred.
- A successful provider lookup may consume a paid credit. Add server-side rate limiting and budget protections before opening this to unrestricted users.
- The app still stores its vehicle records locally unless migrated separately.
- This integration has not been tested against live provider credentials. The XML endpoint is documented by the provider, but functionality and account permissions must still be verified.
