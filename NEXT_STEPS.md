# Next Steps
*Busia HealthCare HMS — 11 August 2026*

Snapshot of what's actually outstanding right now, after the compliance answers were recorded and the consent/FHIR/SAR work was committed (`af39862`). Ordered by what should happen first.

---

## Urgent — do this regardless of the DHA timeline

### 1. Apply the missing database migration as the Supabase table owner
`national_id` and `sha_number` were added to `patients` in code (registration, profile edit, FHIR layer) but the migration that creates those columns has been silently failing on every server start — the app's Supabase role doesn't own the `patients` table. The test suite confirmed the columns don't exist in production as of this review.

**Action:** Open the Supabase SQL editor (or connect with the table-owner/`postgres` role) and run `hms-backend/database/migration_sha_dha_compliance.sql` by hand. While there, also re-check that the earlier soft-delete migration (`deleted_at` on `patients`) actually applied — same ownership problem was logged for it.

**Why it's urgent:** until this runs, patient registration and profile updates are likely erroring in production right now, independent of anything SHA/DHA-related.

---

## Blocking a clean DHA submission

### 2. Resolve the data-hosting conflict with the facility owner
You told us data lives on the LAN server and external hard drives. The codebase shows the live database was migrated to Supabase (cloud) in commit `71ed40a`. These can't both be the answer DHA gets. Find out whether the LAN/hard-drive answer describes a legacy/backup arrangement, or whether hosting genuinely needs to move — then update `COMPLIANCE_REQUIREMENTS.md` §8.1 with the real, single answer.

### 3. Decide on `/fhir/metadata` auth
It currently requires an admin JWT to read at all. FHIR `CapabilityStatement` is conventionally open so external conformance-testing tools can discover the API before authenticating — worth checking against what DHA's tooling actually expects before certification testing starts.

---

## Needed to finish the compliance work

### 4. Build retention enforcement
The 6-year retention period is now confirmed, but there's no retention clock or scheduled archive/purge job yet. Still open sub-questions: does the clock start at last visit or record creation, and do deceased patients/minors change it (`COMPLIANCE_REQUIREMENTS.md` §2.2–2.4).

### 5. Draft the data breach response procedure
Currently manual/undocumented. DPA 2019 requires ODPC notification within 72 hours of detection — this is a process/documentation task, not code, and can happen in parallel with anything above.

### 6. Get a written citation for encryption at rest
Supabase encrypts at rest by default, but the DHA application will want a citable source, not an assumption — pull it from Supabase's own compliance/security docs.

---

## Housekeeping

### 7. Commit or discard the remaining uncommitted files
Still sitting untracked/modified in the working tree:
- `COMPLIANCE_REQUIREMENTS.md` (modified — has today's answers)
- `MEMO_TO_FACILITY_OWNER.md`, `SHA&DHA.md`, `SHA_DHA_ACCESS_GUIDE.md`, `SHA_DHA_INTEGRATION_ROADMAP.md`, `SHA_DHA_INTEGRATION_STEPS.md`, `SHA_DHA_TESTING_READINESS.md`

These are documentation, left out of the code commit deliberately — say if you want them committed too.

### 8. Push `af39862` (and any doc commits) once you're ready
Nothing has been pushed to a remote yet — everything so far is local.

---

## Not blocked on the codebase — Track A (facility owner, in parallel)

- Retry SHA registration at portal.sha.go.ke using **your own** National ID (not a staff member's).
- If denied again, verify ID/DOB/phone match IPRS exactly (Huduma Centre or `*147#`).
- If still denied, call SHA support (147) with the facility's MFL code, registered email, and exact login name.

See `MEMO_TO_FACILITY_OWNER.md` for the full detail on this track — it doesn't block anything above.

---

*Cross-references: `SHA_DHA_TESTING_READINESS.md` (fuller detail on each item), `COMPLIANCE_REQUIREMENTS.md`, `SHA_DHA_INTEGRATION_ROADMAP.md`.*
