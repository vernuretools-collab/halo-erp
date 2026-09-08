import { supabase } from './client.js'

const BUCKETS = ['employees', 'deliverables', 'payslips']

// `employees` and `payslips` hold personal data and are private, so their
// objects can only be reached through a short-lived signed URL.
const PRIVATE_BUCKETS = new Set(['employees', 'payslips'])

const SIGNED_URL_TTL_SECONDS = 60 * 60

function bucketAndPath(fullPath) {
  const clean = String(fullPath).replace(/^\/+/, '')
  const [bucket, ...rest] = clean.split('/')
  if (BUCKETS.includes(bucket) && rest.length) {
    return { bucket, path: rest.join('/') }
  }
  return { bucket: 'employees', path: clean }
}

export function ref(_storage, fullPath) {
  return { fullPath, ...bucketAndPath(fullPath) }
}

export function uploadBytesResumable(storageRef, file) {
  const listeners = { progress: null, error: null, complete: null }
  const task = {
    snapshot: { bytesTransferred: 0, totalBytes: file.size || 1, ref: storageRef },
    on(_event, progress, error, complete) {
      listeners.progress = progress
      listeners.error = error
      listeners.complete = complete
      run()
    },
  }

  async function run() {
    try {
      if (!supabase) throw new Error('Supabase is not configured')
      listeners.progress?.({ bytesTransferred: 0, totalBytes: file.size || 1 })
      const { error } = await supabase.storage.from(storageRef.bucket).upload(storageRef.path, file, { upsert: true })
      if (error) throw error
      task.snapshot.bytesTransferred = file.size || 1
      listeners.progress?.(task.snapshot)
      await listeners.complete?.()
    } catch (err) {
      listeners.error?.(err)
    }
  }

  return task
}

export async function getDownloadURL(storageRef) {
  if (PRIVATE_BUCKETS.has(storageRef.bucket)) {
    const { data, error } = await supabase.storage
      .from(storageRef.bucket)
      .createSignedUrl(storageRef.path, SIGNED_URL_TTL_SECONDS)
    if (error) throw error
    return data.signedUrl
  }
  const { data } = supabase.storage.from(storageRef.bucket).getPublicUrl(storageRef.path)
  return data.publicUrl
}

/**
 * Resolve a fresh URL for a stored `storagePath` at the moment of use.
 * Signed URLs expire, and rows written while the buckets were public still
 * carry a stale public URL, so viewers must re-resolve instead of trusting
 * the persisted `downloadURL`.
 */
export async function resolveFileUrl(fullPath) {
  if (!fullPath || !supabase) return null
  return getDownloadURL(ref(null, fullPath))
}

export async function deleteObject(storageRef) {
  const { error } = await supabase.storage.from(storageRef.bucket).remove([storageRef.path])
  if (error) throw error
}
