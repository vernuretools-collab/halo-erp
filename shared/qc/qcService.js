import { supabase } from '../supabase/client.js'

export const QC_BUCKET = 'qc-media'
export const QC_MAX_BYTES = 50 * 1024 * 1024
export const QC_ACCEPT =
  '.mp4,.webm,.jpg,.jpeg,.png,.webp,.gif,video/mp4,video/webm,image/jpeg,image/png,image/webp,image/gif'

const EXTENSIONS = new Set(['mp4', 'webm', 'jpg', 'jpeg', 'png', 'webp', 'gif'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

const STATUS_LABEL = {
  in_review: 'In review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
}

export const QC_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'in_review', label: 'In review' },
  { id: 'changes_requested', label: 'Changes requested' },
  { id: 'approved', label: 'Approved' },
]

export function qcStatusLabel(status) {
  return STATUS_LABEL[status] || status
}

function extensionOf(name) {
  const parts = String(name || '').toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() : ''
}

export function validateQcFile(file) {
  if (!file) return 'Choose an MP4, WebM, or image file.'
  const ext = extensionOf(file.name)
  if (!EXTENSIONS.has(ext)) {
    return 'QC accepts MP4, WebM, and images (JPG, PNG, WebP, GIF).'
  }
  if (file.size > QC_MAX_BYTES) {
    return 'This file is over 50 MB. QC accepts files up to 50 MB.'
  }
  return ''
}

export function mediaKind(fileName, contentType) {
  const type = String(contentType || '').toLowerCase()
  const ext = extensionOf(fileName)
  if (type.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) return 'image'
  return 'video'
}

function safeFileName(name) {
  const base = String(name || 'file').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'file'
}

function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `qc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function sortVersions(versions) {
  return [...(versions || [])].sort((a, b) => a.version_number - b.version_number)
}

function normalizeItem(row) {
  const versions = sortVersions(row.qc_versions).map((version) => ({
    ...version,
    comments: [...(version.qc_comments || [])].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    ),
  }))
  const { qc_versions: _versions, ...item } = row
  return { ...item, versions }
}

export async function listQcItems() {
  const client = requireClient()
  const { data, error } = await client
    .from('qc_items')
    .select('*, qc_versions(*, qc_comments(*))')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeItem)
}

async function uploadVersionFile(itemId, versionNumber, file) {
  const client = requireClient()
  const storagePath = `${itemId}/v${versionNumber}-${safeFileName(file.name)}`
  const { error } = await client.storage.from(QC_BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw error
  return storagePath
}

export async function createQcItem({ projectId, title, file, actor }) {
  const fileError = validateQcFile(file)
  if (fileError) throw new Error(fileError)
  const trimmed = String(title || '').trim()
  if (!trimmed) throw new Error('Add a title for this review.')
  if (!projectId) throw new Error('Pick a project.')

  const client = requireClient()
  const itemId = newId()
  const { error: insertError } = await client.from('qc_items').insert({
    id: itemId,
    project_id: projectId,
    title: trimmed,
    status: 'in_review',
    uploader_id: actor?.id || null,
    uploader_name: actor?.name || null,
  })
  if (insertError) throw insertError

  let storagePath = ''
  try {
    storagePath = await uploadVersionFile(itemId, 1, file)
    const { error: versionError } = await client.from('qc_versions').insert({
      id: newId(),
      item_id: itemId,
      version_number: 1,
      storage_path: storagePath,
      file_name: file.name,
      content_type: file.type || null,
      byte_size: file.size,
      uploaded_by_id: actor?.id || null,
      uploaded_by_name: actor?.name || null,
    })
    if (versionError) throw versionError
  } catch (err) {
    try {
      if (storagePath) await client.storage.from(QC_BUCKET).remove([storagePath])
      await client.from('qc_items').delete().eq('id', itemId)
    } catch (_) {
      /* keep the upload error */
    }
    throw err
  }
  return itemId
}

export async function addQcVersion({ item, file, actor }) {
  const fileError = validateQcFile(file)
  if (fileError) throw new Error(fileError)
  const client = requireClient()
  const nextNumber = (item.versions?.reduce((max, version) => Math.max(max, version.version_number), 0) || 0) + 1
  const storagePath = await uploadVersionFile(item.id, nextNumber, file)
  const { error: versionError } = await client.from('qc_versions').insert({
    id: newId(),
    item_id: item.id,
    version_number: nextNumber,
    storage_path: storagePath,
    file_name: file.name,
    content_type: file.type || null,
    byte_size: file.size,
    uploaded_by_id: actor?.id || null,
    uploaded_by_name: actor?.name || null,
  })
  if (versionError) {
    await client.storage.from(QC_BUCKET).remove([storagePath])
    throw versionError
  }
  const { error: statusError } = await client
    .from('qc_items')
    .update({ status: 'in_review' })
    .eq('id', item.id)
  if (statusError) throw statusError
}

const QC_FPS = 30

export function frameAt(seconds, fps = QC_FPS) {
  return Math.max(0, Math.floor((Number(seconds) || 0) * fps + 1e-4))
}

export function formatTimecode(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(total / 60)
  const secs = total - minutes * 60
  return `${minutes}:${secs.toFixed(2).padStart(5, '0')}`
}

function unit(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.min(1, Math.max(0, number))
}

export function sanitizeShapes(shapes) {
  if (!Array.isArray(shapes)) return []
  return shapes
    .slice(0, 60)
    .map((shape) => {
      const color = /^#[0-9a-fA-F]{6}$/.test(shape?.color) ? shape.color : '#ff3b30'
      if (shape?.tool === 'pen' && Array.isArray(shape.pts)) {
        const pts = shape.pts.slice(0, 300).map((point) => ({ x: unit(point?.x), y: unit(point?.y) }))
        return pts.length > 1 ? { tool: 'pen', color, pts } : null
      }
      if (shape?.tool === 'box' || shape?.tool === 'arrow') {
        return {
          tool: shape.tool,
          color,
          a: { x: unit(shape.a?.x), y: unit(shape.a?.y) },
          b: { x: unit(shape.b?.x), y: unit(shape.b?.y) },
        }
      }
      return null
    })
    .filter(Boolean)
}

export async function addQcComment({ versionId, body, actor, timeSeconds = null, timecode = null, frameNumber = null, shapes = [] }) {
  const trimmed = String(body || '').trim()
  if (!trimmed) throw new Error('Write a comment first.')
  const client = requireClient()
  const { error } = await client.from('qc_comments').insert({
    id: newId(),
    version_id: versionId,
    body: trimmed,
    author_id: actor?.id || null,
    author_name: actor?.name || null,
    time_seconds: timeSeconds == null ? null : Number(timeSeconds),
    timecode: timecode || null,
    frame_number: frameNumber == null ? null : Number(frameNumber),
    shapes: sanitizeShapes(shapes),
  })
  if (error) throw error
}

export async function setQcStatus({ itemId, status, actor }) {
  const client = requireClient()
  const patch = {
    status,
    reviewer_id: actor?.id || null,
    reviewer_name: actor?.name || null,
  }
  const { error } = await client.from('qc_items').update(patch).eq('id', itemId)
  if (error) throw error
}

export async function signedMediaUrl(storagePath) {
  const client = requireClient()
  const { data, error } = await client.storage.from(QC_BUCKET).createSignedUrl(storagePath, 60 * 60)
  if (error) throw error
  return data?.signedUrl || ''
}
