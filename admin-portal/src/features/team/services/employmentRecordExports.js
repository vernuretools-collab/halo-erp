import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { formatSecondsToHrsMins } from './attendanceStatsUtils'
import { downloadBlob, saveBlob } from './monthlyReportExports'
import { employmentRecordFilename } from './employmentRecordService'
import {
  employeeDepartment,
  employeeDesignation,
  employeeDisplayName,
  employeeJoiningDate,
  employeePublicId,
  employmentStatusLabel,
  isoDay,
} from '../../../../../shared/employees/employmentStatus.js'

function workbookBlob(sheets) {
  const book = XLSX.utils.book_new()
  sheets.forEach(([name, rows]) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows.length ? rows : [['No rows']])
    XLSX.utils.book_append_sheet(book, sheet, name.slice(0, 31))
  })
  const data = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
  return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

function summaryRows(record) {
  return [
    ['Employee', record.name],
    ['Employee ID', record.employeeId],
    ['Designation', record.designation],
    ['Department', record.department],
    ['Employment status', record.statusLabel],
    ['Date of joining', record.joiningDate],
    ['Last working day', record.lastWorkingDay],
    ['Exit reason', record.exitReason],
    ['Employment period', record.tenure],
    ['Timeline hours', record.timelineHours],
    ['Attendance time', formatSecondsToHrsMins(record.attendanceSeconds)],
  ]
}

function timelineRows(record) {
  return [
    ['Date', 'Hours', 'Type', 'Text'],
    ...record.timeline.map((entry) => [entry.date || '', entry.hours || 0, entry.entryType || 'work', entry.description || '']),
  ]
}

function attendanceRows(record) {
  return [
    ['Date', 'Clock in', 'Clock out', 'Working time', 'Present'],
    ...record.attendance.map((log) => [
      log.date || '',
      log.clockInTime || '',
      log.clockOutTime || '',
      formatSecondsToHrsMins(log.regularSeconds || 0),
      log.present || log.clockedIn ? 'Yes' : '',
    ]),
  ]
}

function leaveRows(record) {
  return [
    ['Type', 'Start', 'End', 'Status', 'Reason', 'Hours'],
    ...record.leave.map((request) => [
      request.leaveType || request.requestedLeaveType || request.requestKind || '',
      request.startDate || '',
      request.endDate || '',
      request.status || '',
      request.reason || request.notes || '',
      request.hours || request.permissionHours || '',
    ]),
  ]
}

function projectRows(record) {
  const rows = [['Project', 'Task', 'Description', 'Kind', 'Update or comment', 'When']]
  record.projects.forEach((project) => {
    rows.push([project.name, '', project.description || '', 'Project', '', ''])
    ;(project.updates || []).forEach((update) => {
      rows.push([project.name, '', '', 'Update', update.text, update.at || ''])
    })
    project.tasks.forEach((task) => {
      rows.push([project.name, task.title, task.description || '', 'Task', '', ''])
      task.notes.forEach((note) => {
        rows.push([project.name, task.title, '', note.kind, note.text, note.at || ''])
      })
    })
  })
  return rows
}

function scrumRows(record) {
  return [
    ['Date', 'Morning scrum', 'End of day'],
    ...record.scrum.map((row) => [row.date || '', row.morningScrum || '', row.eodUpdate || '']),
  ]
}

function onboardingRows(record) {
  return [['Field', 'Answer'], ...record.onboarding.map(([field, answer]) => [field, answer])]
}

function documentRows(record) {
  return [['Name', 'Category', 'Date'], ...record.documents.map((file) => [file.name, file.category, file.date])]
}

export async function downloadEmploymentWorkbook(record, kind) {
  const sheets = {
    complete: [
      ['Summary', summaryRows(record)],
      ['Timesheets', timelineRows(record)],
      ['Attendance', attendanceRows(record)],
      ['Leave', leaveRows(record)],
      ['Projects', projectRows(record)],
      ['Scrum', scrumRows(record)],
      ['Onboarding', onboardingRows(record)],
      ['Documents', documentRows(record)],
    ],
    attendance: [['Attendance', attendanceRows(record)]],
    timesheets: [['Timesheets', timelineRows(record)]],
    leave: [['Leave', leaveRows(record)]],
  }[kind]
  const suffix = { complete: 'complete', attendance: 'attendance', timesheets: 'timesheets', leave: 'leave' }[kind]
  const filename = employmentRecordFilename(record, 'xlsx').replace('.xlsx', `_${suffix}.xlsx`)
  return saveBlob(filename, workbookBlob(sheets))
}

