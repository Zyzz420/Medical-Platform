// Wraps a list of FHIR resources in a standard R4 searchset Bundle.
function toBundle(resources, total) {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: total ?? resources.length,
    entry: resources.map((resource) => ({ resource })),
  };
}

module.exports = { toBundle };
