import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getLateMinutes } from '../../team/services/attendanceStatsUtils'
import { matchEmployees, samePerson } from './snapshotBuilder'

const ACTIVE_PROJECT = /active|in_progress|in progress|ongoing|open/

function names(list) {
  const unique = [...new Set(list.filter(Boolean))]
  return unique.length ? unique.join(', ') : 'None'
}

function teamEmployees(snapshot) {
  return (snapshot?.employees || []).filter((employee) => {
    const role = String(employee.role || employee.accountType || '').toLowerCase()
    return role !== 'admin' && role !== 'owner'
  })
}

function todayLogs(snapshot) {
  const day = snapshot?.today || ''
  return (snapshot?.attendanceLogs || []).filter((row) => !day || String(row.date || '') === day)
}

function isPresent(row) {
  if (row?.present === false) return false
  return row?.present === true || row?.onDuty === true || row?.clockedIn === true || Boolean(row?.clockInTime)
}

function personName(row) {
  return row?.employeeName || row?.displayName || row?.name || 'Unknown'
}

function projectReport(snapshot, people) {
  const projects = (snapshot.projects || []).filter((project) => {
    const status = String(project.status || 'active').toLowerCase()
    if (/complete|cancel|archived|closed/.test(status)) return false
    if (status && !ACTIVE_PROJECT.test(status) && status !== 'active') return false
    if (!people.length) return true
    return samePerson(project, people) || (project.members || []).some((member) => samePerson(member, people))
  })
  if (!projects.length) return 'No active projects are on record.'
  const lines = ['Active projects:']
  projects.slice(0, 25).forEach((project) => {
    const team = (project.members || []).map((member) => member.displayName || member.name).filter(Boolean)
    const client = project.clientName || 'No client set'
    const who = team.length ? team.join(', ') : project.ownerName || 'No team listed'
    lines.push(`- ${project.name || 'Untitled'} — client: ${client} — team: ${who}`)
  })
  return lines.join('\n')
}

function presentReport(logs) {
  const rows = logs.filter(isPresent)
  return `Working today (${rows.length}): ${names(rows.map(personName))}`
}

function absentReport(snapshot, logs) {
  const presentIds = new Set(logs.filter(isPresent).map((row) => String(row.uid || '')))
  const presentNames = new Set(logs.filter(isPresent).map((row) => personName(row).toLowerCase()))
  const absent = teamEmployees(snapshot).filter((employee) => {
    const id = String(employee.uid || employee.employeeId || '')
    const name = String(employee.displayName || employee.name || '').toLowerCase()
    return !presentIds.has(id) && !presentNames.has(name)
  })
  const label = absent.map((employee) => employee.displayName || employee.name || employee.email)
  return `Absent today (${label.length}): ${names(label)}`
}

function floorReport(snapshot, logs) {
  return [presentReport(logs), absentReport(snapshot, logs), lateReport(logs), breakReport(logs)].join('\n\n')
}

function lateReport(logs) {
  const late = logs
    .map((row) => ({ name: personName(row), minutes: getLateMinutes(row.clockInTime), clock: row.clockInTime }))
    .filter((row) => row.minutes > 0)
  if (!late.length) return 'Nobody is late today. Late means a clock-in after 10:40 AM.'
  const lines = ['Late today (after 10:40 AM):']
  late.forEach((row) => lines.push(`- ${row.name} — clocked in ${row.clock || 'unknown'} (${row.minutes} min late)`))
  return lines.join('\n')
}

function breakReport(logs) {
  const rows = logs.filter((row) => row.isOnBreak === true)
  if (!rows.length) return 'Nobody is on break right now.'
  return `On break (${rows.length}): ${names(rows.map(personName))}`
}

function portalReport(snapshot, logs) {
  const byTeam = new Map()
  logs.filter(isPresent).forEach((row) => {
    const team = row.departmentName || departmentOf(snapshot, row) || 'No department'
    if (!byTeam.has(team)) byTeam.set(team, [])
    byTeam.get(team).push(personName(row))
  })
  if (!byTeam.size) return 'No team has clocked in on the portal today.'
  const lines = ['Teams using the portal today:']
  for (const [team, people] of byTeam) {
    lines.push(`- ${team}: ${names(people)}`)
  }
  const quiet = (snapshot.employees || [])
    .map((employee) => employee.departmentName)
    .filter((team) => team && !byTeam.has(team))
  const quietUnique = [...new Set(quiet)]
  if (quietUnique.length) lines.push(`Not clocked in today: ${quietUnique.join(', ')}`)
  return lines.join('\n')
}

function departmentOf(snapshot, row) {
  const id = String(row?.uid || '')
  const employee = (snapshot.employees || []).find((person) => String(person.uid || person.employeeId || '') === id)
  return employee?.departmentName || ''
}

