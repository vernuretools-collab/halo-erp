import React, { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { Search, Loader2, AlertCircle } from 'lucide-react'
import { db } from '../../shared/services/firebaseService'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { getEmployees } from './services/teamService'
import { TeamSubNav } from './components/TeamSubNav'
import haloLogo from '../../assets/halologo.png'

const LEADERS = [
  { key: 'vivek', match: 'vivek', fallbackName: 'Vivek Jayaraman', title: 'Founder' },
  { key: 'swathish', match: 'swathish', fallbackName: 'Swathish', title: 'Co-Founder' },
  {
    key: 'vedhika',
    match: 'vedhika',
    fallbackName: 'Vedhika',
    title: 'Operations / CEO',
    note: 'MD — all teams report here',
  },
]

const TEAMS = [
  {
    name: 'Social Media',
    pill: 'border-rose-400/60 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    count: 'text-rose-600 dark:text-rose-300',
  },
  {
    name: 'Graphic Design',
    pill: 'border-violet-400/60 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    count: 'text-violet-600 dark:text-violet-300',
  },
  {
    name: 'SEO & Content',
    pill: 'border-amber-400/60 bg-amber-500/10 text-amber-800 dark:text-amber-300',
    count: 'text-amber-700 dark:text-amber-300',
  },
  {
    name: 'Performance Marketing',
    pill: 'border-sky-400/60 bg-sky-500/10 text-sky-800 dark:text-sky-300',
    count: 'text-sky-700 dark:text-sky-300',
  },
  {
    name: 'Outreach',
    pill: 'border-orange-400/60 bg-orange-500/10 text-orange-800 dark:text-orange-300',
    count: 'text-orange-700 dark:text-orange-300',
  },
  {
    name: 'Editing',
    pill: 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-300',
    count: 'text-fuchsia-700 dark:text-fuchsia-300',
  },
  {
    name: 'Web Development',
    pill: 'border-indigo-400/60 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300',
    count: 'text-indigo-700 dark:text-indigo-300',
  },
]

function normalizeLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function employeeId(emp) {
  return emp?.uid || emp?.id || emp?.employeeId || ''
}

function displayName(emp, fallback) {
  return emp?.displayName || emp?.name || fallback
}

function initialOf(name) {
  const ch = String(name || '').trim().charAt(0)
  return ch ? ch.toUpperCase() : '?'
}

function memberCountLabel(count) {
  return `${count} ${count === 1 ? 'member' : 'members'}`
}

function personHaystack(emp) {
  return [emp.displayName, emp.name, emp.roleName, emp.email, emp.departmentName, emp.department]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

const TEAM_RULES = [
  { name: 'Graphic Design', test: /visual|graphic|design|alchemist/i },
  { name: 'SEO & Content', test: /content architect|seo|content writer/i },
  { name: 'Editing', test: /editor|editing|storyteller/i },
  { name: 'Social Media', test: /social|brand voice/i },
  { name: 'Performance Marketing', test: /growth|performance|marketing/i },
  { name: 'Outreach', test: /outreach|relations|business development/i },
  { name: 'Web Development', test: /developer|engineer|wordpress|software|automation|web/i },
]

function teamNameForEmployee(emp) {
  const exact = normalizeLabel(emp.departmentName || emp.department)
  const named = TEAMS.find((team) => normalizeLabel(team.name) === exact)
  if (named) return named.name
  const text = `${emp.roleName || ''} ${emp.departmentName || ''} ${emp.department || ''}`
  return TEAM_RULES.find((rule) => rule.test.test(text))?.name || ''
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export const OrganizationStructure = () => {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [todayAttendanceMap, setTodayAttendanceMap] = useState({})

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setListError('')
      try {
        const emps = await getEmployees()
        if (!cancelled) setEmployees(emps)
      } catch (err) {
        console.error('Error loading organization chart:', err)
        if (!cancelled) {
          setListError(err?.message || 'Could not load team members. Sign in again and retry.')
          setEmployees([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const q = query(collection(db, 'attendanceLogs'), where('date', '==', todayStr))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const map = {}
        snap.docs.forEach((doc) => {
          const data = doc.data()
          const isPresent =
            data.clockedIn === true ||
            (data.regularSeconds && data.regularSeconds > 0) ||
            Boolean(data.clockInTime) ||
            data.onDuty === true ||
            data.present === true ||
            data.source === 'on_duty'
          if (data.uid) map[data.uid] = isPresent
        })
        setTodayAttendanceMap(map)
      },
      (err) => {
        console.error('Error fetching today attendance map:', err)
      }
    )
    return () => unsub()
  }, [])

  const isEmpPresent = (emp) => {
    const empUid = employeeId(emp)
    if (empUid && todayAttendanceMap[empUid] !== undefined) return todayAttendanceMap[empUid]
    return false
  }

  const leaders = useMemo(() => {
    return LEADERS.map((leader) => {
      const record = employees.find((emp) => {
        const name = `${emp.displayName || ''} ${emp.name || ''}`.toLowerCase()
        return name.includes(leader.match)
      })
      return { ...leader, record, name: displayName(record, leader.fallbackName) }
    })
  }, [employees])

  const leaderIds = useMemo(() => {
    return new Set(leaders.map((leader) => employeeId(leader.record)).filter(Boolean))
  }, [leaders])

  const teams = useMemo(() => {
    const buckets = TEAMS.map((team) => ({ ...team, members: [] }))
    const byKey = new Map(buckets.map((team) => [normalizeLabel(team.name), team]))
    employees.forEach((emp) => {
      const id = employeeId(emp)
      if (id && leaderIds.has(id)) return
      const key = normalizeLabel(teamNameForEmployee(emp))
      const bucket = byKey.get(key)
      if (bucket) bucket.members.push(emp)
    })
    return buckets
  }, [employees, leaderIds])

  const queryText = searchQuery.trim().toLowerCase()

  const visibleTeams = useMemo(() => {
    if (!queryText) return teams
    return teams.filter((team) => {
      if (team.name.toLowerCase().includes(queryText)) return true
      return team.members.some((emp) => personHaystack(emp).includes(queryText))
    })
  }, [teams, queryText])

  const activeTeam = visibleTeams.find((team) => team.name === selectedTeam) || null

  const panelMembers = useMemo(() => {
    if (!activeTeam) return []
    if (!queryText || activeTeam.name.toLowerCase().includes(queryText)) return activeTeam.members
    return activeTeam.members.filter((emp) => personHaystack(emp).includes(queryText))
  }, [activeTeam, queryText])

  const toggleTeam = (name) => {
    setSelectedTeam((current) => (current === name ? '' : name))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <PageHeader
          title="Halo Effect Consulting Family"
          description="Same family tree: founders, Vedhika, then each team."
        />
        <div className="border-b border-border pb-3">
          <TeamSubNav />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search team or member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-chrome border border-border text-xs text-fg placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none transition-colors"
          />
        </div>
        <span className="text-xs font-semibold text-muted whitespace-nowrap">
          {memberCountLabel(employees.length)}
        </span>
      </div>

      {listError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{listError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <span className="ml-3 text-slate-400 text-sm">Loading organization chart…</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface px-4 py-8 sm:px-8">
          <div className="flex flex-col items-center gap-3">
            <img
              src={haloLogo}
              alt="The Halo Family"
              className="w-16 h-16 object-contain rounded-full bg-white p-1 border border-slate-200 dark:border-white/20"
            />
            <div className="flex items-center gap-4 text-xs font-medium text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Present
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Absent
              </span>
            </div>
          </div>

          <div className="mt-8 mx-auto w-full max-w-3xl">
            <div className="grid grid-cols-2 gap-6 sm:gap-10">
              {leaders.slice(0, 2).map((leader) => (
                <div key={leader.key} className="flex justify-center">
                  <LeaderCard leader={leader} />
                </div>
              ))}
            </div>

            <svg
              viewBox="0 0 100 28"
              className="block h-10 w-full text-slate-400 dark:text-slate-500"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M25 0 L50 28" stroke="currentColor" strokeWidth="1.25" fill="none" vectorEffect="non-scaling-stroke" />
              <path d="M75 0 L50 28" stroke="currentColor" strokeWidth="1.25" fill="none" vectorEffect="non-scaling-stroke" />
            </svg>

            <div className="flex justify-center">
              <LeaderCard leader={leaders[2]} featured />
            </div>

            <div className="mx-auto h-6 w-px bg-slate-400 dark:bg-slate-500" />

            <div className="overflow-x-auto pb-2">
              <div className="relative mx-auto flex w-max">
                <div className="pointer-events-none absolute left-20 right-20 top-0 h-px bg-slate-400 dark:bg-slate-500" />
                {visibleTeams.map((team) => {
                  const selected = team.name === selectedTeam
                  const shown =
                    !queryText || team.name.toLowerCase().includes(queryText)
                      ? team.members
                      : team.members.filter((emp) => personHaystack(emp).includes(queryText))
                  return (
                    <div key={team.name} className="flex w-40 shrink-0 flex-col items-center">
                      <div className="h-4 w-px bg-slate-400 dark:bg-slate-500" />
                      <button
                        type="button"
                        onClick={() => toggleTeam(team.name)}
                        className={`w-[9.5rem] rounded-full border px-3 py-2 text-center transition-shadow cursor-pointer ${team.pill} ${
                          selected ? 'ring-2 ring-offset-2 ring-offset-surface ring-current shadow-sm' : 'hover:shadow-sm'
                        }`}
                      >
                        <span className="block text-xs font-semibold leading-tight">{team.name}</span>
                        <span className={`mt-0.5 block text-[10px] font-medium ${team.count}`}>
                          {memberCountLabel(shown.length)}
                        </span>
                      </button>
                      <ul className="mt-2 w-[9.5rem] space-y-1.5">
                        {shown.map((emp) => {
                          const present = isEmpPresent(emp)
                          const name = cleanText(displayName(emp, 'Team member'))
                          return (
                            <li
                              key={employeeId(emp) || name}
                              className="rounded-xl border border-border bg-chrome px-2 py-1.5 text-left"
                            >
                              <span className="flex items-start gap-1.5">
                                <span
                                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${present ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                  title={present ? 'Present' : 'Absent'}
                                />
                                <span className="min-w-0">
                                  <span className="block text-[11px] font-semibold leading-tight text-fg">{name}</span>
                                  <span className="block text-[10px] leading-tight text-muted">
                                    {cleanText(emp.roleName) || '—'}
                                  </span>
                                </span>
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
              {visibleTeams.length === 0 && (
                <p className="py-6 text-center text-xs text-muted">No teams match that search.</p>
              )}
            </div>
          </div>

          {activeTeam && (
            <div className="mx-auto mt-8 max-w-5xl space-y-3">
              <h3 className="text-sm font-semibold text-fg">
                {activeTeam.name}
                <span className="ml-2 text-xs font-medium text-muted">
                  {memberCountLabel(panelMembers.length)}
                </span>
              </h3>
              {panelMembers.length === 0 ? (
                <p className="text-xs text-muted">No people in this team.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {panelMembers.map((emp) => {
                    const present = isEmpPresent(emp)
                    const name = displayName(emp, 'Team member')
                    return (
                      <Card key={employeeId(emp) || name} className="border-border p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-fg">{name}</p>
                            <p className="text-xs text-muted">{emp.roleName || '—'}</p>
                          </div>
                          <Badge variant={present ? 'success' : 'danger'}>
                            <span className="flex items-center gap-1.5 font-semibold">
                              <span className={`w-1.5 h-1.5 rounded-full ${present ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {present ? 'Present' : 'Absent'}
                            </span>
                          </Badge>
                        </div>
                        <p className="text-xs text-fg font-medium">{emp.departmentName || emp.department || activeTeam.name}</p>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LeaderCard({ leader, featured = false }) {
  return (
    <div
      className={`flex w-full items-center gap-3 rounded-2xl border bg-chrome px-3 py-2.5 shadow-sm ${
        featured
          ? 'max-w-xs border-2 border-teal-500 px-4 py-3.5'
          : 'max-w-[15rem] border-border'
      }`}
    >
      <div
        className={`flex items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100 shrink-0 ${
          featured ? 'h-11 w-11 text-base' : 'h-9 w-9 text-sm'
        }`}
      >
        {initialOf(leader.name)}
      </div>
      <div className="min-w-0 text-left">
        <p className={`font-semibold text-fg truncate ${featured ? 'text-sm' : 'text-xs'}`}>{leader.name}</p>
        <p className="text-[11px] text-muted">{leader.title}</p>
        {leader.note && <p className="text-[11px] text-teal-700 dark:text-teal-300 mt-0.5">{leader.note}</p>}
      </div>
    </div>
  )
}
