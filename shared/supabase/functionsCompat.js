import { supabase } from './client.js'

const NAME_MAP = {
  askAdminAssistant: 'ask-admin-assistant',
}

export function httpsCallable(_functions, name) {
  const fn = NAME_MAP[name] || name
  return async (payload) => {
    if (!supabase) throw new Error('Supabase is not configured')
    const { data, error } = await supabase.functions.invoke(fn, { body: payload })
    if (error) throw error
    return { data }
  }
}

export function getFunctions() {
  return supabase
}

export function connectFunctionsEmulator() {}
