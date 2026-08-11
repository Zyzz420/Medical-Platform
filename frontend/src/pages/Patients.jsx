import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getPatients, createPatient, deletePatient } from '../api/patients'
import { register } from '../api/auth'
import Modal from '../components/common/Modal'
import Pagination from '../components/common/Pagination'

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const GENDERS = ['Male', 'Female', 'Other']

const EMPTY_FORM = {
  first_name: '', last_name: '', date_of_birth: '', gender: '',
  blood_type: '', contact_number: '', email: '', address: '',
  national_id: '', sha_number: '',
  // optional login account
  create_account: false,
  account_password: '',
}

export default function Patients() {
  const { user } = useAuth()
  const canCreate = ['admin', 'receptionist', 'doctor', 'nurse'].includes(user?.role)
  const canDelete = user?.role === 'admin'

  const [patients, setPatients]   = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const limit = 50
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)  // patient object pending delete
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState('')

  function openDeleteModal(patient) {
    setDeleteTarget(patient)
    setDeleteError('')
  }

  function closeDeleteModal() {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError('')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deletePatient(deleteTarget.patient_id)
      setPatients((prev) => prev.filter((p) => p.patient_id !== deleteTarget.patient_id))
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err.response?.data?.message ?? 'Failed to delete patient.')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    getPatients(page, limit)
      .then((res) => { setPatients(res.data.data); setTotal(res.data.total) })
      .catch(() => setError('Failed to load patients.'))
      .finally(() => setLoading(false))
  }, [page])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (form.create_account && form.account_password.length < 8) {
      return setFormError('Account password must be at least 8 characters.')
    }
    if (form.create_account && !form.email) {
      return setFormError('Email is required to create a login account.')
    }

    setSaving(true)
    try {
      if (form.create_account) {
        // Create patient profile + login account in one call
        const res = await register({
          role:           'patient',
          email:          form.email,
          password:       form.account_password,
          first_name:     form.first_name,
          last_name:      form.last_name,
          date_of_birth:  form.date_of_birth,
          gender:         form.gender         || undefined,
          blood_type:     form.blood_type     || undefined,
          contact_number: form.contact_number || undefined,
          address:        form.address        || undefined,
          national_id:    form.national_id    || undefined,
          sha_number:     form.sha_number     || undefined,
        })
        // The register response includes the user; derive a patients-like row for the table
        const { user: newUser } = res.data
        setPatients((prev) => [
          {
            patient_id:     newUser.patient_id,
            first_name:     form.first_name,
            last_name:      form.last_name,
            date_of_birth:  form.date_of_birth,
            gender:         form.gender || null,
            blood_type:     form.blood_type || null,
            contact_number: form.contact_number || null,
            email:          form.email,
            address:        form.address || null,
            national_id:    form.national_id || null,
            sha_number:     form.sha_number || null,
          },
          ...prev,
        ])
      } else {
        // Profile only, no login account
        const res = await createPatient({
          first_name:     form.first_name,
          last_name:      form.last_name,
          date_of_birth:  form.date_of_birth,
          gender:         form.gender         || null,
          blood_type:     form.blood_type     || null,
          contact_number: form.contact_number || null,
          email:          form.email          || null,
          address:        form.address        || null,
          national_id:    form.national_id    || null,
          sha_number:     form.sha_number     || null,
        })
        setPatients((prev) => [res.data, ...prev])
      }
      setShowModal(false)
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Failed to register patient.')
    } finally {
      setSaving(false)
    }
  }

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase()
    return !q || `${p.first_name} ${p.last_name} ${p.email ?? ''} ${p.contact_number ?? ''}`.toLowerCase().includes(q)
  })

  if (loading) return <p className="text-gray-500">Loading…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
        {canCreate && (
          <button onClick={openCreate} className="btn-primary">+ Register patient</button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email or phone…"
          className="form-input max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name', 'DOB', 'Gender', 'Blood type', 'Phone', 'Email'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
              {canDelete && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No patients found.</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.patient_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link to={`/patients/${p.patient_id}`} className="text-primary-600 hover:text-primary-800 hover:underline">
                    {p.first_name} {p.last_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.date_of_birth?.slice(0, 10)}</td>
                <td className="px-4 py-3 text-gray-600">{p.gender ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{p.blood_type ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{p.contact_number ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{p.email ?? '—'}</td>
                {canDelete && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openDeleteModal(p)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} onClose={closeDeleteModal} title="Delete Patient">
        <p className="text-sm text-gray-700 mb-4">
          Are you sure you want to deactivate{' '}
          <span className="font-semibold">
            {deleteTarget?.first_name} {deleteTarget?.last_name}
          </span>?
          They will be removed from all active workflows. Their medical records will be retained as required by law.
        </p>
        {deleteError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">{deleteError}</p>
        )}
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={closeDeleteModal} disabled={deleting}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deactivating…' : 'Yes, deactivate'}
          </button>
        </div>
      </Modal>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register Patient" size="lg">
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
            <div>
              <label className="form-label">Date of birth</label>
              <input required type="date" className="form-input" value={form.date_of_birth} onChange={f('date_of_birth')} />
            </div>
            <div>
              <label className="form-label">Gender</label>
              <select className="form-select" value={form.gender} onChange={f('gender')}>
                <option value="">Select…</option>
                {GENDERS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Blood type</label>
              <select className="form-select" value={form.blood_type} onChange={f('blood_type')}>
                <option value="">Unknown</option>
                {BLOOD_TYPES.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input type="tel" className="form-input" value={form.contact_number} onChange={f('contact_number')} />
            </div>
          </div>

          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email} onChange={f('email')} />
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

          {/* Optional account creation */}
          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={form.create_account}
                onChange={(e) => setForm({ ...form, create_account: e.target.checked })}
              />
              <span className="font-medium text-gray-700">Also create a login account for this patient</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-6">The patient will be able to sign in and view their records.</p>

            {form.create_account && (
              <div className="mt-3">
                <label className="form-label">Account password</label>
                <input
                  type="password"
                  required={form.create_account}
                  className="form-input max-w-xs"
                  placeholder="Min. 8 characters"
                  value={form.account_password}
                  onChange={f('account_password')}
                />
              </div>
            )}
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{formError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Register'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
