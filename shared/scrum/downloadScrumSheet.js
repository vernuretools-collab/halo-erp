import { jsPDF } from 'jspdf'
import { formatLongDate } from './scrumModel.js'

const MARGIN = 40
const TEAL = [13, 122, 110]
const INK = [30, 41, 59]
const MUTED = [100, 116, 139]
const LINE = [226, 232, 240]
const HEAD_BG = [236, 253, 245]
const ROW_ALT = [248, 250, 252]

const COLUMNS = [
  { key: 'employee', header: 'Employee', width: 130 },
  { key: 'morningScrum', header: 'Morning scrum', width: 192 },
  { key: 'eodUpdate', header: 'EOD update', width: 193 },
]

function pdfName(filename) {
  const base = String(filename || 'scrum')
    .replace(/\.xlsx?$/i, '')
    .replace(/\.pdf$/i, '')
  return `${base}.pdf`
}

function dateLabel(rows) {
  const iso = String(rows[0]?.date || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Daily board'
  return formatLongDate(iso)
}

function linesFor(doc, text, width, fontSize) {
  doc.setFontSize(fontSize)
  const raw = String(text ?? '').trim()
  return doc.splitTextToSize(raw || '—', width - 12)
}

export function buildScrumPdf(rows) {
  const list = Array.isArray(rows) ? rows : []
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const tableW = COLUMNS.reduce((sum, column) => sum + column.width, 0)
  let y = 0

  function paintHeader() {
    doc.setFillColor(...TEAL)
    doc.rect(0, 0, pageW, 64, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Scrum update', MARGIN, 28)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(dateLabel(list), MARGIN, 46)
    doc.setFontSize(8)
    doc.text('The Halo Effect Consulting', pageW - MARGIN, 28, { align: 'right' })
    y = 80
    paintColumnTitles()
  }

  function paintColumnTitles() {
    doc.setFillColor(...HEAD_BG)
    doc.rect(MARGIN, y, tableW, 22, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEAL)
    let x = MARGIN
    COLUMNS.forEach((column) => {
      doc.text(column.header, x + 6, y + 14)
      x += column.width
    })
    y += 22
  }

  function ensure(height) {
    if (y + height <= pageH - 36) return
    doc.addPage()
    paintHeader()
  }

  paintHeader()
  doc.setFont('helvetica', 'normal')

  list.forEach((row, index) => {
    const nameLines = linesFor(doc, row.employee, COLUMNS[0].width, 9)
    const emailLines = String(row.email || '').trim()
      ? linesFor(doc, row.email, COLUMNS[0].width, 8)
      : []
    const morningLines = linesFor(doc, row.morningScrum, COLUMNS[1].width, 9)
    const eodLines = linesFor(doc, row.eodUpdate, COLUMNS[2].width, 9)
    const textHeight = Math.max(
      nameLines.length * 12 + emailLines.length * 10,
      morningLines.length * 12,
      eodLines.length * 12,
    )
    const height = Math.max(28, textHeight + 14)
    ensure(height)

    if (index % 2 === 1) {
      doc.setFillColor(...ROW_ALT)
      doc.rect(MARGIN, y, tableW, height, 'F')
    }
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.4)
    doc.line(MARGIN, y + height, MARGIN + tableW, y + height)

    let x = MARGIN
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(nameLines, x + 6, y + 14)
    if (emailLines.length) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(emailLines, x + 6, y + 14 + nameLines.length * 12)
    }
    x += COLUMNS[0].width

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...INK)
    doc.text(morningLines, x + 6, y + 14)
    x += COLUMNS[1].width
    doc.text(eodLines, x + 6, y + 14)
    y += height
  })

  if (!list.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text('No employees on this day.', MARGIN, y + 20)
  }

  const pages = doc.internal.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('The Halo Effect Consulting', MARGIN, pageH - 20)
    doc.text(`Page ${page} of ${pages}`, pageW - MARGIN, pageH - 20, { align: 'right' })
  }

  return doc
}

/** PDF the admin can attach in WhatsApp. Excel rejects the old XML .xls file. */
export function downloadScrumSheet(filename, rows) {
  buildScrumPdf(rows).save(pdfName(filename))
}
