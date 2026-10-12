import { supabase } from './supabase'

// Panggil API route sendiri dengan token sesi pengguna
export async function apiFetch(path, method = 'GET', body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Ralat ${res.status}`)
  return data
}

export const apiPost = (path, body = {}) => apiFetch(path, 'POST', body)

// Pautan bayaran CHIP untuk invois (dicipta jika belum ada)
export const getPayLink = invoiceId => apiPost(`/api/invoices/${invoiceId}/pay-link`).then(d => d.url)
