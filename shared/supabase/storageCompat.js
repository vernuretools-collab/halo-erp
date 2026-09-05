import { supabase } from './client.js'

function bucketAndPath(fullPath) {
  const clean = String(fullPath).replace(/^\/+/, '')
  const [bucket, ...rest] = clean.split('/')
  if (['employees', 'deliverables', 'payslips'].includes(bucket) && rest.length) {
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
  const { data } = supabase.storage.from(storageRef.bucket).getPublicUrl(storageRef.path)
  return data.publicUrl
}

export async function deleteObject(storageRef) {
  const { error } = await supabase.storage.from(storageRef.bucket).remove([storageRef.path])
  if (error) throw error
}
