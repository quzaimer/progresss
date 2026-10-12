import { supabaseAdmin, getRequestUser } from '../../../lib/supabaseAdmin'

export const STAFF_ROLES = ['admin', 'planner', 'supervisor', 'store', 'qc', 'finance']

// Senarai staf (GET) dan tambah staf baru (POST). Admin sahaja.
export default async function handler(req, res) {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ error: 'Sila log masuk' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin sahaja' })

  if (req.method === 'GET') {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles').select('id, full_name, role, created_at').neq('role', 'client').order('created_at')
    if (error) return res.status(500).json({ error: error.message })
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const emails = Object.fromEntries((users || []).map(u => [u.id, u.email]))
    return res.status(200).json({ staff: profiles.map(p => ({ ...p, email: emails[p.id] })) })
  }

  if (req.method === 'POST') {
    const { email, password, full_name, role } = req.body || {}
    if (!email || !password || !full_name) return res.status(400).json({ error: 'Nama, emel dan kata laluan wajib' })
    if (!STAFF_ROLES.includes(role)) return res.status(400).json({ error: 'Role tidak sah' })
    if (password.length < 8) return res.status(400).json({ error: 'Kata laluan minimum 8 aksara' })

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name },
    })
    if (error) return res.status(400).json({ error: error.message })

    // Trigger handle_new_user mencipta profil 'client'; naikkan kepada role staf
    const { error: pErr } = await supabaseAdmin.from('profiles')
      .upsert({ id: data.user.id, full_name, role, client_id: null })
    if (pErr) return res.status(500).json({ error: pErr.message })
    return res.status(201).json({ id: data.user.id })
  }

  return res.status(405).end()
}
