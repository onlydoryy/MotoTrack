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
- The function returns make, model, registration year, colour, engine size in cc, fuel type, transmission, body style, door count, seat count, VIN, engine number, and county of registration **only when supplied by the provider**. Unknown values are left blank; zero seat/door counts are treated as missing.
- NCT, motor tax, mileage and exact manufacture date are **not** inferred. VIN and engine number may be returned when explicitly provided by the upstream service.
- A successful provider lookup may consume a paid credit. Add server-side rate limiting and budget protections before opening this to unrestricted users.
- The app still stores its vehicle records locally unless migrated separately.
- This integration has not been tested against live provider credentials. The XML endpoint is documented by the provider, but functionality and account permissions must still be verified.

## Updating an existing deployment
When the Edge Function source changes, redeploy `vehicle-lookup` from the GitHub feature branch in Supabase. Reload MotoTrack after pulling the branch. Existing localStorage vehicle records are migrated with empty strings for the new fields; no lookup is silently triggered for stored vehicles.

## NCT and motor tax checks
The existing Motor Tax and NCT status tiles above Vehicle Info contain compact official check links and inline expiry-date editors. For cars, the NCT checker opens https://www.ncts.ie/check-nct-due-date/; motor tax checks open https://www.motortax.ie/OMT/. The user enters the registration on the official website, then optionally saves the expiry date directly in the existing status tile. The app does not scrape these sites or claim the locally stored date is a real-time legal status. Commercial vehicles and motorcycles may require different roadworthiness-test rules, so no car NCT link is shown for those categories.

### Quick smoke test
- Open a vehicle profile for a car; check that the two official links are inside the existing Motor Tax and NCT status tiles; there must be no duplicate NCT & Motor Tax section.
- Edit each expiry date within its tile, save, and refresh; the new dates should remain and the tile status indicators update.
- Cancel an edit and confirm saved dates are unchanged.
- Test a motorcycle: motor tax link remains available, and car NCT link is absent.
- Confirm older records retain their saved dates. No API credits should be used by clicking the new status links.

## Organising vehicle documents
Each vehicle has independent user-defined document folders (for example, **NCT Reports**, **Insurance** or **Invoices**). Create, rename or delete a folder in the Documents tab; deleting a folder moves all its document records to **Unfiled** instead of deleting them. Each filename can be moved between folders with the **Move to** menu. Unfiled holds all previously saved documents, so older records remain visible. A folder and its contents are saved in the existing browser localStorage vehicle record.

**Important:** As before, the Documents tab stores only document names and dates, **not the underlying PDF/image data**. Adding a file does not back up its contents. Supabase Storage file upload/download and related access policies will be a future feature.

### Folder smoke test
- Create a folder called NCT Reports and add a document name while inside it.
- Create another folder; move a document from NCT Reports to the other folder.
- Rename a folder, refresh, and verify names, membership and existing vehicles.
- Delete a folder containing entries; confirm its entries reappear under Unfiled.
- Remove an entry and confirm other document records remain intact.