function workFor(snapshot, person, day) {
  const entries = (snapshot.timelineEntries || []).filter(
    (row) => String(row.date || '') === day && samePerson(row, [person])
  )
  const hours = entries.reduce((sum, row) => sum + (Number(row.hours) || 0), 0)
  const notes = entries.map((row) => String(row.description || '').trim()).filter(Boolean)
  return { hours, notes }
}

function timesheetRows(snapshot, people) {
  const day = snapshot.today || ''
  const logs = todayLogs(snapshot)
  const targets = people.length ? people : teamEmployees(snapshot)
  return targets.slice(0, 80).map((person) => {
    const log = logs.find((row) => samePerson(row, [person]))
    const work = workFor(snapshot, person, day)
    const clockHours = Number(log?.regularSeconds) > 0 ? Math.round((Number(log.regularSeconds) / 3600) * 10) / 10 : 0
    const hours = work.hours || clockHours
    return {
      name: person.displayName || person.name || person.email || personName(log || {}),
      department: person.departmentName || log?.departmentName || '—',
      clockIn: log?.clockInTime || '—',
      hours: `${hours}h`,
      work: work.notes.join('; ') || (log ? 'Clocked in, no task notes' : 'No timesheet today'),
    }
  })
}

function timesheetText(rows, day) {
  const lines = [`Timesheets for ${day || 'today'}:`]
  rows.forEach((row) => {
    lines.push(`- ${row.name} (${row.department}) — ${row.hours}, in at ${row.clockIn}. ${row.work}`)
  })
  return lines.join('\n')
}

export function downloadTimesheetPdf(rows, day) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(14)
  doc.text(`Employee timesheets — ${day || 'today'}`, 40, 36)
  autoTable(doc, {
    startY: 52,
    head: [['Employee', 'Department', 'Clock in', 'Hours', 'Work']],
    body: rows.map((row) => [row.name, row.department, row.clockIn, row.hours, row.work]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [13, 122, 110] },
  })
  doc.save(`timesheets-${day || 'today'}.pdf`)
}

/**
 * Answers the admin floor questions from live records. Returns null when the
 * question is outside this set so the AI function can try.
 */
export function answerOperationalQuestion(snapshot, message, history = []) {
  if (!snapshot) return null
  const q = String(message || '').toLowerCase().trim()
  const priorUser = (history || [])
    .filter((item) => item.role === 'user')
    .slice(-3)
    .map((item) => String(item.content || ''))
    .join(' ')
    .toLowerCase()
  const followUp = /^(for all|all|everyone|all employees|show all)$/.test(q)
  const text = followUp ? `${priorUser} ${q}` : q
  const people = matchEmployees(snapshot.employees, text)
  const logs = todayLogs(snapshot)
  const wantsPdf = /pdf|download/.test(text)

  if (/\btimesheets?\b|\btime sheet\b/.test(text)) {
    const named = people.length && !/all|every|everyone|team/.test(q)
    const rows = timesheetRows(snapshot, named ? people : [])
    return {
      answer: timesheetText(rows, snapshot.today) + (wantsPdf ? '\n\nThe PDF download has started.' : ''),
      toolsUsed: ['timesheet'],
      pdfRows: wantsPdf ? rows : null,
      today: snapshot.today,
    }
  }

  if (/\bprojects?\b/.test(text) && !/employee|absent|present|working/.test(text)) {
    return { answer: projectReport(snapshot, people), toolsUsed: ['projects'] }
  }
  const wantsBreak = /\bbreak\b/.test(text)
  const wantsLate = /\blate\b/.test(text)
  const wantsAbsent = /\babsent\b|\babsence\b|\bnot (in|working|present)\b/.test(text)
  const wantsPresent = /present|clocked in|\bworking\b/.test(text) || (/how many/.test(text) && /employee|staff|people|working|present/.test(text))
  const asked = [wantsBreak, wantsLate, wantsPresent, wantsAbsent].filter(Boolean).length
  if (followUp || asked > 1) {
    return { answer: floorReport(snapshot, logs), toolsUsed: ['attendance'] }
  }
  if (wantsBreak) return { answer: breakReport(logs), toolsUsed: ['attendance'] }
  if (wantsLate) return { answer: lateReport(logs), toolsUsed: ['attendance'] }
  if (wantsAbsent) return { answer: absentReport(snapshot, logs), toolsUsed: ['attendance'] }
  if (/portal/.test(text) || (/team/.test(text) && /using|clock|present|today|working/.test(text))) {
    return { answer: portalReport(snapshot, logs), toolsUsed: ['attendance'] }
  }
  if (wantsPresent) return { answer: presentReport(logs), toolsUsed: ['attendance'] }
  return null
}
