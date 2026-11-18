import { supabase } from '../supabase/client.js'
import { discardQcObject, uploadQcObject } from '../qc/qcService.js'
import { isHttpUrl } from './deadlines.js'

const MAX_BYTES = 50 * 1024 * 1024

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function raise(error) {
  if (!error) return
  const message = error.message || error.details || 'Request failed'
  throw new Error(message.replace(/^.*ERROR:\s*/, '').replace(/\n.*$/, ''))
}

function safeFileName(name) {
  const base = String(name || 'cut.mp4').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'cut.mp4'
}

export function validateReelReviewFile(file) {
  if (!file) return 'Choose an MP4 or WebM review file.'
  const name = String(file.name || '').toLowerCase()
  const type = String(file.type || '').toLowerCase()
  const video = name.endsWith('.mp4') || name.endsWith('.webm') || type === 'video/mp4' || type === 'video/webm'
  if (!video) return 'Review files must be MP4 or WebM.'
  if (file.size > MAX_BYTES) return 'This review file is over 50 MB. Upload an MP4 or WebM that is 50 MB or less.'
  return ''
}

export async function listReels() {
  const client = requireClient()
  const { data, error } = await client.from('reels').select('*').order('golive_at', { ascending: true })
  raise(error)
  return data || []
}

export async function getReel(id) {
  const client = requireClient()
  const { data, error } = await client.from('reels').select('*').eq('id', id).maybeSingle()
  raise(error)
  return data
}

export async function listReelVersions(reelId) {
  const client = requireClient()
  const { data, error } = await client
    .from('reel_versions')
    .select('*')
    .eq('reel_id', reelId)
    .order('version_no', { ascending: true })
  raise(error)
  return data || []
}

export async function listReelActivity(reelId) {
  const client = requireClient()
  const { data, error } = await client
    .from('reel_activity')
    .select('*')
    .eq('reel_id', reelId)
    .order('created_at', { ascending: false })
  raise(error)
  return data || []
}

export async function listQuotas() {
  const client = requireClient()
  const { data, error } = await client.from('client_quota').select('*')
  raise(error)
  return data || []
}

export async function listReminderLog() {
  const client = requireClient()
  const { data, error } = await client.from('reel_reminder_log').select('*').order('sent_at', { ascending: false })
  raise(error)
  return data || []
}

export async function nextReelId(projectId, prefix) {
  const client = requireClient()
  const { data, error } = await client.rpc('reel_next_id', { p_project_id: projectId, p_prefix: prefix || '' })
  raise(error)
  return data || ''
}

export async function editorWorkload(golive) {
  const client = requireClient()
  const { data, error } = await client.rpc('reel_editor_workload', { p_golive: new Date(golive).toISOString() })
  raise(error)
  return data || []
}

export async function planReel(input) {
  const client = requireClient()
  const { data, error } = await client.rpc('reel_plan', {
    p_project_id: input.projectId,
    p_prefix: input.prefix || '',
    p_title: input.title,
    p_brief: input.brief || '',
    p_raw_footage_url: input.rawFootageUrl,
    p_editor_id: input.editorId,
    p_editor_name: input.editorName || '',
    p_reviewer_id: input.reviewerId || '',
    p_reviewer_name: input.reviewerName || '',
    p_golive: new Date(input.golive).toISOString(),
    p_platforms: input.platforms?.length ? input.platforms : ['instagram'],
    p_collaborators: input.collaborators || [],
    p_rush_reason: input.rushReason || '',
    p_smm_name: input.smmName || '',
  })
  raise(error)
  return data
}

export async function startReel(reelId) {
  const client = requireClient()
  const { error } = await client.rpc('reel_start', { p_reel_id: reelId })
  raise(error)
}

export async function addReelVersion({ reelId, versionNo, file, fullQualityUrl }) {
  const fileError = validateReelReviewFile(file)
  if (fileError) throw new Error(fileError)
  if (!isHttpUrl(fullQualityUrl)) throw new Error('Add the full-quality link. That link is required.')
  const storagePath = `${reelId}/v${versionNo}-${safeFileName(file.name)}`
  await uploadQcObject(storagePath, file)
  const client = requireClient()
  const { data, error } = await client.rpc('reel_add_version', {
    p_reel_id: reelId,
    p_storage_path: storagePath,
    p_file_name: file.name,
    p_content_type: file.type || null,
    p_byte_size: file.size,
    p_full_quality_url: String(fullQualityUrl).trim(),
  })
  if (error) {
    await discardQcObject(storagePath)
    raise(error)
  }
  return data
}

export async function decideReel({ reelId, decision, feedback }) {
  const client = requireClient()
  const { error } = await client.rpc('reel_decide', {
    p_reel_id: reelId,
    p_decision: decision,
    p_feedback: feedback || '',
  })
  raise(error)
}

export async function scheduleReel({ reelId, caption, coverSet, collabSent }) {
  const client = requireClient()
  const { error } = await client.rpc('reel_schedule', {
    p_reel_id: reelId,
    p_caption: caption,
    p_cover_set: Boolean(coverSet),
    p_collab_sent: Boolean(collabSent),
  })
  raise(error)
}

export async function publishReel({ reelId, postUrl }) {
  const client = requireClient()
  const { error } = await client.rpc('reel_publish', { p_reel_id: reelId, p_post_url: postUrl })
  raise(error)
}

export async function setReelGolive({ reelId, golive }) {
  const client = requireClient()
  const { error } = await client.rpc('reel_set_golive', {
    p_reel_id: reelId,
    p_golive: new Date(golive).toISOString(),
  })
  raise(error)
}

export async function setClientQuota({ projectId, month, count }) {
  const client = requireClient()
  const { error } = await client.rpc('reel_set_quota', {
    p_project_id: projectId,
    p_month: month,
    p_count: Number(count),
  })
  raise(error)
}

export async function answerReelNotification(id, answer) {
  const client = requireClient()
  const { data, error } = await client.rpc('reel_answer', { p_notification_id: id, p_answer: answer })
  raise(error)
  return Array.isArray(data) ? data[0] : data
}

export async function listPendingReelNotifications(identityIds) {
  const ids = [...new Set((identityIds || []).filter(Boolean).map(String))]
  if (!ids.length) return []
  const client = requireClient()
  const { data, error } = await client
    .from('reel_notifications')
    .select('*')
    .in('user_id', ids)
    .eq('needs_answer', true)
    .is('answer', null)
    .order('created_at', { ascending: false })
  raise(error)
  return data || []
}

export async function onTimeScores(month) {
  const client = requireClient()
  const { data, error } = await client.rpc('reel_on_time_scores', { p_month: month })
  raise(error)
  return data || []
}

export function subscribeReelNotifications(identityIds, onChange) {
  const ids = new Set((identityIds || []).filter(Boolean).map(String))
  const client = requireClient()
  const channel = client
    .channel(`reel-notifications-${[...ids].sort().join('-') || 'none'}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reel_notifications' },
      (payload) => {
        const row = payload.new || payload.old
        if (!row || !ids.has(String(row.user_id || ''))) return
        onChange(payload)
      }
    )
    .subscribe()
  return () => {
    client.removeChannel(channel)
  }
}
