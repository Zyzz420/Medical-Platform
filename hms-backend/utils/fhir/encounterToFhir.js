// FHIR R4 Encounter.status has no distinct "no-show" value, so it maps to cancelled.
const STATUS_MAP = {
  Scheduled: 'planned',
  Completed: 'finished',
  Cancelled: 'cancelled',
  'No-Show': 'cancelled',
};

function encounterToFhir(row) {
  return {
    resourceType: 'Encounter',
    id: String(row.appointment_id),
    status: STATUS_MAP[row.status] ?? 'unknown',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    subject: { reference: `Patient/${row.patient_id}` },
    participant: [{ individual: { reference: `Practitioner/${row.doctor_id}` } }],
    period: { start: row.appointment_datetime },
    reasonCode: row.reason ? [{ text: row.reason }] : undefined,
  };
}

module.exports = { encounterToFhir };
