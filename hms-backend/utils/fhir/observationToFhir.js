const STATUS_MAP = {
  'Pending Review':     'preliminary',
  'Results Reviewed':   'final',
  'Requires Follow-up': 'final',
};

function observationToFhir(row) {
  return {
    resourceType: 'Observation',
    id: String(row.result_id),
    status: STATUS_MAP[row.status] ?? 'unknown',
    code: { text: row.test_name },
    subject: { reference: `Patient/${row.patient_id}` },
    valueString: row.result_data,
    effectiveDateTime: row.order_date,
    issued: row.reviewed_at ?? undefined,
  };
}

module.exports = { observationToFhir };
