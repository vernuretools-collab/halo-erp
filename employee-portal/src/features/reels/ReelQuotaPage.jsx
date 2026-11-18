import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { getProjectsFromDb } from '../projects/services/projectService'
import { monthKey } from '../../../../shared/reels/deadlines.js'
import { listQuotas, setClientQuota } from '../../../../shared/reels/reelService.js'
import { clientProjectOptions, FIELD, projectOptionLabel, ReelNav } from './reelsUi'

export function ReelQuotaPage() {
  const [projects, setProjects] = useState([])
  const [quotas, setQuotas] = useState([])
  const [projectId, setProjectId] = useState('')
  const [month, setMonth] = useState(monthKey())
  const [count, setCount] = useState('8')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => listQuotas().then(setQuotas).catch((err) => setError(err.message))

  useEffect(() => {
    getProjectsFromDb().then((rows) => setProjects(rows || []))
    load()
  }, [])

  return (
    <div>
      <PageHeader title="Monthly quota" description="How many reels each client contracted this month. The board shows planned against this number." />
      <ReelNav />
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
      <form
        className="mb-6 grid max-w-xl gap-3 rounded-2xl border border-border bg-surface p-4"
        onSubmit={async (event) => {
          event.preventDefault()
          setSaving(true)
          setError('')
          try {
            await setClientQuota({ projectId, month, count })
            await load()
          } catch (err) {
            setError(err.message || 'Could not save the quota.')
          } finally {
            setSaving(false)
          }
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-muted">Client project</span>
          <select className={FIELD} value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            <option value="">Choose</option>
            {clientProjectOptions(projects).map((item) => (
              <option key={item.projectId || item.id} value={item.projectId || item.id}>
                {projectOptionLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Month</span>
          <input className={FIELD} value={month} onChange={(e) => setMonth(e.target.value)} pattern="[0-9]{4}-[0-9]{2}" required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Reels contracted</span>
          <input className={FIELD} type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} required />
        </label>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save quota'}</Button>
      </form>
      <ul className="space-y-2 text-sm">
        {quotas.map((row) => (
          <li key={`${row.project_id}-${row.month}`} className="rounded-xl border border-border px-3 py-2">
            {row.project_id} · {row.month} · {row.reels_contracted} contracted
          </li>
        ))}
      </ul>
    </div>
  )
}
