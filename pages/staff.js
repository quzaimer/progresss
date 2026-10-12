import { useEffect, useState } from 'react'
import Head from 'next/head'
import { Plus, UserX } from 'lucide-react'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabase'
import { PageHeader, Button, Card, Table, Modal, Field, inputCls, Loading, ErrorBox } from '../components/ui'

const ROLES = {
  admin: 'Admin',
  planner: 'Perancang',
  supervisor: 'Penyelia',
  store: 'Stor',
  qc: 'QC',
  finance: 'Kewangan',
}
const EMPTY = { full_name: '', email: '', password: '', role: 'planner' }

export default function Staff() {
  const [rows, setRows] = useState(null)
  const [me, setMe] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const { staff } = await apiFetch('/api/staff')
      setRows(staff)
    } catch (e) {
      setError(e.message)
      setRows([])
    }
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user.id))
    load()
  }, [])

  const create = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiFetch('/api/staff', 'POST', form)
      setForm(null)
      load()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  const changeRole = async (id, role) => {
    setError('')
    try {
      await apiFetch(`/api/staff/${id}`, 'PATCH', { role })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const revoke = async s => {
    if (!confirm(`Cabut akses ${s.full_name || s.email}? Akaun akan disekat daripada log masuk.`)) return
    setError('')
    try {
      await apiFetch(`/api/staff/${s.id}`, 'DELETE')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const set = k => e => setForm({ ...form, [k]: e.target.value })

  return (
    <Layout>
      <Head><title>Staf & Akses · Progresss</title></Head>
      <PageHeader title="Staf & Akses" subtitle="Tambah staf dan tetapkan role (admin sahaja)">
        <Button onClick={() => { setError(''); setForm(EMPTY) }}><Plus size={16} /> Staf baru</Button>
      </PageHeader>

      {!form && <ErrorBox error={error} />}
      {!rows ? <Loading /> : (
        <Card>
          <Table head={['Nama', 'Emel', 'Role', '']} empty={rows.length === 0 && 'Belum ada staf'}>
            {rows.map(s => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-medium">{s.full_name || '—'}</td>
                <td className="px-4 py-2">{s.email}</td>
                <td className="px-4 py-2">
                  <select className={inputCls + ' w-40'} value={s.role} disabled={s.id === me}
                    onChange={e => changeRole(s.id, e.target.value)}>
                    {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 text-right">
                  {s.id !== me && <Button variant="ghost" onClick={() => revoke(s)}><UserX size={14} /></Button>}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={!!form} title="Staf baru" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={create} className="space-y-3">
            <ErrorBox error={error} />
            <Field label="Nama penuh *"><input className={inputCls} value={form.full_name} onChange={set('full_name')} required /></Field>
            <Field label="Emel *"><input type="email" className={inputCls} value={form.email} onChange={set('email')} required /></Field>
            <Field label="Kata laluan sementara *" hint="Minimum 8 aksara">
              <input type="text" minLength={8} className={inputCls} value={form.password} onChange={set('password')} required />
            </Field>
            <Field label="Role *">
              <select className={inputCls} value={form.role} onChange={set('role')}>
                {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setForm(null)}>Batal</Button>
              <Button loading={saving}>Tambah</Button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  )
}
