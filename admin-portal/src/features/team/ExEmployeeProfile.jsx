import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TeamSubNav } from './components/TeamSubNav'
import { useUserStore } from '../../stores/userStore'
import { getEmployees } from './services/teamService'
import { loadEmploymentRecord } from './services/employmentRecordService'
import { downloadEmploymentPdf, downloadEmploymentWorkbook } from './services/employmentRecordExports'
import { archiveEmployeeRecord, returnEmployeeToActive } from './services/employeeExitService'
import { formatSecondsToHrsMins } from './services/attendanceStatsUtils'
import {
  EMPLOYMENT_STATUS,
  employeeDocId,
  employmentStatusLabel,
  isFormerEmployee,
} from '../../../../shared/employees/employmentStatus.js'

function Section({ title, empty, children }) {
  return (
    <Card className="p-4 space-y-3">
      <h2 className="text-sm font-bold text-fg">{title}</h2>
      {empty ? <p className="text-xs text-muted">{empty}</p> : children}
    </Card>
  )
}

export const ExEmployeeProfile = () => {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const { user, userDoc } = useUserStore()
  const actor = userDoc?.displayName || user?.email || 'Admin'
  const [employee, setEmployee] = useState(null)
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    let cancelled = false
    setError('')
    setRecord(null)
    getEmployees()
      .then(async (rows) => {
        const match = (rows || []).find((row) => employeeDocId(row) === decodeURIComponent(employeeId || ''))
        if (!match) throw new Error('Employee record was not found')
        if (cancelled) return
        setEmployee(match)
        const history = await loadEmploymentRecord(match)
        if (!cancelled) setRecord(history)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load this employment record.')
      })
    return () => {
      cancelled = true
    }
  }, [employeeId])

  const applyPatch = (patch) => {
    const next = { ...employee, ...patch, employeeDocId: employeeDocId(employee) }
    setEmployee(next)
    setRecord((current) => current && {
      ...current,
      employee: next,
      statusLabel: employmentStatusLabel(next.status),
      exitReason: next.exitReason ?? current.exitReason,
      lastWorkingDay: next.lastWorkingDay ?? current.lastWorkingDay,
      exitHistory: patch.exitHistory || current.exitHistory,
    })
  }

  const runAction = async (name, action) => {
    setBusy(name)
    setError('')
    try {
      const patch = await action()
      applyPatch(patch)
      if (name === 'active') navigate('/team/employees')
    } catch (err) {
      if (err?.saved && err.patch) applyPatch(err.patch)
      setError(err?.message || 'Could not update this employee.')
      if (err?.saved && name === 'active') navigate('/team/employees')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-6">
      <TeamSubNav />
      <PageHeader
        title={record?.name || 'Employment history'}
        description={record ? `${record.designation || 'Staff'} · ${record.department || 'No department'} · ${record.employeeId}` : 'Loading the original employee record.'}
        actions={
          record && (
            <>
              <Button variant="secondary" onClick={() => downloadEmploymentPdf(record)}>Employment PDF</Button>
              <Button variant="secondary" onClick={() => downloadEmploymentWorkbook(record, 'complete')}>Complete Excel</Button>
              <Button variant="secondary" onClick={() => downloadEmploymentWorkbook(record, 'attendance')}>Attendance</Button>
              <Button variant="secondary" onClick={() => downloadEmploymentWorkbook(record, 'timesheets')}>Timesheets</Button>
              <Button variant="secondary" onClick={() => downloadEmploymentWorkbook(record, 'leave')}>Leave</Button>
            </>
          )
        }
      />
      <Link to="/team/ex-employees" className="text-xs font-semibold text-accent">Back to ex-employees</Link>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!record && !error && <p className="text-sm text-muted">Loading employment history…</p>}
      {record && (
        <>
          <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-fg space-y-1">
              <p>Status: <strong>{record.statusLabel}</strong></p>
              <p>Period: {record.joiningDate || '—'} to {record.lastWorkingDay || '—'} ({record.tenure || '—'})</p>
              <p>Time worked: {record.timelineHours} timeline hours, {formatSecondsToHrsMins(record.attendanceSeconds)} attendance</p>
              <p>Exit reason: {record.exitReason || '—'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {employee?.status === EMPLOYMENT_STATUS.RELIEVED && (
                <Button variant="secondary" disabled={Boolean(busy)} onClick={() => runAction('archive', () => archiveEmployeeRecord(employee, actor))}>
                  {busy === 'archive' ? 'Archiving…' : 'Archive record'}
                </Button>
              )}
              {isFormerEmployee(employee) && (
                <Button disabled={Boolean(busy)} onClick={() => runAction('active', () => returnEmployeeToActive(employee, actor))}>
                  {busy === 'active' ? 'Restoring…' : 'Return to Active'}
                </Button>
              )}
            </div>
          </Card>

          <Section title="Work timeline" empty={record.timeline.length ? '' : 'No timeline lines in this period.'}>
            <ul className="space-y-2 text-xs">
              {record.timeline.map((entry) => (
                <li key={entry.entryId || `${entry.date}-${entry.description}`} className="border-b border-border/60 pb-2">
                  <span className="font-semibold text-fg">{entry.date}</span> · {entry.hours || 0}h · {entry.description}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Projects, tasks, updates, and comments" empty={record.projects.length ? '' : 'No project work in this period.'}>
            <div className="space-y-4 text-xs">
              {record.projects.map((project) => (
                <div key={project.id}>
                  <p className="font-semibold text-fg">{project.name}</p>
                  {project.description && <p className="text-muted">{project.description}</p>}
                  {(project.updates || []).map((update, index) => (
                    <p key={`${project.id}-update-${index}`}>Update: {update.text}</p>
                  ))}
                  {project.tasks.map((task) => (
                    <div key={task.id} className="mt-2 pl-3 border-l border-border">
                      <p className="font-medium text-fg">{task.title}</p>
                      {task.description && <p>{task.description}</p>}
                      {task.notes.map((note, index) => (
                        <p key={`${task.id}-note-${index}`}>{note.kind}: {note.text}</p>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Morning scrum and end of day" empty={record.scrum.length ? '' : 'No scrum notes in this period.'}>
            <ul className="space-y-2 text-xs">
              {record.scrum.map((row) => (
                <li key={`${row.id}-${row.date}`}>
                  <span className="font-semibold">{row.date}</span>
                  <p>Morning: {row.morningScrum || '—'}</p>
                  <p>End of day: {row.eodUpdate || '—'}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Attendance" empty={record.attendance.length ? '' : 'No attendance in this period.'}>
            <ul className="space-y-1 text-xs">
              {record.attendance.map((log) => (
                <li key={log.id}>{log.date} · in {log.clockInTime || '—'} · out {log.clockOutTime || '—'} · {formatSecondsToHrsMins(log.regularSeconds || 0)}</li>
              ))}
            </ul>
          </Section>

          <Section title="Leave and permission" empty={record.leave.length ? '' : 'No leave or permission requests in this period.'}>
            <ul className="space-y-1 text-xs">
              {record.leave.map((request) => (
                <li key={request.id || request.leaveId}>
                  {request.leaveType || request.requestKind || 'Leave'} · {request.startDate || '—'} to {request.endDate || request.startDate || '—'} · {request.status}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Onboarding answers" empty={record.onboarding.length ? '' : 'No onboarding answers linked to this employee.'}>
            <ul className="space-y-1 text-xs">
              {record.onboarding.map(([field, answer]) => (
                <li key={field}><span className="font-medium text-fg">{field}:</span> {answer}</li>
              ))}
            </ul>
          </Section>

          <Section title="Uploaded documents" empty={record.documents.length ? '' : 'No uploaded documents.'}>
            <ul className="space-y-1 text-xs">
              {record.documents.map((file) => (
                <li key={`${file.name}-${file.date}`}>{file.name} · {file.category || 'document'} · {file.date || '—'}</li>
              ))}
            </ul>
          </Section>

          <Section title="Exit history" empty={record.exitHistory.length ? '' : 'No exit history yet.'}>
            <ul className="space-y-1 text-xs">
              {record.exitHistory.map((entry, index) => (
                <li key={`${entry.at}-${index}`}>{entry.at} · {entry.action}{entry.exitReason ? ` · ${entry.exitReason}` : ''}</li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  )
}