export function downloadExEmployeeRegister(employees) {
  const rows = [
    ['Name', 'Employee ID', 'Designation', 'Department', 'Date of joining', 'Last working day', 'Exit reason', 'Employment status'],
    ...employees.map((employee) => [
      employeeDisplayName(employee),
      employeePublicId(employee),
      employeeDesignation(employee),
      employeeDepartment(employee),
      employeeJoiningDate(employee),
      isoDay(employee.lastWorkingDay),
      employee.exitReason || '',
      employmentStatusLabel(employee.status),
    ]),
  ]
  downloadBlob('ex_employees.xlsx', workbookBlob([['Ex-Employees', rows]]))
}

function writeLines(doc, lines) {
  const margin = 40
  const width = doc.internal.pageSize.getWidth() - margin * 2
  let y = margin
  const pageHeight = doc.internal.pageSize.getHeight()
  const ensure = (height) => {
    if (y + height <= pageHeight - margin) return
    doc.addPage()
    y = margin
  }
  lines.forEach((line) => {
    if (line.heading) {
      ensure(22)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(line.heading, margin, y)
      y += 18
      return
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const wrapped = doc.splitTextToSize(String(line.text || ''), width)
    wrapped.forEach((part) => {
      ensure(12)
      doc.text(part, margin, y)
      y += 12
    })
  })
}

export function downloadEmploymentPdf(record) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const lines = [
    { heading: 'Employment record' },
    { text: `${record.name} · ${record.employeeId}` },
    { text: `${record.designation} · ${record.department}` },
    { text: `Status: ${record.statusLabel}` },
    { text: `Period: ${record.joiningDate || '—'} to ${record.lastWorkingDay || '—'} (${record.tenure || '—'})` },
    { text: `Time worked: ${record.timelineHours} timeline hours, ${formatSecondsToHrsMins(record.attendanceSeconds)} attendance` },
    { text: `Exit reason: ${record.exitReason || '—'}` },
    { heading: 'Work timeline' },
  ]
  if (!record.timeline.length) lines.push({ text: 'No timeline lines in this period.' })
  record.timeline.forEach((entry) => {
    lines.push({ text: `${entry.date || ''} · ${entry.hours || 0}h · ${entry.description || ''}` })
  })
  lines.push({ heading: 'Projects, tasks, updates, and comments' })
  if (!record.projects.length) lines.push({ text: 'No project work in this period.' })
  record.projects.forEach((project) => {
    lines.push({ text: `${project.name}${project.description ? ` — ${project.description}` : ''}` })
    ;(project.updates || []).forEach((update) => lines.push({ text: `Update: ${update.text}` }))
    project.tasks.forEach((task) => {
      lines.push({ text: `Task: ${task.title}${task.description ? ` — ${task.description}` : ''}` })
      task.notes.forEach((note) => lines.push({ text: `${note.kind}: ${note.text}` }))
    })
  })
  lines.push({ heading: 'Morning scrum and end of day' })
  if (!record.scrum.length) lines.push({ text: 'No scrum notes in this period.' })
  record.scrum.forEach((row) => {
    lines.push({ text: `${row.date} · Morning: ${row.morningScrum || '—'}` })
    lines.push({ text: `${row.date} · End of day: ${row.eodUpdate || '—'}` })
  })
  lines.push({ heading: 'Attendance' })
  if (!record.attendance.length) lines.push({ text: 'No attendance in this period.' })
  record.attendance.forEach((log) => {
    lines.push({
      text: `${log.date || ''} · in ${log.clockInTime || '—'} · out ${log.clockOutTime || '—'} · ${formatSecondsToHrsMins(log.regularSeconds || 0)}`,
    })
  })
  lines.push({ heading: 'Leave and permission' })
  if (!record.leave.length) lines.push({ text: 'No leave or permission requests in this period.' })
  record.leave.forEach((request) => {
    lines.push({
      text: `${request.leaveType || request.requestKind || 'Leave'} · ${request.startDate || ''} to ${request.endDate || request.startDate || ''} · ${request.status || ''}`,
    })
  })
  lines.push({ heading: 'Onboarding answers' })
  if (!record.onboarding.length) lines.push({ text: 'No onboarding answers linked to this employee.' })
  record.onboarding.forEach(([field, answer]) => lines.push({ text: `${field}: ${answer}` }))
  lines.push({ heading: 'Uploaded documents' })
  if (!record.documents.length) lines.push({ text: 'No uploaded documents.' })
  record.documents.forEach((file) => lines.push({ text: `${file.name} · ${file.category || 'document'} · ${file.date || ''}` }))
  writeLines(doc, lines)
  downloadBlob(employmentRecordFilename(record, 'pdf'), doc.output('blob'))
}
