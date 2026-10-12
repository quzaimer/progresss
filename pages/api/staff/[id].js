import { supabaseAdmin, getRequestUser } from '../../../lib/supabaseAdmin'
import { STAFF_ROLES } from './index'

// Kemas kini nama/role staf (PATCH) atau cabut akses (DELETE). Admin sahaja.
export default async function handler(req, res) {
  const user = await getRequestUser(req)
  if (!user) return res.status(401).json({ error: 'Sila log masuk' })
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin sahaja' })

  const { id } = req.query
  if (id === user.id) return res.status(400).json({ error: 'Tidak boleh ubah akses akaun sendiri' })

  if (req.method === 'PATCH') {
    const { full_name, role } = req.body || {}
    const update = {}
    if (full_name !== undefined) update.full_name = full_name
    if (role !== undefined) {
      if (!STAFF_ROLES.includes(role)) return res.status(400).json({ error: 'Role tidak sah' })
      update.role = role
    }
    const { error } = await supabaseAdmin.from('profiles').update(update).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    // Cabut akses: role 'client' tanpa client_id = tiada akses; log masuk dihalang sepenuhnya
    const { error } = await supabaseAdmin.from('profiles').update({ role: 'client', client_id: null }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: '876000h' })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}
