import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Siapa boleh buat apa (selain admin). Mesti selari dengan supabase/migrations/0004_role_permissions.sql,
// yang menguatkuasakan peraturan sama di database.
export const PERMISSIONS = {
  clients: ['planner', 'finance'],              // tambah/ubah client
  products: ['planner'],                        // produk & formula (BOM)
  materials: ['planner', 'store'],              // senarai bahan mentah
  suppliers: ['store'],
  receive_stock: ['store'],                     // GRN: terima lot baru
  lines: ['planner'],                           // line pengeluaran
  plan_jobs: ['planner'],                       // cipta job order, tambah batch, batalkan
  manage_jobs: ['planner', 'finance'],          // invois deposit/baki, tandakan siap/selesai
  issue_materials: ['store', 'supervisor'],     // keluarkan bahan ke batch
  batch_stage: ['supervisor', 'store'],         // kemas kini peringkat batch
  qc: ['qc'],                                   // lulus/tolak lot & batch
  deliveries: ['planner', 'store'],
  finance: ['finance'],                         // invois & bayaran
}

export const can = (role, action) => role === 'admin' || (PERMISSIONS[action] || []).includes(role)

// Profil pengguna semasa (dikongsi antara komponen, diambil sekali setiap sesi)
let cached = null
export function loadProfile() {
  if (!cached) {
    cached = supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return null
      const { data } = await supabase.from('profiles').select('full_name, role').eq('id', session.user.id).single()
      return { id: session.user.id, email: session.user.email, ...data }
    })
    cached.then(p => { if (!p) cached = null })
  }
  return cached
}

supabase.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') cached = null
})

// const allowed = useCan('qc') → true/false (false semasa profil dimuatkan)
export function useCan(action) {
  const [role, setRole] = useState(null)
  useEffect(() => { loadProfile().then(p => setRole(p?.role || null)) }, [])
  return can(role, action)
}
