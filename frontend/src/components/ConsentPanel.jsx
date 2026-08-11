import { useEffect, useState } from 'react'
import { getPatientConsents, createConsent, withdrawConsent } from '../api/consent'
import Modal from './common/Modal'

const CONSENT_TYPES = [
  { value: 'TREATMENT',       label: 'Treatment' },
  { value: 'DATA_PROCESSING', label: 'Data Processing' },
  { value: 'RESEARCH',        label: 'Research' },
]

// Consent records satisfy Data Protection Act, 2019 consent-management requirements.
export default function ConsentPanel({ patientId, canCreate, canWithdraw }) {
  const [consents, setConsents] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  const [showModal, setShowModal]     = useState(false)
  const [consentType, setConsentType] = useState('TREATMENT')
  const [version, setVersion]         = useState('1.0')
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')

  const [withdrawingId, setWithdrawingId] = useState(null)

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    getPatientConsents(patientId)
      .then((res) => setConsents(res.data))
      .catch(() => setError('Failed to load consent records.'))
      .finally(() => setLoading(false))
  }, [patientId])

  function openCreate() {
    setConsentType('TREATMENT')
    setVersion('1.0')
    setFormError('')
    setShowModal(true)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const res = await createConsent({ patient_id: patientId, consent_type: consentType, version })
      setConsents((prev) => [res.data, ...prev])
      setShowModal(false)
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Failed to record consent.')
    } finally {
      setSaving(false)
    }
  }

  async function handleWithdraw(id) {
    setWithdrawingId(id)
    setError('')
    try {
      const res = await withdrawConsent(id)
      setConsents((prev) => prev.map((c) => (c.id === id ? res.data : c)))
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to withdraw consent.')
    } finally {
      setWithdrawingId(null)
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Consent given under the Data Protection Act, 2019.</p>
        {canCreate && (
          <button onClick={openCreate} className="btn-primary text-sm">+ Record consent</button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {consents.length === 0 ? (
        <div className="card">
          <p className="px-5 py-8 text-center text-gray-400 text-sm">No consent records on file.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Type', 'Version', 'Recorded', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {consents.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {CONSENT_TYPES.find((t) => t.value === c.consent_type)?.label ?? c.consent_type}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.version}</td>
                  <td className="px-4 py-3 text-gray-500">{c.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    {c.withdrawn_at ? (
                      <span className="badge bg-gray-100 text-gray-500">Withdrawn {c.withdrawn_at.slice(0, 10)}</span>
                    ) : (
                      <span className="badge bg-green-100 text-green-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWithdraw && !c.withdrawn_at && (
                      <button
                        onClick={() => handleWithdraw(c.id)}
                        disabled={withdrawingId === c.id}
                        className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {withdrawingId === c.id ? 'Withdrawing…' : 'Withdraw'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Record Consent">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="form-label">Consent type</label>
            <select className="form-select" value={consentType} onChange={(e) => setConsentType(e.target.value)}>
              {CONSENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Policy version</label>
            <input className="form-input" value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{formError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Record consent'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
