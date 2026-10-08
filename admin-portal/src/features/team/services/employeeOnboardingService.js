import { supabase } from '../../../shared/services/firebaseService'

async function invokeCreateUser(body) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.functions.invoke('create-user', { body })
  if (!error) return data

  let detail = error.message || 'Failed to create the joining account.'
  try {
    if (error.context && typeof error.context.json === 'function') {
      const payload = await error.context.json()
      detail = payload?.error || payload?.message || detail
    }
  } catch {
    /* gateway response had no JSON body */
  }
  throw new Error(detail)
}

export async function createEmployeeOnboarding({ username, password, employment, kras }) {
  return invokeCreateUser({
    type: 'employee_onboarding',
    username,
    password,
    employment,
    kras,
  })
}

export async function listEmployeeOnboarding() {
  const { data, error } = await supabase
    .from('employee_onboarding')
    .select('id, username, status, employment, created_at, submitted_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getEmployeeOnboarding(id) {
  const { data, error } = await supabase
    .from('employee_onboarding')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}
