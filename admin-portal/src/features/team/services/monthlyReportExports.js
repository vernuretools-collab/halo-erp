import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { listDatesInMonth } from './monthlyReportEngine'
import { formatSecondsToHrsMins, formatTo12HourTime } from './attendanceStatsUtils'
import { LOP_LEAVE_TYPE } from './leaveEntitlementUtils'

const SUMMARY_HEADERS = [
  'Employee',
  'Email',
  'Month',
  'Working Days',
  'Eligible Working Days',
  'Present',
  'Absent',
  'Late',
  'On Time',
  'On Duty',
  'WFH',
  'Leave Approved (days)',
  'Leave Pending (days)',
  'LOP (unpaid)',
  'Unpaid Days (LOP + Absent)',
  'Attendance %',
  'Avg Hours',
  'Total Hours',
  'Extra Hours',
  'Total Late Minutes',
  'Avg Check-In',
  'Avg Check-Out',
  'Timeline Hours',
  'Timeline Work Hours',
  'Timeline Upskill Hours',
  'Timeline Entries',
]

const ATTENDANCE_HEADERS = [
  'Employee',
  'Date',
  'Status',
  'Clock In',
  'Clock Out',
  'Break',
  'Working Hours',
  'Extra Hours',
  'Late Minutes',
  'Leave / PTO',
  'WFH',
  'On Duty',
  'Timeline Hours',
]

const TIMELINE_HEADERS = [
  'Date',
  'Day',
  'Timeline content',
  'Duration',
  'Category',
  'Day total',
  'Clock-in',
  'Clock-out',
  'Employee Name',
]

const LEAVE_HEADERS = [
  'Employee',
  'Leave Type',
  'Start Date',
  'End Date',
  'Days in Month',
  'Status',
  'Leave ID',
]

