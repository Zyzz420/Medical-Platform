# Data Breach Response Procedure — Busia HealthCare HMS
*Draft — 17 August 2026*

This is a first draft to close the "data breach response process" gap flagged in `COMPLIANCE_REQUIREMENTS.md` §6.3 and `SHA_DHA_INTEGRATION_ROADMAP.md`. It needs sign-off from the facility owner and DPO (Venrose Nabwire Okado) before it's the operative procedure — treat it as a starting point to edit, not a finished policy.

**Legal basis:** Kenya Data Protection Act, 2019 requires notification to the ODPC within **72 hours** of the controller becoming aware of a breach (§43), and notification to affected data subjects where the breach is likely to cause harm.

---

## 1. What counts as a reportable breach

Any confirmed or reasonably suspected: unauthorized access to, disclosure of, loss of, or alteration of patient data (names, medical records, national ID / SHA numbers, lab results, prescriptions, consent records) — whether caused by an external attacker, a staff member acting outside their role, a lost/stolen device, or a system misconfiguration (e.g. an exposed database, leaked credentials, a broken access control).

Includes near-misses worth logging even if not reportable (e.g. a caught phishing attempt) — these inform whether a pattern is emerging.

## 2. Detection sources

- Audit log anomalies (`audit_log` table — unusual volume of reads/exports by one account, access outside working hours, access to patients outside a role's normal scope).
- Supabase/hosting-provider security alerts.
- Staff report ("I think I clicked something" / "this laptop was stolen" / "I noticed X in the system I shouldn't be able to see").
- Patient or third-party report.

**Gap:** there is currently no automated alerting on audit-log anomalies (`COMPLIANCE_REQUIREMENTS.md` §6.4) — detection today is manual/reactive. Recommend this as a near-term technical follow-up, not blocking this procedure from being adopted.

## 3. Immediate response (first 24 hours from detection)

| Step | Action | Owner |
|---|---|---|
| 1 | Whoever detects/suspects a breach notifies the DPO (Venrose Nabwire Okado) and facility owner immediately — do not wait to confirm severity first. | Anyone |
| 2 | DPO opens an incident record: what happened, when discovered, systems/data affected (use the checklist in §4). | DPO |
| 3 | Contain: revoke/rotate any compromised credentials, disable the affected account(s), and — if it's a code-level exposure — involve the dev team to patch and confirm the hole is closed. | DPO + dev team |
| 4 | Preserve evidence: pull the relevant `audit_log` rows and any server/hosting logs for the affected window before they age out or get overwritten. | Dev team |
| 5 | Assess scope: which patients, which data fields, how many records, whether data left the facility's control (viewed vs. exfiltrated). | DPO + dev team |

## 4. Assessment checklist (fill in per incident)

- Date/time of the breach (or best estimate) vs. date/time of discovery — **the 72-hour clock starts at discovery, not at the breach itself.**
- What data was involved (which tables/fields — flag if national ID, SHA number, or clinical notes were exposed, since these carry higher notification urgency).
- How many patients affected.
- Root cause (credential compromise, misconfiguration, insider access, lost device, vendor/third-party).
- Is the exposure ongoing or contained?
- Is there evidence of actual misuse, or only potential exposure?

## 5. Notification

| Recipient | Trigger | Timeline | Owner |
|---|---|---|---|
| ODPC | Any breach likely to result in risk to patients' rights/freedoms | Within **72 hours** of discovery (DPA 2019 §43) | DPO |
| Affected patients | Where the breach is likely to cause harm (identity theft, discrimination, physical/financial/reputational harm) | Without undue delay, once scope is known | DPO, facility owner sign-off on messaging |
| Facility owner / board | Every reportable incident | Immediately on detection (§3, step 1) | DPO |
| SHA/DHA (once integration is live) | If SHA-sourced beneficiary data is affected | Per SHA/DHA's own incident-reporting terms once published — not yet defined; follow up when the integration contract is signed | Facility owner |

If 72 hours will genuinely be missed (e.g. scope still being assessed), DPA 2019 practice is to notify ODPC with what's known so far and follow up with detail — do not wait for a complete picture before making initial contact.

## 6. Post-incident

- Written incident report: timeline, root cause, data affected, notifications sent, remediation taken.
- Remediation follow-through: confirm the underlying gap (code fix, access-control change, training) is actually closed, not just the immediate symptom.
- Review whether this procedure itself needs updating based on what was learned.

## 7. Open items before this procedure is final

- **Who exactly is authorized to declare an incident "contained" / notify ODPC** — recommend DPO primary, facility owner as backup, needs owner sign-off.
- **Automated anomaly alerting** (§6.4) — not yet built; today's detection is manual.
- **SHA/DHA-specific breach terms** — not yet known; the integration isn't live yet, so this section is a placeholder.
- **Contact details** — ODPC notification channel/portal and internal escalation phone tree need to be filled in here once confirmed.

---

*Cross-references: `COMPLIANCE_REQUIREMENTS.md` §6, `SHA_DHA_INTEGRATION_ROADMAP.md` (B2 checklist).*
