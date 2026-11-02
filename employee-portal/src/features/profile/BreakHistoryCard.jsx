import React, { useEffect, useMemo, useState } from 'react'
import { Coffee, Utensils } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { useUserStore } from '../../stores/userStore'
import { useTeamStore } from '../team/stores/teamStore'
import { getTodayAttendanceLog } from '../team/services/attendanceService'
import {
  formatDuration,
  formatSessionRange,
  kindLabel,
  localDateKey,
  logsFromAttendance,
  pauseSessions,
  sessionMinutes,
} from './breakSessions'

function SessionRow({ session, nowMs }) {
  const Icon = session.kind === 'lunch' ? Utensils : Coffee

  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto_4.75rem] items-center gap-x-3 border-t border-border py-3">
      <span className="w-8 h-8 rounded-xl bg-chrome text-muted flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </span>
      <p className="text-xs font-semibold text-fg truncate">{kindLabel(session.kind)}</p>
      <p className="text-xs text-muted tabular-nums whitespace-nowrap text-right">
        {formatSessionRange(session)}
      </p>
      <p className="text-xs font-bold text-fg tabular-nums text-right">
        {formatDuration(sessionMinutes(session, nowMs))}
      </p>
    </li>
  )
}

export const BreakHistoryCard = () => {
  const uid = useUserStore((s) => s.user?.uid)
  const todayShiftLogs = useTeamStore((s) => s.todayShiftLogs)
  const lastWorkDate = useTeamStore((s) => s.lastWorkDate)

  const [todayRecord, setTodayRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const todayKey = localDateKey()

  useEffect(() => {
    if (!uid) {
      setTodayRecord(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    getTodayAttendanceLog(uid)
      .then((record) => {
        if (!cancelled) setTodayRecord(record)
      })
      .catch(() => {
        if (!cancelled) setTodayRecord(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [uid])

  const todayLogs = useMemo(() => {
    const live = lastWorkDate === todayKey && Array.isArray(todayShiftLogs) && todayShiftLogs.length
      ? todayShiftLogs
      : null
    const recordDate = String(todayRecord?.date || '').slice(0, 10)
    const saved = recordDate === todayKey || !todayRecord?.date ? logsFromAttendance(todayRecord) : []
    return live || saved
  }, [lastWorkDate, todayKey, todayShiftLogs, todayRecord])

  const todaySessions = useMemo(() => pauseSessions(todayLogs), [todayLogs])
  const hasOpenToday = todaySessions.some((session) => session.endMs == null)

  useEffect(() => {
    if (!hasOpenToday) return undefined
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), 15000)
    return () => clearInterval(id)
  }, [hasOpenToday])

  const todayTotal = todaySessions.reduce((sum, session) => sum + sessionMinutes(session, nowMs), 0)

  return (
    <Card className="p-6 border-border space-y-4">
      <div>
        <h3 className="font-bold text-fg text-sm">Breaks</h3>
        <p className="text-[11px] text-muted mt-1">
          Tea breaks and lunch, with the time you started and how many minutes you were away.
        </p>
      </div>

      <section>
        {loading && todaySessions.length === 0 ? (
          <p className="text-xs text-muted py-2">Loading today's breaks...</p>
        ) : todaySessions.length === 0 ? (
          <p className="text-xs text-muted py-2">No tea or lunch breaks yet today.</p>
        ) : (
          <>
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto_4.75rem] items-center gap-x-3 pb-2">
              <h4 className="col-span-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Today</h4>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right">Time</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-right">Minutes</span>
            </div>
            <ul className="m-0 list-none p-0">
              {todaySessions.map((session) => (
                <SessionRow
                  key={`${session.kind}-${session.startMs}`}
                  session={session}
                  nowMs={nowMs}
                />
              ))}
            </ul>
            {todaySessions.length > 1 && (
              <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto_4.75rem] items-center gap-x-3 border-t border-border pt-3">
                <span className="col-span-3 text-xs font-semibold text-muted">Total</span>
                <span className="text-xs font-bold text-fg tabular-nums text-right">
                  {formatDuration(todayTotal)}
                </span>
              </div>
            )}
          </>
        )}
      </section>
    </Card>
  )
}
