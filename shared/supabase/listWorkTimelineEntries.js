import { supabase } from './client.js'

export async function listWorkTimelineEntries(uids, startDate, endDate) {
  const ids = [...new Set((Array.isArray(uids) ? uids : [uids]).filter(Boolean).map(String))]
  if (!ids.length || !supabase) return []

  const { data, error } = await supabase.rpc('list_work_timeline_entries', {
    p_uids: ids,
    p_start: startDate,
    p_end: endDate,
  })
  if (error) throw error
  return data || []
}

export const mapTimelineRow = (row) => {
  const payload = row?.data && typeof row.data === 'object' ? row.data : {}
  return {
    entryId: row.id,
    ...payload,
    entryType: payload.entryType === 'upskilling' ? 'upskilling' : 'work',
  }
}
