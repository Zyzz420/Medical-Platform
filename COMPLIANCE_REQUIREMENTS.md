# Compliance Requirements — HMS

This document lists what we need to confirm with the client before the platform goes into production. Nothing here is assumed; every item is a question that must be answered and signed off.

---

## 1. Jurisdiction & Governing Law

| # | Question | Client Answer |
|---|---|---|
| 1.1 | Which country and county/state is the facility registered in? | |
| 1.2 | Is the facility licensed under the Kenya Health Act (Cap. 242) or a facility-type-specific statute (e.g. private hospital, clinic, nursing home)? | |
| 1.3 | Is the facility subject to the **Kenya Data Protection Act, 2019** (DPA 2019) and its regulations? | |
| 1.4 | Are there county-level health bylaws that impose additional requirements? | |
| 1.5 | Does the facility handle data for patients from other jurisdictions (e.g. foreign nationals) that may trigger GDPR or other foreign law? | |

---

## 2. Health Records Retention

The current system **permanently deletes** patient profiles and appointment records when an admin clicks Delete. This must change before go-live.

| # | Question | Client Answer |
|---|---|---|
| 2.1 | What is the minimum retention period for patient health records? *(Kenya MoH guideline suggests 5 years for adults, longer for minors — confirm the exact requirement with the facility's legal/compliance officer.)* | **6 years**, per facility's legal requirement, before archiving or discard/deletion (confirmed by facility owner, 11 Aug 2026). |
| 2.2 | Should the retention clock start from the **last visit date** or **date of record creation**? | Not yet specified — recommend confirming with facility; default to last visit / last clinical activity date unless told otherwise. |
| 2.3 | For deceased patients, does the retention period change? | Not yet specified — follow up. |
| 2.4 | For minors: should records be retained until the patient reaches majority plus the standard retention period? | Not yet specified — follow up. |
| 2.5 | After the retention period expires, is **permanent erasure** required, or should records be archived (anonymised/pseudonymised)? | Both — records are archived, then discarded/deleted after the 6-year period (facility owner's wording implies archive first, deletion follows). |
| 2.6 | Who in the facility is authorised to trigger permanent deletion after the retention period? | Not yet specified — follow up; recommend this be the DPO (Venrose Nabwire Okado) or facility owner only. |

**Current gap:** Patient deletion is a hard delete. We will replace this with a soft-delete / deactivation model where:
- The patient record is flagged `deactivated_at` and hidden from normal workflows.
- All linked clinical data (appointments, medical records, lab orders, prescriptions) is retained.
- True purge is gated behind a separate admin action and is only unlocked after the retention period.

---

## 3. Patient Rights (Data Subject Rights under DPA 2019)

| # | Question | Client Answer |
|---|---|---|
| 3.1 | Does the facility need a process for **Subject Access Requests** (patients requesting a copy of all their data)? | |
| 3.2 | Does the facility need to support **Right to Rectification** (patients requesting correction of inaccurate data)? | |
| 3.3 | Does the facility have a process for **Right to Erasure** requests, and does the retention obligation override it? | |
| 3.4 | Within what timeframe must Subject Access Requests be fulfilled? *(DPA 2019 default: 21 days)* | |
| 3.5 | Should patients be able to export their records from within the app (PDF, CSV)? | |

---

## 4. Access Control & Role Definitions

| # | Question | Client Answer |
|---|---|---|
| 4.1 | Confirm the role list is complete: admin, receptionist, doctor, nurse, pharmacist, lab_technician, patient. Any missing roles? | |
| 4.2 | Should any role be restricted to read-only access to specific wards / departments? | |
| 4.3 | Should doctors only see patients assigned to them, or all patients? | |
| 4.4 | Are there records that should be accessible only to the treating doctor (e.g. psychiatric notes)? | |
| 4.5 | Should patient login access to their own records be enabled at launch or phased in later? | |

---

## 5. Audit Trail

The system currently logs READ, CREATE, UPDATE, and DELETE on clinical records. Confirm scope:

| # | Question | Client Answer |
|---|---|---|
| 5.1 | Is the current audit log scope (medical records, lab orders, lab results, prescriptions) sufficient, or should it extend to patient profiles and appointments? | |
| 5.2 | How long must audit logs be retained? *(Recommend minimum 3 years; Kenya DPA does not specify but regulators may request them during an investigation.)* | |
| 5.3 | Who can view the audit log? Admin only, or also the facility's compliance officer? | |
| 5.4 | Must the audit log be tamper-proof (append-only, off-system backup)? | |

---

## 6. Data Breach & Incident Response

| # | Question | Client Answer |
|---|---|---|
| 6.1 | Has the facility appointed a **Data Protection Officer (DPO)** as required by DPA 2019 for healthcare data controllers? | **Yes** — Venrose Nabwire Okado (confirmed by facility owner, 11 Aug 2026). |
| 6.2 | Is the facility registered with the **Office of the Data Protection Commissioner (ODPC)** Kenya? | **Yes**, Busia HealthCare facility is registered with the ODPC (confirmed by facility owner, 11 Aug 2026). |
| 6.3 | What is the internal escalation path when a breach is detected? *(DPA 2019 requires notification to ODPC within 72 hours of becoming aware of a breach.)* | |
| 6.4 | Should the system provide automated alerts (email/SMS) to the DPO when suspicious access patterns are detected? | |

---

## 7. Consent Management

| # | Question | Client Answer |
|---|---|---|
| 7.1 | Is written patient consent obtained at registration? Is it recorded in the system or on paper? | |
| 7.2 | Should the system capture and store consent records digitally (consent type, date, version)? | |
| 7.3 | Are there specific consent categories required (e.g. treatment consent, data processing consent, research consent)? | |
| 7.4 | Can patients withdraw consent, and what happens to their data if they do? | |

---

## 8. Data Storage & Infrastructure

| # | Question | Client Answer |
|---|---|---|
| 8.1 | Where is the database hosted? *(Kenya DPA 2019 Section 50 restricts transfer of personal data outside Kenya unless adequate protections exist.)* | **Facility owner's answer (11 Aug 2026): "Busia HealthCare's facility data is kept in our Local Area Network (LAN) Server and external hard drives."** ⚠️ **Conflicts with the current codebase**: commit `71ed40a` ("Migrate database to Supabase") shows the HMS application database was migrated to **Supabase** (a managed cloud Postgres provider, project ref `ynujeyytdqazmdyolyds`), not an on-prem LAN server. Supabase projects are hosted on AWS infrastructure in a region chosen at project creation — this needs to be confirmed and is very unlikely to be Kenya. **This is a live DPA 2019 §50 cross-border transfer question and must be resolved before DHA submission**, not just documented: either (a) the LAN/hard-drive answer describes a legacy or backup arrangement and the facility owner needs to be told the live system now runs in the cloud, or (b) hosting needs to move back in-country, or (c) adequate safeguards (SCCs, DPA-recognised adequacy, ODPC-approved transfer mechanism) need to be put in place for the Supabase region in use. **Action: confirm Supabase project region and get facility owner sign-off on whether cloud hosting is acceptable before DHA certification is submitted.** |
| 8.2 | Is data encrypted at rest? | **Yes.** Supabase encrypts all Postgres data at rest with AES-256 by default (database files, indexes, and WAL), always on, not configurable off; daily backups are also encrypted. Source: [Supabase — Securing your data](https://supabase.com/docs/guides/database/secure-data), [Supabase Security](https://supabase.com/security). This satisfies the "written citation" action item — still contingent on resolving 8.1 (whether Supabase is the sanctioned hosting location at all). |
| 8.3 | Is data encrypted in transit? *(Currently: yes — HTTPS enforced via Vercel.)* | |
| 8.4 | What is the backup frequency and retention period for database backups? | |
| 8.5 | Is there a tested disaster recovery plan and RTO/RPO target? | |

---

## 9. Interoperability & Reporting

| # | Question | Client Answer |
|---|---|---|
| 9.1 | Does the facility report to the Kenya Health Information System (**KHIS / DHIS2**)? If yes, which datasets? | |
| 9.2 | Are there Kenya Medical Research Institute (KEMRI) or county health department reporting obligations? | |
| 9.3 | Should the system generate MOH facility reports (e.g. MOH 705A/B outpatient registers)? | |
| 9.4 | Will the system need to integrate with the National Hospital Insurance Fund (**NHIF**) or SHA claims portal? | |
| 9.5 | Is HL7 FHIR or any other interoperability standard required? | |

---

## 10. Specific Facility Certifications

| # | Question | Client Answer |
|---|---|---|
| 10.1 | Is the facility pursuing or holding any ISO certification (e.g. ISO 27001 for information security)? | |
| 10.2 | Are there accreditation body requirements (e.g. Kenya Accreditation Service, SAAS) that impose IT system requirements? | |
| 10.3 | Does the facility conduct clinical research? If yes, are there IRB/ISERC requirements affecting record retention? | |

---

## Current System Compliance Status

| Area | Status | Notes |
|---|---|---|
| Clinical record soft-delete | Compliant | `deleted_records` table; medical records, lab orders, lab results, prescriptions are soft-deleted |
| Patient profile retention | Compliant (as of `b5027aa`) | Now soft-deletes via `deleted_at` + deactivates linked user, instead of hard delete |
| Appointment retention | Compliant (as of `b5027aa`) | Now soft-deletes via `deleted_at` instead of hard delete |
| Audit log | Improved, still partial | Now covers patient CRUD + reads, appointment CRUD, password resets (`b5027aa`). Still does not cover lab/prescription reads or login events |
| Encryption in transit | Compliant | HTTPS via Vercel; DB connection now SSL (`ssl: true` for Supabase, per `db.js`) |
| Encryption at rest | Compliant (cited) | Supabase AES-256 at rest, confirmed via official docs — see §8.2. Still contingent on §8.1 hosting-location resolution |
| Access control (RBAC) | Compliant | 7 roles with route-level enforcement |
| Data breach process | Drafted, needs sign-off | `DATA_BREACH_RESPONSE_PROCEDURE.md` drafted 17 Aug 2026; no automated anomaly alerting yet (manual detection only); needs DPO/owner sign-off |
| Retention enforcement | Identification built, purge not built | `GET /api/patients/retention/review` (admin-only) flags patients past the 6-year mark for manual DPO review; does not auto-archive or auto-delete — §2.2-2.4, §2.6 policy questions still open |
| Consent management | **In progress (uncommitted)** | `consentController.js`, `consent_records` table, `ConsentPanel.jsx` exist on disk but are not yet committed or verified — see code audit |
| ODPC registration | **Confirmed — registered** | Facility owner confirmed 11 Aug 2026 |
| DPO appointed | **Confirmed — Venrose Nabwire Okado** | Facility owner confirmed 11 Aug 2026 |
| Retention period | **Confirmed — 6 years** | Facility owner confirmed 11 Aug 2026; enforcement (retention clock + gated purge) is **not yet implemented** |
| Data hosting location | **Answered but conflicts with codebase** | Owner says LAN + external hard drives; `db.js`/`.mcp.json` show the live DB is on Supabase (cloud). Needs reconciliation — see §8.1 |
| HL7 FHIR layer | **In progress (uncommitted)** | `fhirController.js`, `fhirRoutes.js`, `utils/fhir/`, `fhir.test.js` exist on disk — see code audit for what's actually implemented |

---

## Immediate Actions Required (Before Go-Live)

1. ~~Soft-delete patients and appointments~~ — **done** (`b5027aa`).
2. ~~Confirm retention period with client's legal/compliance officer~~ — **done**: 6 years (11 Aug 2026). Still need: retention clock start date (2.2), deceased/minor rules (2.3–2.4), enforcement mechanism (2.6).
3. ~~Extend audit log to cover patient profile reads and appointment changes~~ — **done** (`b5027aa`). Still open: lab/prescription reads, login events.
4. **Reconcile data hosting location** — owner says LAN/external hard drives, codebase shows Supabase cloud DB. Resolve before DHA submission (§8.1).
5. ~~Confirm ODPC registration status and appoint DPO~~ — **done**: registered, DPO is Venrose Nabwire Okado (11 Aug 2026).
6. ~~Define and document the breach response procedure~~ — **drafted** 17 Aug 2026, `DATA_BREACH_RESPONSE_PROCEDURE.md`. Needs DPO/owner sign-off before it's operative.
7. **Retention-period enforcement — partially built** (17 Aug 2026): `GET /api/patients/retention/review` (admin-only) identifies patients past the 6-year mark for manual review. Deliberately stops short of auto-archive/auto-purge — §2.2-2.4 (clock start, deceased/minors) and §2.6 (who's authorized to purge) are still open and need an answer before any automated deletion is built.
8. ~~Finish and verify consent management and FHIR layer~~ — **done and committed** (`af39862`, 67/67 tests passing as of 17 Aug 2026, including a widened FHIR auth test).
9. **Obtain client sign-off** on this document before go-live / DHA submission.
10. **Verify production database schema state** — **could not be verified 17 Aug 2026**: the Supabase MCP connection and direct DNS resolution to the project host (`ynujeyytdqazmdyolyds.supabase.co`) both failed this session (see `SHA_DHA_TESTING_READINESS.md` update). The same table-ownership bug was reproduced against a local dev database, confirming the mechanism is real, but production column state (`national_id`/`sha_number`) is unconfirmed and needs to be checked directly in the Supabase dashboard.

---

*Document version: 1.1 — 11 Aug 2026. Updated with facility owner's answers on retention period, DPO, ODPC registration, and data hosting; status table reconciled against `b5027aa` and current uncommitted changes.*
