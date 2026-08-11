import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getMyLabResults } from '../api/labResults'
import { exportPatientData } from '../api/patients'
import ConsentPanel from '../components/ConsentPanel'
import { downloadJSON } from '../utils/download'

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const GENDERS = ['Male', 'Female', 'Other']

const RESULT_STATUS_BADGE = {
  'Pending Review':     'bg-amber-100 text-amber-700',
  'Results Reviewed':   'bg-green-100 text-green-700',
  'Requires Follow-up': 'bg-red-100 text-red-600',
}

export default function MyProfile() {
  const { user, updateProfile } = useAuth()
  const p = user?.profile

  const [tab, setTab]         = useState('profile')
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)

  const [labResults, setLabResults]     = useState([])
  const [labLoading, setLabLoading]     = useState(false)
  const [labError, setLabError]         = useState('')

  const [exporting, setExporting]       = useState(false)
  const [exportError, setExportError]   = useState('')

  async function handleExport() {
    setExporting(true)
    setExportError('')
    try {
      const res = await exportPatientData(p.patient_id)
      downloadJSON(res.data, `my-data-export-${res.data.generated_at.slice(0, 10)}.json`)
    } catch (err) {
      setExportError(err.response?.data?.message ?? 'Failed to export your data.')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    if (tab === 'labs') {
      setLabLoading(true)
      getMyLabResults()
        .then((res) => setLabResults(res.data))
        .catch(() => setLabError('Failed to load lab results.'))
        .finally(() => setLabLoading(false))
    }
  }, [tab])

  function startEdit() {
    setForm({
      first_name:     p?.first_name     ?? '',
      last_name:      p?.last_name      ?? '',
      date_of_birth:  p?.date_of_birth?.slice(0, 10) ?? '',
      gender:         p?.gender         ?? '',
      blood_type:     p?.blood_type     ?? '',
      contact_number: p?.contact_number ?? '',
      address:        p?.address        ?? '',
      national_id:    p?.national_id    ?? '',
      sha_number:     p?.sha_number      ?? '',
    })
    setError('')
    setSuccess(false)
    setEditing(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await updateProfile({
        ...form,
        gender:     form.gender     || null,
        blood_type: form.blood_type || null,
      })
      setEditing(false)
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const f = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }))

  if (!p) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">My Profile</h1>
        <div className="card p-6 text-gray-500 text-sm">
          No patient profile is linked to your account. Please contact reception.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} disabled={exporting} className="btn-secondary disabled:opacity-50">
            {exporting ? 'Exporting…' : 'Export my data'}
          </button>
          {tab === 'profile' && !editing && (
            <button onClick={startEdit} className="btn-secondary">Edit details</button>
          )}
        </div>
      </div>

      {exportError && <p className="text-sm text-red-600 mb-4">{exportError}</p>}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'profile', label: 'Profile' },
          { key: 'labs',    label: 'Lab Results' },
          { key: 'consent', label: 'Consent' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-purple-700 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'labs' && (
        <div>
          {labLoading && <p className="text-gray-500 text-sm">Loading…</p>}
          {labError  && <p className="text-red-600 text-sm">{labError}</p>}
          {!labLoading && !labError && labResults.length === 0 && (
            <p className="text-gray-400 text-sm">No lab results on file yet.</p>
          )}
          {!labLoading && labResults.length > 0 && (
            <div className="card overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Test', 'Result', 'Status', 'Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {labResults.map((r) => (
                    <tr key={r.result_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.test_name}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs whitespace-pre-wrap">{r.result_data}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_STATUS_BADGE[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'consent' && (
        <ConsentPanel patientId={p.patient_id} canCreate canWithdraw />
      )}

      {tab === 'profile' && success && !editing && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-4">
          Profile updated successfully.
        </p>
      )}

      {tab === 'profile' && !editing ? (
        <div className="card divide-y divide-gray-100">
          <Section label="Full name"     value={`${p.first_name} ${p.last_name}`} />
          <Section label="Date of birth" value={p.date_of_birth?.slice(0, 10) ?? '—'} />
          <Section label="Gender"        value={p.gender ?? '—'} />
          <Section label="Blood type"    value={p.blood_type ?? '—'} />
          <Section label="Phone"         value={p.contact_number ?? '—'} />
          <Section label="Email"         value={user.email} />
          <Section label="Address"       value={p.address ?? '—'} />
          <Section label="National ID"   value={p.national_id ?? '—'} />
          <Section label="SHA number"    value={p.sha_number ?? '—'} />
        </div>
      ) : tab === 'profile' ? (
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">First name</label>
                <input required className="form-input" value={form.first_name} onChange={f('first_name')} />
              </div>
              <div>
                <label className="form-label">Last name</label>
                <input required className="form-input" value={form.last_name} onChange={f('last_name')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Date of birth</label>
                <input required type="date" className="form-input" value={form.date_of_birth} onChange={f('date_of_birth')} />
              </div>
              <div>
                <label className="form-label">Gender</label>
                <select className="form-select" value={form.gender} onChange={f('gender')}>
                  <option value="">Prefer not to say</option>
                  {GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Blood type</label>
                <select className="form-select" value={form.blood_type} onChange={f('blood_type')}>
                  <option value="">Unknown</option>
                  {BLOOD_TYPES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Phone number</label>
                <input type="tel" className="form-input" value={form.contact_number} onChange={f('contact_number')} />
              </div>
            </div>

            <div>
              <label className="form-label">Address</label>
              <input className="form-input" value={form.address} onChange={f('address')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">National ID</label>
                <input className="form-input" value={form.national_id} onChange={f('national_id')} />
              </div>
              <div>
                <label className="form-label">SHA number</label>
                <input className="form-input" value={form.sha_number} onChange={f('sha_number')} />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

function Section({ label, value }) {
  return (
    <div className="px-6 py-3 flex justify-between text-sm">
      <span className="text-gray-500 w-36 shrink-0">{label}</span>
      <span className="text-gray-900 text-right">{value}</span>
    </div>
  )
}