function stamp(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}${m}${d}_${hh}${mm}${ss}`
}

export function overallReportFilename(month, date = new Date()) {
  return `Overall_Monthly_Report_${month}_${stamp(date)}.xlsx`
}

export function overallTimelineFilename(month, date = new Date()) {
  return `Overall_Work_Timeline_${month}_${stamp(date)}.pdf`
}

export function generatedAtLabel(date = new Date()) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function monthTitle(month) {
  const [y, m] = String(month || '').split('-').map(Number)
  if (!y || !m) return month || ''
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function excelDateSerial(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number)
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000
}

function dayName(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })
}

function shortDay(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const label = date.toLocaleDateString('en-US', { weekday: 'short' })
  return `${label} ${d}`
}

function durationLabel(hours) {
  const n = Math.round((Number(hours) || 0) * 100) / 100
  if (Number.isInteger(n)) return `${n}h`
  return `${n}h`
}

function dayTotalLabel(hours) {
  return `${durationLabel(hours)} of 8h`
}

function isLopLeave(leaveType) {
  const value = String(leaveType || '')
  return value === LOP_LEAVE_TYPE || value.startsWith('LOP')
}

function isPermissionLeaveType(leaveType) {
  return String(leaveType || '') === 'Permission'
}

export function attendanceStatus(row) {
  if (!row || row.isFuture || row.isBeforeJoin) return ''
  if (row.onDuty) return 'On Duty'
  if (row.wfh) return 'WFH'
  if (isLopLeave(row.leaveType) && !row.present) return 'LOP'
  if (row.leaveType && !row.present && !isPermissionLeaveType(row.leaveType)) return 'Leave'
  if (row.late) return 'Late'
  if (row.present) return 'Present'
  return 'Absent'
}

function blank(value) {
  return value == null || value === '' ? '' : value
}

function summaryRow(report, email) {
  const a = report.attendance || {}
  const leave = report.leave || {}
  const timeline = report.timeline || {}
  const lateMinutes = (report.daily || []).reduce(
    (sum, row) => sum + (Number(row.lateMinutes) || 0),
    0
  )
  const wfhDays = (report.daily || []).filter((row) => row.wfh).length
  return [
    report.displayName || '',
    email || '',
    report.month || '',
    a.workingDays ?? '',
    a.eligibleWorkingDays ?? '',
    a.presentDays ?? '',
    a.absentDays ?? '',
    a.lateDays ?? '',
    a.onTimeDays ?? '',
    a.onDutyDays ?? '',
    wfhDays,
    leave.approvedDays ?? '',
    leave.pendingDays ?? '',
    leave.lopDays ?? leave.unpaidLeaveDays ?? '',
    leave.unpaidDays ?? '',
    a.attendancePercentage ?? '',
    a.avgHours || '',
    a.totalRegularHoursLabel || formatSecondsToHrsMins(a.totalRegularSeconds),
    a.totalExtraHoursLabel || formatSecondsToHrsMins(a.totalExtraSeconds),
    lateMinutes,
    a.avgCheckIn || '',
    a.avgCheckOut || '',
    timeline.totalHours ?? 0,
    timeline.workHours ?? 0,
    timeline.upskillingHours ?? 0,
    timeline.entryCount ?? 0,
  ]
}

function attendanceRows(report) {
  return (report.daily || []).map((row) => [
    report.displayName || '',
    row.date,
    attendanceStatus(row),
    blank(row.clockInTime),
    blank(row.clockOutTime),
    formatSecondsToHrsMins(row.breakSeconds),
    formatSecondsToHrsMins(row.regularSeconds),
    formatSecondsToHrsMins(row.extraSeconds),
    row.lateMinutes ? row.lateMinutes : '',
    blank(row.leaveType),
    row.wfh ? 'Yes' : '',
    row.onDuty ? 'Yes' : '',
    row.timelineHours ? row.timelineHours : '',
  ])
}

function showClock(value) {
  if (!value || value === '—') return '—'
  if (value === 'In office') return 'In office'
  return formatTo12HourTime(value) || value
}

function clockFor(logsByDate, date) {
  const log = logsByDate[date]
  if (!log) return { clockIn: '—', clockOut: '—' }
  return { clockIn: showClock(log.clockInTime), clockOut: showClock(log.clockOutTime) }
}

function timelineSheetRows({ report, entries, logsByDate }) {
  const byDate = {}
  ;(entries || []).forEach((entry) => {
    if (!entry?.date) return
    if (!byDate[entry.date]) byDate[entry.date] = []
    byDate[entry.date].push(entry)
  })
  Object.values(byDate).forEach((list) => {
    list.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
  })

  const dailyByDate = {}
  ;(report.daily || []).forEach((row) => {
    dailyByDate[row.date] = row
  })

  const rows = []
  const merges = []
  listDatesInMonth(report.month).forEach((date) => {
    const dayEntries = byDate[date] || []
    const daily = dailyByDate[date]
    const clocks = daily
      ? {
          clockIn: daily.clockInTime || '—',
          clockOut: daily.clockOutTime || '—',
        }
      : clockFor(logsByDate, date)
    const total = dayEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0)
    const start = rows.length
    if (!dayEntries.length) {
      rows.push([
        date,
        dayName(date),
        'No entries',
        '',
        '',
        dayTotalLabel(0),
        clocks.clockIn,
        clocks.clockOut,
        report.displayName || '',
      ])
      return
    }
    dayEntries.forEach((entry, index) => {
      rows.push([
        index === 0 ? date : '',
        index === 0 ? dayName(date) : '',
        entry.description || '',
        durationLabel(entry.hours),
        entry.entryType === 'upskilling' ? 'Upskilling' : 'Work',
        dayTotalLabel(total),
        clocks.clockIn,
        clocks.clockOut,
        report.displayName || '',
      ])
    })
    if (dayEntries.length > 1) {
      merges.push(
        { s: { c: 0, r: start }, e: { c: 0, r: start + dayEntries.length - 1 } },
        { s: { c: 1, r: start }, e: { c: 1, r: start + dayEntries.length - 1 } }
      )
    }
  })
  return { rows, merges }
}

function applyDateColumn(sheet, rowIndexes, column = 0) {
  rowIndexes.forEach((rowIndex) => {
    const cell = sheet[XLSX.utils.encode_cell({ c: column, r: rowIndex })]
    if (!cell || typeof cell.v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(cell.v)) return
    cell.t = 'n'
    cell.v = excelDateSerial(cell.v)
    cell.z = 'yyyy-mm-dd'
  })
}

export function buildOverallMonthlyWorkbook({ employees, reports, timelineEntries, attendanceLogs }) {
  const emailByUid = {}
  ;(employees || []).forEach((employee) => {
    const id = employee.uid || employee.employeeId || employee.id
    if (id) emailByUid[id] = employee.email || ''
  })

  const summary = [SUMMARY_HEADERS]
  const attendance = [ATTENDANCE_HEADERS]
  const timeline = [
    ['8-hour Work Timeline — Month', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    TIMELINE_HEADERS,
  ]
  const leave = [LEAVE_HEADERS]
  const timelineMerges = [
    { s: { c: 0, r: 0 }, e: { c: 8, r: 0 } },
    { s: { c: 0, r: 1 }, e: { c: 8, r: 1 } },
    { s: { c: 0, r: 2 }, e: { c: 8, r: 2 } },
  ]
  const attendanceDateRows = []
  const timelineDateRows = []

  const month = reports[0]?.month || ''
  const { start, end } = month
    ? { start: `${month}-01`, end: listDatesInMonth(month).at(-1) }
    : { start: '', end: '' }
  timeline[1][0] = `Period: ${start} to ${end}`
  timeline[2][0] =
    `Scope: All employees  ·  8h target on Monday–Saturday  ·  Generated: ${generatedAtLabel()}`

  const logsByUid = {}
  ;(attendanceLogs || []).forEach((log) => {
    if (!log?.uid || !log?.date) return
    if (!logsByUid[log.uid]) logsByUid[log.uid] = {}
    logsByUid[log.uid][log.date] = log
  })

  const entriesByUid = {}
  ;(timelineEntries || []).forEach((entry) => {
    const uid = entry.uid || entry.userId || entry.employeeId
    if (!uid) return
    if (!entriesByUid[uid]) entriesByUid[uid] = []
    entriesByUid[uid].push(entry)
  })

  ;(reports || []).forEach((report) => {
    summary.push(summaryRow(report, emailByUid[report.uid] || ''))
    ;(report.leave?.requests || []).forEach((request) => {
      leave.push([
        report.displayName || '',
        request.leaveType || '',
        request.startDate || '',
        request.endDate || '',
        request.days ?? '',
        request.status || '',
        request.leaveId || '',
      ])
    })
    attendanceRows(report).forEach((row) => {
      attendanceDateRows.push(attendance.length)
      attendance.push(row)
    })
    const built = timelineSheetRows({
      report,
      entries: entriesByUid[report.uid] || [],
      logsByDate: logsByUid[report.uid] || {},
    })
    built.rows.forEach((row) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(row[0])) timelineDateRows.push(timeline.length)
      timeline.push(row)
    })
    built.merges.forEach((merge) => {
      timelineMerges.push({
        s: { c: merge.s.c, r: merge.s.r + 5 + (timeline.length - built.rows.length - 5) },
        e: { c: merge.e.c, r: merge.e.r + 5 + (timeline.length - built.rows.length - 5) },
      })
    })
  })

  // Recompute timeline merges against the actual header offset. The loop above
  // uses a shifting length, so build merges from a second pass instead.
  const timelineBodyStart = 5
  const cleanMerges = timelineMerges.slice(0, 3)
  let cursor = timelineBodyStart
  ;(reports || []).forEach((report) => {
    const built = timelineSheetRows({
      report,
      entries: entriesByUid[report.uid] || [],
      logsByDate: logsByUid[report.uid] || {},
    })
    built.merges.forEach((merge) => {
      cleanMerges.push({
        s: { c: merge.s.c, r: merge.s.r + cursor },
        e: { c: merge.e.c, r: merge.e.r + cursor },
      })
    })
    cursor += built.rows.length
  })

  const summarySheet = XLSX.utils.aoa_to_sheet(summary)
  const attendanceSheet = XLSX.utils.aoa_to_sheet(attendance)
  const timelineSheet = XLSX.utils.aoa_to_sheet(timeline)
  const leaveSheet = XLSX.utils.aoa_to_sheet(leave)
  applyDateColumn(attendanceSheet, attendanceDateRows, 1)
  applyDateColumn(timelineSheet, timelineDateRows, 0)
  timelineSheet['!merges'] = cleanMerges

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')
  XLSX.utils.book_append_sheet(wb, attendanceSheet, 'Attendance')
  XLSX.utils.book_append_sheet(wb, timelineSheet, 'Timeline')
  XLSX.utils.book_append_sheet(wb, leaveSheet, 'Leave')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function weeksOfMonth(month) {
  const dates = listDatesInMonth(month).filter((date) => {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, m - 1, d).getDay() !== 0
  })
  const weeks = []
  let current = []
  let currentKey = ''
  dates.forEach((date) => {
    const [y, m, d] = date.split('-').map(Number)
    const day = new Date(y, m - 1, d)
    const monday = new Date(day)
    const offset = day.getDay() === 0 ? -6 : 1 - day.getDay()
    monday.setDate(day.getDate() + offset)
    const key = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`
    if (currentKey && key !== currentKey) {
      weeks.push(current)
      current = []
    }
    currentKey = key
    current.push(date)
  })
  if (current.length) weeks.push(current)
  return weeks
}

