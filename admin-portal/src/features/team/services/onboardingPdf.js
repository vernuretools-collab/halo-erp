import { jsPDF } from 'jspdf'
import { HALO_WORDMARK } from './haloWordmark.js'

const TEAL = [13, 122, 110]
const GOLD = [176, 132, 42]
const INK = [30, 41, 59]
const MUTED = [100, 116, 139]
const LOGO_W = 180
const LOGO_H = 90

const FOOTER = [
  'The Halo Effect Consulting LLP · 83/11, Rajaji Street, Kumaran Nagar, Padi · +91 73977 78891 · hello@thehaloeffectconsulting.com',
  'Chennai – 600 050                                                      www.thehaloeffectconsulting.com',
]

export function formatPackDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-GB')
}

export function addDays(value, days) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('en-GB')
}

export function probationEndDate(value, period) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const text = String(period || '').toLowerCase()
  const months = text.includes('6') ? 6 : text.includes('1 month') ? 1 : text.includes('none') ? 0 : 3
  date.setMonth(date.getMonth() + months)
  return date.toLocaleDateString('en-GB')
}

export function firstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || ''
}

export function createPack() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 46
  const width = pageW - margin * 2
  const bottom = pageH - 52
  const headerTop = 18
  let y = 64
  let contentStart = 64

  function paintFooter() {
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(1)
    doc.line(margin, pageH - 46, pageW - margin, pageH - 46)
    doc.setFont('times', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(FOOTER, pageW / 2, pageH - 34, { align: 'center' })
  }

  function paintHeader() {
    paintLogo(margin, headerTop)
    const mid = headerTop + LOGO_H / 2
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...TEAL)
    doc.text('The Halo Effect Consulting LLP', pageW - margin, mid - 2, { align: 'right' })
    doc.setFont('times', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GOLD)
    doc.text('Where Insights Meet Influence', pageW - margin, mid + 12, { align: 'right' })
    const lineY = headerTop + LOGO_H + 6
    doc.setDrawColor(...TEAL)
    doc.setLineWidth(1.4)
    doc.line(margin, lineY, pageW - margin, lineY)
    y = lineY + 8
    contentStart = y
  }

  function newPage() {
    paintFooter()
    doc.addPage()
    paintHeader()
  }

  function need(height) {
    if (y + height > bottom) newPage()
  }

  function write(value, { size = 10, color = INK, style = 'normal', gap = 8, x = margin, maxWidth = width } = {}) {
    const text = String(value ?? '')
    doc.setFont('times', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, maxWidth)
    const lineHeight = size * 1.28
    const blockHeight = lines.length * lineHeight
    const hardBottom = pageH - 50
    if (lines.length > 0 && lines.length <= 4 && y + blockHeight <= hardBottom) {
      lines.forEach((line) => {
        doc.text(line, x, y)
        y += lineHeight
      })
    } else {
      lines.forEach((line) => {
        need(lineHeight)
        doc.text(line, x, y)
        y += lineHeight
      })
    }
    y += gap
    return lines.length * lineHeight
  }

  function paintLogo(x, top) {
    doc.addImage(HALO_WORDMARK, 'PNG', x, top, LOGO_W, LOGO_H)
  }

  function logo() {
    need(LOGO_H + 14)
    paintLogo((pageW - LOGO_W) / 2, y)
    y += LOGO_H + 14
  }

  function brand() {
    if (y > contentStart + 4) newPage()
  }

  function badge(label) {
    doc.setFont('times', 'bold')
    doc.setFontSize(8)
    const padX = 10
    const boxH = 18
    const boxW = doc.getTextWidth(String(label)) + padX * 2
    const gapBelow = 22
    need(boxH + gapBelow)
    const top = y
    doc.setFillColor(...GOLD)
    doc.roundedRect(margin, top, boxW, boxH, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(String(label), margin + padX, top + 12)
    y = top + boxH + gapBelow
  }

  function h1(value) {
    need(52)
    write(value, { size: 16, color: TEAL, style: 'bold', gap: 14 })
  }

  function h2(value) {
    need(26)
    write(value, { size: 11, color: TEAL, style: 'bold', gap: 6 })
  }

  function p(value) {
    write(value, { size: 10, gap: 5 })
  }

  function note(value) {
    write(value, { size: 9, color: MUTED, gap: 8 })
  }

  function bullets(items) {
    items.forEach((item) => write(`•  ${item}`, { size: 10, gap: 2 }))
    y += 2
  }

  function identity(rows) {
    const colW = width / 2
    rows.forEach(([leftLabel, leftValue, rightLabel, rightValue]) => {
      doc.setFont('times', 'bold')
      doc.setFontSize(9)
      const leftLines = doc.splitTextToSize(String(leftValue || '-'), colW - 24)
      const rightLines = doc.splitTextToSize(String(rightValue || '-'), colW - 24)
      const height = 28 + Math.max(leftLines.length, rightLines.length) * 12 + 10
      need(height)
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.rect(margin, y, colW, height, 'FD')
      doc.rect(margin + colW, y, colW, height, 'FD')
      doc.setFont('times', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...MUTED)
      doc.text(String(leftLabel), margin + 12, y + 16)
      doc.text(String(rightLabel), margin + colW + 12, y + 16)
      doc.setFont('times', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(146, 100, 20)
      doc.text(leftLines, margin + 12, y + 32)
      doc.text(rightLines, margin + colW + 12, y + 32)
      y += height
    })
    y += 12
  }

  function rows(pairs) {
    pairs.forEach(([label, value], index) => {
      doc.setFont('times', 'bold')
      doc.setFontSize(9)
      const labelLines = doc.splitTextToSize(String(label || ''), width * 0.42 - 20)
      doc.setFont('times', 'normal')
      const valueLines = doc.splitTextToSize(String(value || '-'), width * 0.5 - 20)
      const lineCount = Math.max(labelLines.length, valueLines.length, 1)
      const padY = 4
      const lineH = 12
      const height = lineCount * lineH + padY * 2
      need(height)
      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252)
        doc.rect(margin, y, width, height, 'F')
      }
      const textY = y + padY + 9
      doc.setFont('times', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...INK)
      doc.text(labelLines, margin + 10, textY)
      doc.setFont('times', 'normal')
      doc.setTextColor(146, 100, 20)
      doc.text(valueLines, margin + width * 0.46, textY)
      y += height
    })
    y += 6
  }

  function table(headers, body) {
    const colW = width / headers.length
    need(22)
    doc.setFillColor(...TEAL)
    doc.rect(margin, y, width, 18, 'F')
    doc.setFont('times', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    headers.forEach((header, index) => {
      doc.text(String(header), margin + 5 + index * colW, y + 12)
    })
    y += 18
    body.forEach((row, rowIndex) => {
      const height = 20
      need(height)
      if (rowIndex % 2 === 1) {
        doc.setFillColor(248, 250, 252)
        doc.rect(margin, y, width, height, 'F')
      }
      doc.setDrawColor(226, 232, 240)
      doc.rect(margin, y, width, height, 'S')
      doc.setFont('times', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...INK)
      row.forEach((cell, index) => {
        doc.text(String(cell || ''), margin + 5 + index * colW, y + 13)
      })
      y += height
    })
    y += 8
  }

  function checks(items, selected) {
    const chosen = new Set(selected || [])
    items.forEach((item) => {
      write(`${chosen.has(item) ? '[x]' : '[ ]'}  ${item}`, { size: 10, gap: 2 })
    })
    y += 4
  }

  function signature({ name, role, image, place = 'Chennai' }) {
    const block = 112
    if (y + block > pageH - 48) need(block)
    const top = y
    if (image && String(image).startsWith('data:image')) {
      try {
        doc.addImage(image, 'PNG', margin, top, 120, 32)
      } catch {
        /* unsigned */
      }
    }
    doc.setDrawColor(...INK)
    doc.line(margin, top + 34, margin + 200, top + 34)
    doc.line(margin + 250, top + 34, margin + 450, top + 34)
    doc.setFont('times', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('EMPLOYEE', margin, top + 46)
    doc.text('AUTHORISED SIGNATORY', margin + 250, top + 46)
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(146, 100, 20)
    doc.text(String(name || ''), margin, top + 58)
    doc.setTextColor(...TEAL)
    doc.text('Swathish G', margin + 250, top + 58)
    doc.setFont('times', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    doc.text(String(role || ''), margin, top + 70)
    doc.text('Co-Founder & Authorised Signatory', margin + 250, top + 70)
    doc.text('The Halo Effect Consulting LLP', margin + 250, top + 80)
    doc.setFont('times', 'bold')
    doc.setFontSize(8)
    doc.text('SIGNATURE & DATE', margin, top + 94)
    doc.text(`PLACE: ${place.toUpperCase()}`, margin, top + 104)
    doc.text('SIGNATURE, SEAL & DATE', margin + 250, top + 94)
    y = top + block
  }

  function columns(leftTitle, leftItems, rightTitle, rightItems) {
    const gap = 16
    const colW = (width - gap) / 2
    doc.setFont('times', 'normal')
    doc.setFontSize(9)
    const leftLines = leftItems.flatMap((item) => doc.splitTextToSize(`•  ${item}`, colW))
    const rightLines = rightItems.flatMap((item) => doc.splitTextToSize(`•  ${item}`, colW))
    const height = 18 + Math.max(leftLines.length, rightLines.length) * 12
    need(height + 8)
    const top = y
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...TEAL)
    doc.text(leftTitle, margin, top)
    doc.text(rightTitle, margin + colW + gap, top)
    doc.setFont('times', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...INK)
    doc.text(leftLines, margin, top + 16)
    doc.text(rightLines, margin + colW + gap, top + 16)
    y = top + height
  }

  function save(filename) {
    paintFooter()
    doc.save(filename)
  }

  function blob() {
    paintFooter()
    return doc.output('blob')
  }

  return { brand, logo, badge, h1, h2, p, note, bullets, identity, rows, table, checks, signature, columns, write, save, blob, doc }
}

export function fileSlug(name) {
  return String(name || 'employee').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'employee'
}
