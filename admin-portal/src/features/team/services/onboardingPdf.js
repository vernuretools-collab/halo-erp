import { jsPDF } from 'jspdf'

const TEAL = [13, 122, 110]
const GOLD = [176, 132, 42]
const INK = [30, 41, 59]
const MUTED = [100, 116, 139]

const FOOTER = [
  'The Halo Effect Consulting LLP · 83/11, Rajaji Street, Kumaran Nagar, Padi, Chennai – +91 73977 78891 · hello@thehaloeffectconsulting.com ·',
  '600 050                                                                 www.thehaloeffectconsulting.com',
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
  const bottom = pageH - 58
  let y = 48

  function paintFooter() {
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(1)
    doc.line(margin, pageH - 46, pageW - margin, pageH - 46)
    doc.setFont('times', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(FOOTER, pageW / 2, pageH - 34, { align: 'center' })
  }

  function newPage() {
    paintFooter()
    doc.addPage()
    y = 48
  }

  function need(height) {
    if (y + height > bottom) newPage()
  }

  function write(value, { size = 10, color = INK, style = 'normal', gap = 6, x = margin, maxWidth = width } = {}) {
    const text = String(value ?? '')
    doc.setFont('times', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, maxWidth)
    const height = lines.length * (size + 2)
    need(height + gap)
    doc.text(lines, x, y)
    y += height + gap
    return height
  }

  function brand() {
    need(34)
    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...TEAL)
    doc.text('THE HALO EFFECT', margin, y)
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    doc.text('The Halo Effect Consulting LLP', pageW - margin, y, { align: 'right' })
    y += 12
    doc.setFont('times', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GOLD)
    doc.text('CONSULTING', margin, y)
    doc.text('Where Insights Meet Influence', pageW - margin, y, { align: 'right' })
    y += 8
    doc.setDrawColor(...TEAL)
    doc.setLineWidth(1.4)
    doc.line(margin, y, pageW - margin, y)
    y += 16
  }

  function badge(label) {
    need(22)
    doc.setFillColor(...GOLD)
    doc.roundedRect(margin, y - 10, doc.getTextWidth(label) + 16, 16, 2, 2, 'F')
    doc.setFont('times', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text(label, margin + 8, y + 1)
    y += 16
  }

  function h1(value) {
    write(value, { size: 16, color: TEAL, style: 'bold', gap: 4 })
  }

  function h2(value) {
    write(value, { size: 11, color: TEAL, style: 'bold', gap: 4 })
  }

  function p(value) {
    write(value, { size: 10, gap: 8 })
  }

  function note(value) {
    write(value, { size: 9, color: MUTED, gap: 8 })
  }

  function bullets(items) {
    items.forEach((item) => write(`•  ${item}`, { size: 10, gap: 3 }))
    y += 6
  }

  function identity(rows) {
    const colW = width / 2
    rows.forEach(([leftLabel, leftValue, rightLabel, rightValue]) => {
      doc.setFont('times', 'bold')
      doc.setFontSize(9)
      const leftLines = doc.splitTextToSize(String(leftValue || '-'), colW - 16)
      const rightLines = doc.splitTextToSize(String(rightValue || '-'), colW - 16)
      const height = 18 + Math.max(leftLines.length, rightLines.length) * 11 + 6
      need(height)
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.rect(margin, y, colW, height, 'FD')
      doc.rect(margin + colW, y, colW, height, 'FD')
      doc.setFont('times', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...MUTED)
      doc.text(String(leftLabel), margin + 8, y + 12)
      doc.text(String(rightLabel), margin + colW + 8, y + 12)
      doc.setFont('times', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(146, 100, 20)
      doc.text(leftLines, margin + 8, y + 26)
      doc.text(rightLines, margin + colW + 8, y + 26)
      y += height
    })
    y += 10
  }

  function rows(pairs) {
    pairs.forEach(([label, value], index) => {
      doc.setFont('times', 'bold')
      doc.setFontSize(9)
      const labelLines = doc.splitTextToSize(String(label || ''), width * 0.42)
      doc.setFont('times', 'normal')
      const valueLines = doc.splitTextToSize(String(value || '-'), width * 0.5)
      const lineCount = Math.max(labelLines.length, valueLines.length, 1)
      const height = lineCount * 12 + 8
      need(height)
      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252)
        doc.rect(margin, y - 11, width, height, 'F')
      }
      doc.setFont('times', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...INK)
      doc.text(labelLines, margin + 8, y)
      doc.setFont('times', 'normal')
      doc.setTextColor(146, 100, 20)
      doc.text(valueLines, margin + width * 0.46, y)
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
    need(150)
    const top = y
    if (image && String(image).startsWith('data:image')) {
      try {
        doc.addImage(image, 'PNG', margin, top, 140, 42)
      } catch {
        /* unsigned */
      }
    }
    doc.setDrawColor(...INK)
    doc.line(margin, top + 50, margin + 200, top + 50)
    doc.line(margin + 250, top + 50, margin + 450, top + 50)
    doc.setFont('times', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('EMPLOYEE', margin, top + 64)
    doc.text('AUTHORISED SIGNATORY', margin + 250, top + 64)
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(146, 100, 20)
    doc.text(String(name || ''), margin, top + 78)
    doc.setTextColor(...TEAL)
    doc.text('Swathish G', margin + 250, top + 78)
    doc.setFont('times', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    doc.text(String(role || ''), margin, top + 90)
    doc.text('Co-Founder & Authorised Signatory', margin + 250, top + 90)
    doc.text('The Halo Effect Consulting LLP', margin + 250, top + 100)
    doc.setFont('times', 'bold')
    doc.setFontSize(8)
    doc.text('SIGNATURE & DATE', margin, top + 116)
    doc.text(`PLACE: ${place.toUpperCase()}`, margin, top + 126)
    doc.text('SIGNATURE, SEAL & DATE', margin + 250, top + 116)
    y = top + 140
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

  return { brand, badge, h1, h2, p, note, bullets, identity, rows, checks, signature, columns, write, save, doc }
}

export function fileSlug(name) {
  return String(name || 'employee').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'employee'
}
