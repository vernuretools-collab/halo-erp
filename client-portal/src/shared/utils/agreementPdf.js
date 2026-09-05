const PAGE_W = 612
const PAGE_H = 792
const MARGIN_L = 50
const MARGIN_R = 50
const MARGIN_BOTTOM = 56
const BODY_SIZE = 9
const LINE_H = 12
const MAX_CHARS = 92

const encoder = new TextEncoder()

const toBytes = (str) => encoder.encode(str)

const concatBytes = (parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

const escapePdfString = (str) => {
  if (!str) return ''
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

const wrapText = (text) => {
  const lines = []
  const paragraphs = String(text || '').replace(/\r\n/g, '\n').split('\n')
  for (const para of paragraphs) {
    if (!para) {
      lines.push('')
      continue
    }
    const words = para.split(/\s+/)
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (next.length > MAX_CHARS) {
        if (current) lines.push(current)
        if (word.length > MAX_CHARS) {
          for (let i = 0; i < word.length; i += MAX_CHARS) {
            lines.push(word.slice(i, i + MAX_CHARS))
          }
          current = ''
        } else {
          current = word
        }
      } else {
        current = next
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

const dataUrlToJpeg = (dataUrl) =>
  new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      resolve(null)
      return
    }
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const maxW = 280
      const maxH = 80
      const scale = Math.min(maxW / img.width, maxH / img.height, 1)
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.88)
      const b64 = jpegDataUrl.split(',')[1]
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      resolve({ bytes, width: canvas.width, height: canvas.height })
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })

const shortCode = (id, title) => {
  const fromId = String(id || '').toUpperCase()
  if (fromId === 'MSA' || fromId === 'NDA' || fromId === 'SOW') return fromId
  const match = String(title || '').match(/\((MSA|NDA|SOW)\)/i)
  return (match?.[1] || fromId || 'AGR').toUpperCase()
}

const safeFilePart = (value) =>
  String(value || '')
    .replace(/[^a-zA-Z0-9-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'Client'

const textCmd = (font, size, x, y, str, color = '0 0 0') =>
  `${color} rg\nBT /${font} ${size} Tf ${x} ${y} Td (${escapePdfString(str)}) Tj ET`

const buildPageStreams = ({ title, clientName, bodyLines, signed, signatoryName, signatoryTitle, signedAt, jpeg }) => {
  const streams = []
  let lineIndex = 0
  const certLines = signed
    ? [
        'ELECTRONIC SIGNATURE CERTIFICATE',
        `Status: Signed & Verified`,
        `Signatory: ${signatoryName || 'Authorized Representative'}`,
        `Title: ${signatoryTitle || 'Representative'}`,
        `Executed: ${signedAt || 'Upon digital signature'}`,
      ]
    : ['Status: Unsigned draft - not yet executed']

  const imgPtW = jpeg ? 160 : 0
  const imgPtH = jpeg ? Math.round((jpeg.height / jpeg.width) * imgPtW) : 0
  const certBlockH = signed ? 70 + (jpeg ? imgPtH + 12 : 0) : 28

  const startNewPage = () => {
    const cmds = []
    cmds.push(textCmd('F1', 11, MARGIN_L, 762, 'NEXT-GEN CRM SYSTEMS', '0.15 0.25 0.55'))
    cmds.push(textCmd('F2', 8, MARGIN_L, 750, 'Legal Agreement  |  Confidential'))
    cmds.push('0.85 0.85 0.85 RG 0.8 w 50 744 m 562 744 l S')
    cmds.push(textCmd('F1', 14, MARGIN_L, 724, title || 'Agreement'))
    cmds.push(textCmd('F2', 9, MARGIN_L, 708, `Client: ${clientName || 'Client Entity'}`))
    cmds.push('0.88 0.88 0.88 RG 0.6 w 50 700 m 562 700 l S')
    return { cmds, y: 684 }
  }

  let page = startNewPage()

  const ensureSpace = (needed) => {
    if (page.y - needed < MARGIN_BOTTOM) {
      streams.push(page)
      page = startNewPage()
    }
  }

  while (lineIndex < bodyLines.length) {
    ensureSpace(LINE_H)
    const line = bodyLines[lineIndex]
    if (line) {
      page.cmds.push(textCmd('F2', BODY_SIZE, MARGIN_L, page.y, line))
    }
    page.y -= LINE_H
    lineIndex += 1
  }

  ensureSpace(certBlockH + 16)
  page.y -= 8
  page.cmds.push(`0.15 0.25 0.55 RG 1 w ${MARGIN_L} ${page.y} m ${PAGE_W - MARGIN_R} ${page.y} l S`)
  page.y -= 18
  page.cmds.push(textCmd('F1', 10, MARGIN_L, page.y, certLines[0], signed ? '0.05 0.4 0.2' : '0.3 0.3 0.3'))
  page.y -= 14
  for (let i = 1; i < certLines.length; i++) {
    page.cmds.push(textCmd('F2', 9, MARGIN_L, page.y, certLines[i]))
    page.y -= 12
  }

  if (jpeg) {
    page.y -= 4
    const imgY = page.y - imgPtH
    page.cmds.push(`q\n${imgPtW} 0 0 ${imgPtH} ${MARGIN_L} ${imgY} cm\n/Im1 Do\nQ`)
    page.cmds.push(textCmd('F2', 7, MARGIN_L, imgY - 12, 'Signatory seal'))
  }

  streams.push(page)
  return streams
}

const assemblePdf = (pageStreams, jpeg) => {
  const pageCount = pageStreams.length
  const hasImage = Boolean(jpeg?.bytes)

  const objects = []
  objects.push(null)

  const pageObjNums = []
  const contentObjNums = []
  const fontBold = 3
  const fontReg = 4
  let nextObj = hasImage ? 6 : 5

  for (let i = 0; i < pageCount; i++) {
    pageObjNums.push(nextObj++)
    contentObjNums.push(nextObj++)
  }

  const kids = pageObjNums.map((n) => `${n} 0 R`).join(' ')

  objects[1] = toBytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objects[2] = toBytes(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`)
  objects[3] = toBytes('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n')
  objects[4] = toBytes('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')

  if (hasImage) {
    const header = toBytes(
      `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${jpeg.width} /Height ${jpeg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.bytes.length} >>\nstream\n`
    )
    const footer = toBytes('\nendstream\nendobj\n')
    objects[5] = concatBytes([header, jpeg.bytes, footer])
  }

  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1
    const stream = pageStreams[i]
    stream.cmds.push('0.85 0.85 0.85 RG 0.6 w 50 44 m 562 44 l S')
    stream.cmds.push(
      textCmd('F2', 8, MARGIN_L, 32, `Page ${pageNum} of ${pageCount}  |  Computer-generated legal record`, '0.4 0.4 0.4')
    )
    const content = stream.cmds.join('\n')
    const contentBytes = toBytes(content)
    const xObj = hasImage ? ' /XObject << /Im1 5 0 R >>' : ''
    objects[pageObjNums[i]] = toBytes(
      `${pageObjNums[i]} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontBold} 0 R /F2 ${fontReg} 0 R >>${xObj} >> /Contents ${contentObjNums[i]} 0 R >>\nendobj\n`
    )
    const streamHeader = toBytes(`${contentObjNums[i]} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`)
    const streamFooter = toBytes('\nendstream\nendobj\n')
    objects[contentObjNums[i]] = concatBytes([streamHeader, contentBytes, streamFooter])
  }

  const header = toBytes('%PDF-1.4\n')
  const parts = [header]
  const offsets = [0]
  let pos = header.length
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pos
    parts.push(objects[i])
    pos += objects[i].length
  }

  const xrefStart = pos
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  parts.push(toBytes(xref))
  return concatBytes(parts)
}

const triggerDownload = (bytes, filename) => {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadAgreementAsPDF = async ({
  id,
  title,
  content,
  clientName,
  signed,
  signatoryName,
  signatoryTitle,
  signedAt,
  signatureDataUrl,
} = {}) => {
  const jpeg = signed ? await dataUrlToJpeg(signatureDataUrl) : null
  const bodyLines = wrapText(content || 'Agreement text is not available.')
  const pageStreams = buildPageStreams({
    title: title || 'Agreement',
    clientName,
    bodyLines,
    signed: Boolean(signed),
    signatoryName,
    signatoryTitle,
    signedAt,
    jpeg,
  })
  const pdfBytes = assemblePdf(pageStreams, jpeg)
  const code = shortCode(id, title)
  const entity = safeFilePart(clientName)
  const status = signed ? 'signed' : 'draft'
  triggerDownload(pdfBytes, `${code}_${entity}_${status}.pdf`)
}

export const downloadAgreementRecordAsPDF = async ({
  id,
  title,
  content,
  sigRecord,
  clientName,
} = {}) => {
  const signed = Boolean(sigRecord?.signed)
  return downloadAgreementAsPDF({
    id,
    title: sigRecord?.signedTitle || title,
    content: sigRecord?.signedContent || content || '',
    clientName,
    signed,
    signatoryName: sigRecord?.signatoryName,
    signatoryTitle: sigRecord?.signatoryTitle,
    signedAt: sigRecord?.timestampFormatted || sigRecord?.signedAt,
    signatureDataUrl: sigRecord?.signatureDataUrl,
  })
}