function pdfDayLine(daily) {
  if (!daily || daily.isFuture || daily.isBeforeJoin) return ''
  const clockIn = daily.clockInTime || '-'
  const clockOut = daily.clockOutTime || '-'
  const hours =
    daily.regularSeconds > 0 && daily.clockOutTime && daily.clockOutTime !== 'In office'
      ? `  ${formatSecondsToHrsMins(daily.regularSeconds)}`
      : ''
  return `In ${clockIn}  Out ${clockOut}${hours}`
}

export function buildTimelinePdf({ report, entries }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 28
  const name = report?.displayName || 'Employee'
  const month = report?.month || ''
  const title = monthTitle(month)
  const timeline = report?.timeline || {}
  const total = timeline.totalHours ?? 0
  const count = timeline.entryCount ?? (entries || []).length
  const footer = `Overall Monthly Work Timeline  -  ${title}  -  ${name}`

  const byDate = {}
  ;(entries || []).forEach((entry) => {
    if (!entry?.date) return
    if (!byDate[entry.date]) byDate[entry.date] = []
    byDate[entry.date].push(entry)
  })
  const dailyByDate = {}
  ;(report?.daily || []).forEach((row) => {
    dailyByDate[row.date] = row
  })

  const weeks = weeksOfMonth(month)
  const gap = 8
  const colW = (pageWidth - margin * 2 - gap * 5) / 6
  let page = 1
  let y = margin

  const drawFooter = () => {
    doc.setFontSize(9)
    doc.setTextColor(80)
    doc.text(footer, margin, pageHeight - 18)
    doc.text(`Page ${page}`, pageWidth - margin, pageHeight - 18, { align: 'right' })
    doc.setTextColor(20)
  }

  const newPage = () => {
    drawFooter()
    doc.addPage()
    page += 1
    y = margin
  }

  doc.setFontSize(16)
  doc.text('Overall Monthly Work Timeline', margin, y + 12)
  y += 28
  doc.setFontSize(10)
  doc.setTextColor(70)
  doc.text(`${title}  ·  ${name}  ·  Generated ${generatedAtLabel()}`, margin, y)
  doc.setTextColor(20)
  y += 22
  doc.setFontSize(11)
  doc.text(name, margin, y)
  doc.text(`Month total: ${durationLabel(total)}  ·  ${count} entries`, pageWidth - margin, y, {
    align: 'right',
  })
  y += 16

  weeks.forEach((week) => {
    const cardPad = 6
    const bodies = week.map((date) => {
      const dayEntries = byDate[date] || []
      const lines = dayEntries.length
        ? dayEntries.map((entry) => `${entry.description || 'Entry'}  ${durationLabel(entry.hours)}`)
        : ['No entries']
      return lines
    })
    const maxLines = Math.max(...bodies.map((lines) => lines.length), 1)
    const cardH = 58 + maxLines * 11
    if (y + cardH > pageHeight - 36) newPage()

    week.forEach((date, index) => {
      const x = margin + index * (colW + gap)
      const daily = dailyByDate[date]
      const dayEntries = byDate[date] || []
      const totalHours = dayEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0)
      doc.setDrawColor(210)
      doc.setFillColor(250, 250, 250)
      doc.roundedRect(x, y, colW, cardH, 4, 4, 'FD')
      doc.setFontSize(9)
      doc.setTextColor(20)
      doc.text(shortDay(date), x + cardPad, y + 14)
      doc.setTextColor(90)
      doc.text(dayTotalLabel(totalHours), x + colW - cardPad, y + 14, { align: 'right' })
      doc.setFontSize(8)
      doc.setTextColor(140)
      doc.text('View only', x + cardPad, y + 26)
      doc.setTextColor(40)
      const attendance = pdfDayLine(daily)
      if (attendance) doc.text(attendance, x + cardPad, y + 40, { maxWidth: colW - cardPad * 2 })
      doc.setTextColor(30)
      bodies[index].forEach((line, lineIndex) => {
        const wrapped = doc.splitTextToSize(line, colW - cardPad * 2)
        doc.text(wrapped.slice(0, 2), x + cardPad, y + 54 + lineIndex * 11)
      })
    })
    y += cardH + gap
  })

  drawFooter()
  return doc.output('blob')
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Ask the admin where to save, then write the file.
 * Falls back to a browser download when the save picker is unavailable.
 * @returns {Promise<boolean>} false when the admin cancels the save dialog
 */
export async function saveBlob(filename, blob) {
  if (typeof window.desktop?.saveFile === 'function') {
    const data = new Uint8Array(await blob.arrayBuffer())
    const result = await window.desktop.saveFile({ filename, data })
    return Boolean(result?.saved)
  }
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Excel workbook',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return true
    } catch (err) {
      if (err?.name === 'AbortError') return false
      throw err
    }
  }
  downloadBlob(filename, blob)
  return true
}
