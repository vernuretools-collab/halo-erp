import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { HALO_WORDMARK } from './haloWordmark.js'
import { fileSlug } from './onboardingPdf.js'

const PAGE_W = 794
const PAGE_H = 1123
const PDF_W = 595.28
const PDF_H = 841.89

const TEAL = '#0f6e62'
const GOLD = '#b0842a'
const INK = '#1e293b'
const MUTED = '#64748b'
const LINE = '#e2e8f0'
const PILL = '#e7f4f1'

const DOCUMENTS = [
  ['Relieving Letter', 'Formal release from employment'],
  ['Company Assets Return', 'Itemised handover acknowledgement'],
  ['Credentials & Access Revocation', 'System access sign-off'],
  ['Post-Employment NDA & Confidentiality Agreement', ''],
  ['Full & Final Settlement Acknowledgement', ''],
  ['Experience Certificate', ''],
]

const ASSETS = [
  'Laptop / Computer',
  'Charger / Power Adapter',
  'Mouse / Keyboard / Peripherals',
  'Company ID / Access Card',
  'SIM Card / Mobile Device',
  'Storage Devices (Pen drive / HDD)',
  'Company Documents / Physical Files',
  'Office Keys / Locker Keys',
  'Other (specify)',
  'Other (specify)',
]

export function emptyAssetRows() {
  return ASSETS.map((item) => ({
    item: item === 'Other (specify)' ? '' : item,
    other: item === 'Other (specify)',
    serial: '',
    condition: '',
    status: '',
  }))
}

const CLEARANCE = [
  ['Company Assets (Laptop, Equipment & Peripherals)', 'Cleared', 'green'],
  ['Login Credentials & System Access', 'Revoked', 'green'],
  ['Client Data & Confidential Files', 'Confirmed Returned', 'green'],
  ['THEC Employee Portal Access', 'Deactivated', 'green'],
  ['Full & Final Settlement', 'To Be Processed Next Month', 'gold'],
]

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function signatureImage(value) {
  const text = String(value || '')
  return /^data:image\/(png|jpeg|jpg|webp);/i.test(text) ? text : ''
}

function signImage(src) {
  const value = signatureImage(src)
  if (!value) return '<div style="height:52px;"></div>'
  return `<div style="height:52px;display:flex;align-items:flex-end;"><img src="${esc(value)}" alt="" style="display:block;height:48px;max-width:230px;object-fit:contain;object-position:left bottom;" /></div>`
}

export function formatLetterDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function issueYear(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return String(date.getFullYear())
}

export function addMonthsInput(value, months) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  date.setMonth(date.getMonth() + months)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function formatTenure(from, to) {
  if (!from || !to) return ''
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return ''
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  if (months < 0) months = 0
  const years = Math.floor(months / 12)
  const rem = months % 12
  const parts = []
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`)
  if (rem) parts.push(`${rem} month${rem === 1 ? '' : 's'}`)
  if (parts.length) return parts.join(' ')
  const days = Math.round((end.getTime() - start.getTime()) / 86400000)
  if (days <= 0) return '0 days'
  return `${days} day${days === 1 ? '' : 's'}`
}

function pill(text) {
  return `<span style="display:inline-block;background:${PILL};color:${TEAL};font-weight:700;font-size:12px;line-height:18px;padding:3px 8px 5px;border-radius:4px;white-space:nowrap;">${esc(text)}</span>`
}

function statusPill(text, tone) {
  const bg = tone === 'gold' ? '#f8efd4' : '#e5f6ea'
  const color = tone === 'gold' ? '#a16207' : '#15803d'
  return `<span style="display:inline-block;background:${bg};color:${color};font-weight:700;font-size:11px;line-height:16px;padding:4px 10px 6px;border-radius:999px;white-space:nowrap;">${esc(text)}</span>`
}

function goldBadge(label) {
  return `<table style="border-collapse:collapse;margin-top:22px;"><tr><td style="background:${GOLD};color:#ffffff;font-size:11px;font-weight:700;line-height:16px;padding:7px 12px 9px;">${esc(label)}</td></tr></table>`
}

function field(text) {
  return `<strong style="color:${TEAL};font-weight:700;">${esc(text)}</strong>`
}

function coverPage(data) {
  const rows = [
    ['Employee name', data.employeeName, 'Designation', data.designation],
    ['Department', data.department, 'Date of joining', data.dateOfJoining],
    ['Last working day', data.lastWorkingDay, 'Resignation date', data.resignationDate],
    ['Issue date', data.issueDate, 'Total tenure', data.totalTenure],
  ]
  const cells = rows.map(([leftLabel, leftValue, rightLabel, rightValue]) => `
    <tr>
      <td style="width:50%;border:1px solid ${LINE};padding:10px 12px;vertical-align:middle;">
        <div style="font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};font-weight:700;margin-bottom:6px;">${esc(leftLabel)}</div>
        ${pill(leftValue)}
      </td>
      <td style="width:50%;border:1px solid ${LINE};padding:10px 12px;vertical-align:middle;">
        <div style="font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};font-weight:700;margin-bottom:6px;">${esc(rightLabel)}</div>
        ${pill(rightValue)}
      </td>
    </tr>
  `).join('')

  const docs = DOCUMENTS.map(([title, note], index) => `
    <div style="display:flex;align-items:baseline;gap:10px;padding:8px 2px;border-bottom:1px dotted #cbd5e1;font-size:13px;color:${INK};">
      <span style="color:${TEAL};font-weight:700;width:16px;">${index + 1}</span>
      <span><strong>${esc(title)}</strong>${note ? ` <span style="color:${MUTED};">— ${esc(note)}</span>` : ''}</span>
    </div>
  `).join('')

  return `
    <section style="${pageStyle()}">
      <div style="text-align:center;padding-top:36px;">
        <img src="${HALO_WORDMARK}" alt="" style="width:210px;height:auto;" />
        <div style="margin-top:28px;color:${GOLD};font-size:11px;letter-spacing:0.22em;font-weight:700;">EXIT FORMALITIES</div>
        <div style="margin-top:10px;font-size:32px;color:#0f172a;font-weight:700;">Final Documentation</div>
        <div style="margin-top:6px;font-size:13px;font-style:italic;color:${MUTED};">The Halo Effect Consulting LLP</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:36px;">${cells}</table>
      <div style="margin-top:28px;border:1px solid ${LINE};padding:16px 18px 8px;">
        <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};font-weight:700;margin-bottom:6px;">Documents in this exit pack</div>
        ${docs}
      </div>
      <div style="margin-top:auto;padding-top:28px;text-align:center;color:${MUTED};font-size:10px;letter-spacing:0.14em;">CONFIDENTIAL — TO BE HANDED DIRECTLY TO THE EMPLOYEE</div>
    </section>
  `
}

function letterHeader() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <img src="${HALO_WORDMARK}" alt="" style="width:132px;height:auto;" />
      <div style="text-align:right;">
        <div style="color:${TEAL};font-weight:700;font-size:13px;">The Halo Effect Consulting LLP</div>
        <div style="color:${GOLD};font-style:italic;font-size:11px;margin-top:2px;">Where Insights Meet Influence</div>
      </div>
    </div>
    <div style="height:2px;background:${TEAL};margin-top:10px;"></div>
  `
}

function letterOpen(data) {
  const clearance = CLEARANCE.map(([item, status, tone]) => `
    <tr>
      <td style="border:1px solid ${LINE};padding:9px 12px;font-size:12px;color:${INK};">${esc(item)}</td>
      <td style="border:1px solid ${LINE};padding:9px 12px;text-align:right;width:210px;">${statusPill(status, tone)}</td>
    </tr>
  `).join('')

  return `
    <section style="${pageStyle()}">
      ${letterHeader()}
      ${goldBadge('EXIT FORMALITIES')}
      <div style="margin-top:12px;font-size:28px;color:${TEAL};font-weight:700;">Relieving Letter</div>
      <div style="margin-top:8px;font-size:12px;color:${MUTED};">Ref: THEC/REL/${esc(data.issueYear)} · Date: ${esc(data.issueDate)}</div>
      <div style="height:2px;background:${TEAL};margin-top:10px;"></div>
      <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:${INK};">To Whomsoever It May Concern,</p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.55;color:${INK};">
        This is to certify that ${field(data.employeeName)} was employed with The Halo Effect Consulting LLP as ${field(data.designation)} in the ${field(data.department)} department from ${field(data.dateOfJoining)} to ${field(data.lastWorkingDay)}, with a total tenure of ${field(data.totalTenure)}.
      </p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.55;color:${INK};">
        ${field(data.employeeName)} tendered their resignation on ${field(data.resignationDate)}, and the same was accepted by the management. They have been duly relieved from their duties effective ${field(data.lastWorkingDay)}, upon completion of the applicable notice period.
      </p>
      <div style="margin-top:20px;color:${TEAL};font-size:12px;font-weight:700;letter-spacing:0.06em;">NO-DUES CLEARANCE</div>
      <p style="margin:6px 0 10px;font-size:12px;line-height:1.5;color:${INK};">All exit formalities have been initiated. The following clearance status reflects the position as of the last working day.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="background:#f8fafc;border:1px solid ${LINE};padding:8px 12px;font-size:10px;letter-spacing:0.06em;color:${MUTED};font-weight:700;">DEPARTMENT / ITEM</td>
          <td style="background:#f8fafc;border:1px solid ${LINE};padding:8px 12px;font-size:10px;letter-spacing:0.06em;color:${MUTED};font-weight:700;text-align:right;width:210px;">STATUS</td>
        </tr>
        ${clearance}
      </table>
    </section>
  `
}

function letterClose(data) {
  return `
    <section style="${pageStyle()}">
      <div style="color:${TEAL};font-size:12px;font-weight:700;letter-spacing:0.06em;">CONFIDENTIALITY &amp; POST-EMPLOYMENT OBLIGATIONS</div>
      <p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:${INK};">
        ${field(data.employeeName)} is reminded that the Non-Disclosure and Confidentiality obligations undertaken at the time of joining — and detailed separately in the Post-Employment NDA (Document 4 of this pack) — continue to be in full force and effect after separation. All client information, business strategies, proprietary methodologies, project details, and internal data of The Halo Effect Consulting LLP remain strictly confidential and must not be disclosed, referenced, or used in any capacity, post-employment, without prior written consent.
      </p>
      <div style="margin-top:18px;color:${TEAL};font-size:12px;font-weight:700;letter-spacing:0.06em;">GOODWILL &amp; ACKNOWLEDGEMENT</div>
      <p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:${INK};">
        We thank ${field(data.employeeName)} for their contributions to The Halo Effect Consulting LLP during their tenure. We acknowledge their dedication and professionalism and wish them the very best in all future professional endeavours.
      </p>
      <div style="display:flex;margin-top:36px;">
        <div style="width:50%;padding-right:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">AUTHORISED SIGNATORY — COMPANY</div>
          ${signImage(data.coFounderSign)}
          <div style="margin-top:4px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.signatoryName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};text-transform:uppercase;">${esc(data.signatoryTitle)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};">The Halo Effect Consulting LLP</div>
          <div style="margin-top:16px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
        <div style="width:50%;padding-left:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">EMPLOYEE ACKNOWLEDGEMENT</div>
          ${signImage(data.employeeSign)}
          <div style="margin-top:4px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.employeeName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};text-transform:uppercase;">${esc(data.designation)} · ${esc(data.department)}</div>
          <div style="margin-top:16px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
      </div>
      <div style="margin-top:auto;padding-top:28px;border-top:1px solid ${GOLD};text-align:center;color:${MUTED};font-size:9px;line-height:1.45;">
        The Halo Effect Consulting LLP · 83/11, Rajaji Street, Kumaran Nagar, Padi, Chennai · +91 73977 78891 · hello@thehaloeffectconsulting.com · 600 050<br />
        www.thehaloeffectconsulting.com
      </div>
    </section>
  `
}

function assetTable(rows, start, end) {
  const header = `
    <tr>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;width:36px;">#</td>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;">Item Description</td>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;width:150px;">Serial No. / Details</td>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;width:120px;">Condition</td>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;width:110px;">Status</td>
    </tr>
  `
  const body = rows.slice(start, end).map((row, index) => {
    const number = start + index + 1
    const bg = number % 2 === 0 ? '#f8fafc' : '#ffffff'
    const cell = (value) => `<td style="background:${bg};border-bottom:1px solid ${LINE};padding:10px;font-size:12px;color:${INK};">${esc(value)}</td>`
    return `
      <tr>
        <td style="background:${bg};border-bottom:1px solid ${LINE};padding:10px;text-align:center;font-size:12px;color:${MUTED};">${number}</td>
        ${cell(row.item)}
        ${cell(row.serial)}
        ${cell(row.condition)}
        ${cell(row.status)}
      </tr>
    `
  }).join('')
  return `<table style="width:100%;border-collapse:collapse;margin-top:8px;">${header}${body}</table>`
}

function assetsOpen(data) {
  return `
    <section style="${pageStyle()}">
      ${letterHeader()}
      ${goldBadge('EXIT FORMALITIES · DOCUMENT 2 OF 6')}
      <div style="margin-top:12px;font-size:26px;color:${TEAL};font-weight:700;">Company Assets Return Acknowledgement</div>
      <div style="margin-top:8px;font-size:12px;color:${MUTED};">Ref: THEC/ASSETS/${esc(data.issueYear)} · Date: ${esc(data.issueDate)}</div>
      <div style="height:2px;background:${TEAL};margin-top:10px;"></div>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${INK};">
        This document serves as an official record of all company-owned assets returned by ${pill(data.employeeName)} ( ${pill(data.designation)} , ${pill(data.department)} ) upon separation from The Halo Effect Consulting LLP, effective ${pill(data.lastWorkingDay)}.
      </p>
      <div style="margin-top:18px;color:${TEAL};font-size:12px;font-weight:700;letter-spacing:0.06em;">ITEMISED ASSETS RETURN</div>
      <p style="margin:6px 0 0;font-size:11px;line-height:1.45;color:${MUTED};">List all items returned. Write "NIL" in Serial / Details column if item was not issued. Leave rows blank if additional items need to be added.</p>
      ${assetTable(data.assets, 0, 6)}
    </section>
  `
}

function assetsClose(data) {
  return `
    <section style="${pageStyle()}">
      ${assetTable(data.assets, 6, 10)}
      <div style="margin-top:16px;background:#fff6e8;border-left:4px solid #e8a23a;padding:10px 12px;font-size:12px;line-height:1.5;color:#9a5b10;">
        <strong>Note:</strong> Any unreturned or damaged asset will be assessed and the cost of recovery or repair may be deducted from the Full &amp; Final Settlement at the sole discretion of the management.
      </div>
      <div style="margin-top:14px;border:1px solid ${LINE};border-radius:6px;padding:12px 14px;font-size:13px;line-height:1.55;color:${INK};">
        I, ${field(data.employeeName)}, hereby confirm that all company-issued assets listed above have been returned in the described condition. I acknowledge that no company property remains in my possession as of ${field(data.lastWorkingDay)}.
      </div>
      <div style="display:flex;margin-top:36px;">
        <div style="width:50%;padding-right:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">RECEIVED BY — COMPANY</div>
          ${signImage(data.coFounderSign)}
          <div style="margin-top:4px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.signatoryName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};">${esc(data.signatoryTitle)}, The Halo Effect Consulting LLP</div>
          <div style="margin-top:16px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
        <div style="width:50%;padding-left:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">RETURNED BY — EMPLOYEE</div>
          ${signImage(data.employeeSign)}
          <div style="margin-top:4px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.employeeName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};text-transform:uppercase;">${esc(data.designation)}</div>
          <div style="margin-top:16px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
      </div>
      <div style="margin-top:auto;padding-top:14px;border-top:1px solid ${GOLD};display:flex;justify-content:space-between;color:${MUTED};font-size:9px;line-height:1.4;">
        <span>The Halo Effect Consulting LLP · 83/11, Rajaji Street, Kumaran Nagar, Padi, Chennai – 600 050</span>
        <span>+91 73977 78891 · hello@thehaloeffectconsulting.com</span>
      </div>
    </section>
  `
}

const CREDENTIALS = [
  ['Company Email (Google Workspace)', 'Email / Drive'],
  ['Meta Business Suite / Ads Manager', 'Admin / Editor'],
  ['Social Media Accounts (Instagram / FB)', 'Admin / Manager'],
  ['CRM / Project Management Tool', 'User / Admin'],
  ['THEC Employee Portal', 'Employee Login'],
  ['Client Portals / Ad Accounts', 'Access'],
  ['Canva / Design Tools', 'Team Member'],
  ['Analytics / SEO Tools', 'User'],
  ['WhatsApp Business / Communication', 'Admin'],
  ['Other (specify)', ''],
  ['Other (specify)', ''],
]

export function emptyCredentialRows() {
  return CREDENTIALS.map(([platform, access]) => {
    const other = platform === 'Other (specify)'
    return {
      platform: other ? '' : platform,
      access: other ? '' : access,
      other,
      action: '',
      confirmedBy: '',
    }
  })
}

function credentialTable(rows, start, end) {
  const header = `
    <tr>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;width:36px;">#</td>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;">Platform / System</td>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;width:130px;">Access Type</td>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;width:130px;">Action Taken</td>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;width:130px;">Confirmed By</td>
    </tr>
  `
  const body = rows.slice(start, end).map((row, index) => {
    const number = start + index + 1
    const bg = number % 2 === 0 ? '#f8fafc' : '#ffffff'
    const cell = (value) => `<td style="background:${bg};border-bottom:1px solid ${LINE};padding:10px;font-size:12px;color:${INK};">${esc(value)}</td>`
    return `
      <tr>
        <td style="background:${bg};border-bottom:1px solid ${LINE};padding:10px;text-align:center;font-size:12px;color:${MUTED};">${number}</td>
        ${cell(row.platform)}
        ${cell(row.access)}
        ${cell(row.action)}
        ${cell(row.confirmedBy)}
      </tr>
    `
  }).join('')
  return `<table style="width:100%;border-collapse:collapse;margin-top:8px;">${header}${body}</table>`
}

function credentialsOpen(data) {
  return `
    <section style="${pageStyle()}">
      ${letterHeader()}
      ${goldBadge('EXIT FORMALITIES · DOCUMENT 3 OF 6')}
      <div style="margin-top:12px;font-size:26px;color:${TEAL};font-weight:700;">Login Credentials &amp; System Access Revocation</div>
      <div style="margin-top:8px;font-size:12px;color:${MUTED};">Ref: THEC/CRED/${esc(data.issueYear)} · Date: ${esc(data.issueDate)}</div>
      <div style="height:2px;background:${TEAL};margin-top:10px;"></div>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${INK};">
        This document confirms that all login credentials, system access, and digital tool access issued to ${pill(data.employeeName)} ( ${pill(data.designation)} , ${pill(data.department)} ) have been revoked and/or handed over upon separation, effective ${pill(data.lastWorkingDay)}.
      </p>
      <div style="margin-top:18px;color:${TEAL};font-size:12px;font-weight:700;letter-spacing:0.06em;">ACCESS REVOCATION LOG</div>
      <p style="margin:6px 0 0;font-size:11px;line-height:1.45;color:${MUTED};">Mark each item as Revoked / Transferred / N/A. Add any additional tools in the blank rows.</p>
      ${credentialTable(data.credentials, 0, 7)}
    </section>
  `
}

function credentialsClose(data) {
  return `
    <section style="${pageStyle()}">
      ${credentialTable(data.credentials, 7, 11)}
      <div style="margin-top:16px;background:#fff6e8;border-left:4px solid #e8a23a;padding:10px 12px;font-size:12px;line-height:1.5;color:#9a5b10;">
        <strong>Important:</strong> Any unauthorised access, use, or sharing of company systems, accounts, or client data after ${field(data.lastWorkingDay)} will be treated as a breach of confidentiality and may result in legal action.
      </div>
      <div style="margin-top:14px;border:1px solid ${LINE};border-radius:6px;padding:12px 14px;font-size:13px;line-height:1.55;color:${INK};">
        I, ${field(data.employeeName)}, confirm that I have logged out of and/or handed over all company systems, platforms, and accounts listed above. I have not retained any passwords, access tokens, or backdoor access to any company or client system. I understand that any attempt to access these systems after ${field(data.lastWorkingDay)} will constitute unauthorised access and is liable for legal action under applicable law.
      </div>
      <div style="display:flex;margin-top:36px;">
        <div style="width:50%;padding-right:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">VERIFIED BY — COMPANY</div>
          ${signImage(data.coFounderSign)}
          <div style="margin-top:4px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.signatoryName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};">${esc(data.signatoryTitle)}, The Halo Effect Consulting LLP</div>
          <div style="margin-top:16px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
        <div style="width:50%;padding-left:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">CONFIRMED BY — EMPLOYEE</div>
          ${signImage(data.employeeSign)}
          <div style="margin-top:4px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.employeeName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};text-transform:uppercase;">${esc(data.designation)}</div>
          <div style="margin-top:16px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
      </div>
      <div style="margin-top:auto;padding-top:14px;border-top:1px solid ${GOLD};display:flex;justify-content:space-between;color:${MUTED};font-size:9px;line-height:1.4;">
        <span>The Halo Effect Consulting LLP · 83/11, Rajaji Street, Kumaran Nagar, Padi, Chennai – 600 050</span>
        <span>+91 73977 78891 · hello@thehaloeffectconsulting.com</span>
      </div>
    </section>
  `
}

function ndaItem(html) {
  return `<div style="padding:6px 0 7px;border-bottom:1px dotted #cbd5e1;font-size:12px;line-height:1.45;color:${INK};">• ${html}</div>`
}

function ndaHeading(text) {
  return `<div style="margin-top:16px;color:${TEAL};font-size:12px;font-weight:700;letter-spacing:0.04em;">${esc(text)}</div>`
}

function ndaLead(label, rest) {
  return ndaItem(`<strong style="color:${TEAL};">${esc(label)}</strong> ${rest}`)
}

function ndaFooter(page) {
  return `<div style="margin-top:auto;padding-top:12px;border-top:1px solid ${GOLD};display:flex;justify-content:space-between;color:${MUTED};font-size:9px;">
    <span>The Halo Effect Consulting LLP · 83/11, Rajaji Street, Kumaran Nagar, Padi, Chennai – 600 050</span>
    <span>Page ${page} of 2</span>
  </div>`
}

function ndaOpen(data) {
  return `
    <section style="${pageStyle()}">
      ${letterHeader()}
      ${goldBadge('EXIT FORMALITIES · DOCUMENT 4 OF 6')}
      <div style="margin-top:12px;font-size:26px;color:${TEAL};font-weight:700;">Post-Employment NDA &amp; Confidentiality Agreement</div>
      <div style="margin-top:8px;font-size:12px;color:${MUTED};">Ref: THEC/NDA/${esc(data.issueYear)} · Date: ${esc(data.issueDate)}</div>
      <div style="height:2px;background:${TEAL};margin-top:10px;"></div>
      <p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:${INK};">
        This agreement is entered into by ${pill(data.employeeName)} ( ${pill(data.designation)} , ${pill(data.department)} ) and <strong>The Halo Effect Consulting LLP</strong>, effective upon separation on ${pill(data.lastWorkingDay)}. The obligations set out herein continue in perpetuity unless otherwise stated.
      </p>
      ${ndaHeading('1. DEFINITION OF CONFIDENTIAL INFORMATION')}
      <p style="margin:6px 0 4px;font-size:12px;line-height:1.5;color:${INK};">Confidential Information includes all information relating to The Halo Effect Consulting LLP and its clients that is not in the public domain, whether disclosed verbally, in writing, digitally, or through observation, including but not limited to:</p>
      ${ndaItem(esc('Client identities, names, contact details, business models, budgets, challenges, and goals'))}
      ${ndaItem(esc('Project briefs, campaign strategies, ad creatives, content plans, and marketing frameworks developed during employment'))}
      ${ndaItem(esc('Campaign performance data, analytics reports, ad spend figures, conversion metrics, and ROI data belonging to any client'))}
      ${ndaItem(esc('Internal business processes, pricing structures, service delivery models, and operational workflows of THEC'))}
      ${ndaItem(esc('Proprietary tools, templates, frameworks, SOPs, and methodologies developed by or for THEC'))}
      ${ndaItem(esc('Vendor relationships, partner agreements, and third-party contracts'))}
      ${ndaItem(esc('Business strategies, growth plans, product roadmaps, and financial information of THEC'))}
      ${ndaItem(esc('Any communication (email, WhatsApp, Slack, or otherwise) between THEC, its team, and its clients'))}
      ${ndaHeading('2. NON-DISCLOSURE OBLIGATIONS')}
      ${ndaLead('No Disclosure of Client Names:', esc('The employee shall not disclose, reference, or mention — directly or indirectly — the name of any client served during their tenure at THEC, in any personal portfolio, résumé, LinkedIn profile, social media post, interview, freelance pitch, or any other medium, without prior written permission from THEC.'))}
      ${ndaLead('No Disclosure of Work Details:', esc('The employee shall not disclose any details of work performed for clients, including campaign results, strategies executed, creative outputs, or tools used, whether or not such information appears to be non-sensitive.'))}
      ${ndaLead('No Disclosure of Project Details:', esc("The employee shall not share any details of THEC's internal or client projects, timelines, deliverables, challenges, or outcomes with any third party, competitor, or prospective employer."))}
      ${ndaLead('No Use of Brand Assets:', esc("The employee shall not use, reproduce, or represent THEC's logo, brand name, taglines, creative assets, or marketing materials for any personal or professional purpose without express written consent."))}
      ${ndaLead('No Reference to Internal Data:', esc("The employee shall not use THEC's internal data, reports, or metrics — including those of clients — to support or validate any future work, pitch, or publication."))}
      ${ndaFooter(1)}
    </section>
  `
}

function ndaClose(data) {
  const months = `<strong style="color:${TEAL};">24 months</strong>`
  return `
    <section style="${pageStyle()}">
      ${letterHeader()}
      ${ndaHeading('3. NON-SOLICITATION')}
      ${ndaLead('No Solicitation of Clients:', `For a period of ${months} from the Last Working Day, the employee shall not directly or indirectly solicit, approach, or engage any client of THEC for personal business, freelance work, or on behalf of any competitor or employer.`)}
      ${ndaLead('No Solicitation of Employees:', `For a period of ${months} from the Last Working Day, the employee shall not recruit, encourage, or induce any THEC employee or contractor to leave the organisation.`)}
      ${ndaLead('No Poaching via Third Parties:', esc('The employee shall not use a third party, intermediary, or proxy to carry out any solicitation that they themselves are prohibited from performing under this agreement.'))}
      ${ndaHeading('4. INTELLECTUAL PROPERTY')}
      ${ndaItem(esc('All work product, creative output, strategies, frameworks, and deliverables produced during the course of employment remain the sole intellectual property of The Halo Effect Consulting LLP.'))}
      ${ndaItem(esc('The employee has no ownership claim over any content, campaign, design, strategy, or material created during their tenure, whether produced independently or collaboratively.'))}
      ${ndaItem(esc('The employee shall not reproduce, adapt, or repurpose any such material for personal, freelance, or employment purposes.'))}
      ${ndaHeading('5. DIGITAL & SOCIAL MEDIA CONDUCT')}
      ${ndaItem(esc('The employee shall not post, publish, or discuss — on LinkedIn, Instagram, Twitter/X, any blog, podcast, or other public platform — any information, results, case studies, or insights derived from their work at THEC or its clients.'))}
      ${ndaItem(esc("The employee shall not portray client wins, campaign results, or THEC's methodologies as personal achievements in any professional profile or communication without written consent from THEC."))}
      ${ndaHeading('6. CONSEQUENCES OF BREACH')}
      ${ndaItem(esc("Any breach of this agreement will be treated as a serious violation and may result in legal action, claim for damages, and/or injunctive relief at THEC's sole discretion."))}
      ${ndaItem(esc('THEC reserves the right to withhold or recover any settlement amounts payable in case of a proven breach.'))}
      ${ndaItem(esc('This agreement is binding regardless of the mode of separation — resignation, termination, or mutual separation.'))}
      <div style="margin-top:12px;background:#fff6e8;border-left:4px solid #e8a23a;padding:10px 12px;font-size:12px;line-height:1.5;color:#9a5b10;">
        <strong>Duration:</strong> Clauses 1 &amp; 2 (Non-Disclosure) — Perpetual. · Clause 3 (Non-Solicitation) — 24 months from Last Working Day. · Clause 4 (IP) — Perpetual. · Clause 5 (Social Media) — Perpetual.
      </div>
      <div style="margin-top:12px;border:1px solid ${LINE};border-radius:6px;padding:12px 14px;font-size:12px;line-height:1.5;color:${INK};">
        I, ${field(data.employeeName)}, have read and fully understood the above Post-Employment NDA and Confidentiality Agreement. I agree to abide by all obligations set out herein and acknowledge that any violation may result in legal consequences. I confirm that I have not, prior to signing this document, disclosed any confidential information in violation of the above clauses.
      </div>
      <div style="display:flex;margin-top:22px;">
        <div style="width:50%;padding-right:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">AUTHORISED SIGNATORY — THEC</div>
          ${signImage(data.coFounderSign)}
          <div style="margin-top:4px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.signatoryName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};">${esc(data.signatoryTitle)}, The Halo Effect Consulting LLP</div>
          <div style="margin-top:12px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
        <div style="width:50%;padding-left:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">AGREED &amp; SIGNED — EMPLOYEE</div>
          ${signImage(data.employeeSign)}
          <div style="margin-top:4px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.employeeName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};text-transform:uppercase;">${esc(data.designation)}</div>
          <div style="margin-top:12px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
      </div>
      ${ndaFooter(2)}
    </section>
  `
}

const SETTLEMENT_ROWS = [
  ['Salary for Last Month / Notice Period', 'Salary due for days worked in the final month or notice period, as applicable', 'Pending'],
  ['Leave Encashment', 'Encashment of any earned / accumulated leave balance, as per policy', 'Pending'],
  ['Reimbursements & Expenses', 'Any approved and pending expense reimbursements submitted prior to exit', 'Pending'],
  ['Bonus / Incentive (if applicable)', 'Any pro-rated bonus or performance incentive due as per employment terms', 'Pending'],
  ['Deductions (if any)', 'Recovery of advances, asset damages, or dues as applicable', 'To Be Assessed'],
  ['Gratuity (if applicable)', 'As per applicable law and tenure eligibility', 'To Be Assessed'],
]

export const SETTLEMENT_STATUSES = ['Pending', 'To Be Assessed']

export function emptySettlementRows() {
  return SETTLEMENT_ROWS.map(([component, description, status]) => ({
    component,
    description,
    status,
  }))
}

function settlementTable(rows) {
  const header = `
    <tr>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;">Component</td>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;">Description</td>
      <td style="background:${TEAL};color:#fff;font-size:11px;font-weight:700;padding:8px 10px;width:130px;text-align:right;">Status</td>
    </tr>
  `
  const body = rows.map((row, index) => {
    const bg = index % 2 === 1 ? '#f8fafc' : '#ffffff'
    const status = SETTLEMENT_STATUSES.includes(row.status) ? row.status : 'Pending'
    return `
      <tr>
        <td style="background:${bg};border-bottom:1px solid ${LINE};padding:10px;font-size:12px;font-weight:700;color:${INK};">${esc(row.component)}</td>
        <td style="background:${bg};border-bottom:1px solid ${LINE};padding:10px;font-size:12px;color:${INK};">${esc(row.description)}</td>
        <td style="background:${bg};border-bottom:1px solid ${LINE};padding:10px;text-align:right;">${statusPill(status, 'gold')}</td>
      </tr>
    `
  }).join('')
  return `<table style="width:100%;border-collapse:collapse;margin-top:8px;">${header}${body}</table>`
}

function fnfOpen(data) {
  return `
    <section style="${pageStyle()}">
      ${letterHeader()}
      ${goldBadge('EXIT FORMALITIES · DOCUMENT 5 OF 6')}
      <div style="margin-top:12px;font-size:26px;color:${TEAL};font-weight:700;">Full &amp; Final Settlement Acknowledgement</div>
      <div style="margin-top:8px;font-size:12px;color:${MUTED};">Ref: THEC/FNF/${esc(data.issueYear)} · Date: ${esc(data.issueDate)}</div>
      <div style="height:2px;background:${TEAL};margin-top:10px;"></div>
      <p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:${INK};">
        This document outlines the Full &amp; Final (F&amp;F) Settlement process for ${pill(data.employeeName)} ( ${pill(data.designation)} , ${pill(data.department)} ), who separated from The Halo Effect Consulting LLP effective ${pill(data.lastWorkingDay)}.
      </p>
      <div style="margin-top:14px;background:#fff8e1;border-left:4px solid #e8a23a;padding:10px 12px;font-size:12px;line-height:1.5;color:#9a5b10;">
        <strong>Settlement Status: Pending Processing</strong> — The Full &amp; Final Settlement for this employee is currently being computed and will be processed within <strong>1 to 2 months</strong> from the Last Working Day. The maximum deadline for settlement is ${field(data.settlementDeadline)}. Any delay beyond this date will be communicated in writing.
      </div>
      <div style="margin-top:16px;color:${TEAL};font-size:12px;font-weight:700;letter-spacing:0.04em;">WHAT THE F&amp;F SETTLEMENT COVERS</div>
      ${settlementTable(data.settlement)}
    </section>
  `
}

function fnfClose(data) {
  const point = (html) => `<div style="padding:6px 0 7px;border-bottom:1px dotted #cbd5e1;font-size:12px;line-height:1.45;color:${INK};">• ${html}</div>`
  return `
    <section style="${pageStyle()}">
      <div style="color:${TEAL};font-size:12px;font-weight:700;letter-spacing:0.04em;">SETTLEMENT PROCESS &amp; TIMELINE</div>
      ${point(esc('The F&F computation will be initiated following the completion of all exit formalities, including verified return of assets and credentials.'))}
      ${point(`The final settlement amount will be communicated to ${field(data.employeeName)} in writing, with a detailed breakup, prior to disbursement.`)}
      ${point(esc('Settlement will be transferred to the bank account on record. The employee is responsible for ensuring their bank account details on file are accurate and active.'))}
      ${point(`The maximum disbursement deadline is ${field(data.settlementDeadline)}, subject to completion of all exit formalities and absence of any dues or disputes.`)}
      ${point(esc('In the event of any discrepancy, dispute, or pending dues (including unreturned assets or breach of NDA), THEC reserves the right to adjust or withhold the corresponding amount from the settlement.'))}
      <div style="margin-top:14px;background:#e8f6ee;border-left:4px solid #15803d;padding:10px 12px;font-size:12px;line-height:1.5;color:#166534;">
        <strong>Employee's Right:</strong> ${field(data.employeeName)} is entitled to receive a written settlement statement from THEC prior to disbursement. Any disputes regarding the settlement amount must be raised in writing within <strong>7 days</strong> of receiving the statement.
      </div>
      <div style="margin-top:14px;border:1px solid ${LINE};border-radius:6px;padding:12px 14px;font-size:12px;line-height:1.5;color:${INK};">
        I, ${field(data.employeeName)}, acknowledge that I have been informed of the Full &amp; Final Settlement process and the applicable timeline. I understand that the settlement is subject to completion of all exit formalities, verification of dues, and absence of any outstanding claims against me. I agree to provide any additional information or documents required for the settlement computation upon request and confirm that my bank account details on record are correct.
      </div>
      <div style="display:flex;margin-top:28px;">
        <div style="width:50%;padding-right:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">AUTHORISED SIGNATORY — THEC</div>
          ${signImage(data.coFounderSign)}
          <div style="margin-top:4px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.signatoryName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};">${esc(data.signatoryTitle)}, The Halo Effect Consulting LLP</div>
          <div style="margin-top:12px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
        <div style="width:50%;padding-left:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">ACKNOWLEDGED BY — EMPLOYEE</div>
          ${signImage(data.employeeSign)}
          <div style="margin-top:4px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.employeeName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};text-transform:uppercase;">${esc(data.designation)}</div>
          <div style="margin-top:12px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
      </div>
      <div style="margin-top:auto;padding-top:14px;border-top:1px solid ${GOLD};display:flex;justify-content:space-between;color:${MUTED};font-size:9px;line-height:1.4;">
        <span>The Halo Effect Consulting LLP · 83/11, Rajaji Street, Kumaran Nagar, Padi, Chennai – 600 050</span>
        <span>+91 73977 78891 · hello@thehaloeffectconsulting.com</span>
      </div>
    </section>
  `
}

function pageStyle() {
  return [
    `width:${PAGE_W}px`,
    `height:${PAGE_H}px`,
    'box-sizing:border-box',
    'background:#ffffff',
    'padding:46px 52px 40px',
    'display:flex',
    'flex-direction:column',
    `font-family:Georgia,"Times New Roman",Times,serif`,
    `color:${INK}`,
  ].join(';')
}

async function paintPage(section) {
  const canvas = await html2canvas(section, {
    scale: 2,
    backgroundColor: '#ffffff',
    width: PAGE_W,
    height: PAGE_H,
    windowWidth: PAGE_W,
    useCORS: true,
    logging: false,
  })
  return canvas
}

function cleanRows(rows, fallback, fields) {
  const source = Array.isArray(rows) && rows.length ? rows : fallback()
  return source.map((row) => {
    const next = {}
    fields.forEach((field) => {
      next[field] = String(row?.[field] || '').trim()
    })
    return next
  })
}

function letterData(input) {
  return {
    employeeName: String(input.employeeName || '').trim(),
    designation: String(input.designation || '').trim(),
    department: String(input.department || '').trim(),
    dateOfJoining: formatLetterDate(input.dateOfJoining),
    lastWorkingDay: formatLetterDate(input.lastWorkingDay),
    resignationDate: formatLetterDate(input.resignationDate),
    issueDate: formatLetterDate(input.issueDate),
    issueYear: issueYear(input.issueDate),
    totalTenure: String(input.totalTenure || '').trim(),
    signatoryName: String(input.signatoryName || '').trim(),
    signatoryTitle: String(input.signatoryTitle || '').trim(),
    coFounderSign: signatureImage(input.coFounderSign),
    employeeSign: signatureImage(input.employeeSign),
    settlementDeadline: formatLetterDate(input.settlementDeadline),
    conductSummary: String(input.conductSummary || '').trim(),
    assets: cleanRows(input.assets, emptyAssetRows, ['item', 'serial', 'condition', 'status']),
    credentials: cleanRows(input.credentials, emptyCredentialRows, ['platform', 'access', 'action', 'confirmedBy']),
    settlement: cleanRows(input.settlement, emptySettlementRows, ['component', 'description', 'status']).map((row) => ({
      ...row,
      status: SETTLEMENT_STATUSES.includes(row.status) ? row.status : 'Pending',
    })),
  }
}

async function savePdf(bodyHtml, filename) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;left:0;top:0;width:794px;height:1123px;border:0;z-index:-1;pointer-events:none;background:#ffffff;'
  document.body.appendChild(frame)
  const frameDoc = frame.contentDocument
  frameDoc.open()
  frameDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#ffffff;color:${INK};}</style></head><body>${bodyHtml}</body></html>`)
  frameDoc.close()

  try {
    const images = [...frameDoc.images]
    await Promise.all(images.map((image) => (image.complete ? null : image.decode().catch(() => {}))))
    const sections = [...frameDoc.querySelectorAll('section')]
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    for (let index = 0; index < sections.length; index += 1) {
      const canvas = await paintPage(sections[index])
      if (index > 0) doc.addPage()
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, PDF_W, PDF_H)
    }
    doc.save(filename)
  } finally {
    frame.remove()
  }
}

const EXIT_PAGES = {
  letter: (data) => [coverPage(data), letterOpen(data), letterClose(data)],
  assets: (data) => [assetsOpen(data), assetsClose(data)],
  credentials: (data) => [credentialsOpen(data), credentialsClose(data)],
  nda: (data) => [ndaOpen(data), ndaClose(data)],
  fnf: (data) => [fnfOpen(data), fnfClose(data)],
  experience: (data) => [experienceOpen(data), experienceClose(data)],
}

export function exitDocumentHtml(kind, input) {
  const build = EXIT_PAGES[kind]
  if (!build) throw new Error('Unknown exit document.')
  return build(letterData(input)).join('')
}

export async function downloadRelievingLetter(input) {
  const data = letterData(input)
  await savePdf(exitDocumentHtml('letter', input), `${fileSlug(data.employeeName)}-relieving-letter.pdf`)
}

export async function downloadAssetsReturn(input) {
  const data = letterData(input)
  await savePdf(exitDocumentHtml('assets', input), `${fileSlug(data.employeeName)}-assets-return.pdf`)
}

export async function downloadCredentialsRevocation(input) {
  const data = letterData(input)
  await savePdf(exitDocumentHtml('credentials', input), `${fileSlug(data.employeeName)}-credentials-revocation.pdf`)
}

export async function downloadNda(input) {
  const data = letterData(input)
  await savePdf(exitDocumentHtml('nda', input), `${fileSlug(data.employeeName)}-nda.pdf`)
}

export async function downloadFnfSettlement(input) {
  const data = letterData(input)
  await savePdf(exitDocumentHtml('fnf', input), `${fileSlug(data.employeeName)}-fnf-settlement.pdf`)
}

function experienceTable(data) {
  const rows = [
    ['Employee Name', data.employeeName],
    ['Designation', data.designation],
    ['Department', data.department],
    ['Date of Joining', data.dateOfJoining],
    ['Last Working Day', data.lastWorkingDay],
    ['Total Tenure', data.totalTenure],
  ]
  const body = rows.map(([label, value], index) => {
    const bg = index % 2 === 1 ? '#f8fafc' : '#ffffff'
    return `
      <tr>
        <td style="background:${bg};border-bottom:1px solid ${LINE};padding:9px 12px;width:42%;font-size:12px;color:${INK};">${esc(label)}</td>
        <td style="background:${bg};border-bottom:1px solid ${LINE};padding:9px 12px;">${pill(value)}</td>
      </tr>
    `
  }).join('')
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="background:${TEAL};color:#fff;font-size:12px;font-weight:700;padding:8px 12px;">Detail</td>
        <td style="background:${TEAL};color:#fff;font-size:12px;font-weight:700;padding:8px 12px;">Information</td>
      </tr>
      ${body}
    </table>
  `
}

function experienceOpen(data) {
  return `
    <section style="${pageStyle()}">
      ${letterHeader()}
      ${goldBadge('EXIT FORMALITIES · DOCUMENT 6 OF 6')}
      <table style="border-collapse:collapse;margin:22px auto 0;"><tr><td style="background:${GOLD};color:#ffffff;font-size:11px;font-weight:700;line-height:16px;padding:7px 12px 9px;">TO WHOMSOEVER IT MAY CONCERN</td></tr></table>
      <div style="margin-top:14px;text-align:center;font-size:28px;color:#0f172a;font-weight:700;">Experience Certificate</div>
      <div style="margin-top:8px;text-align:center;font-size:12px;color:${MUTED};">Ref: THEC/EXP/${esc(data.issueYear)} · Date: ${esc(data.issueDate)}</div>
      <div style="height:2px;background:${TEAL};margin-top:12px;"></div>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${INK};">
        This is to certify that ${field(data.employeeName)} was employed with <strong>The Halo Effect Consulting LLP</strong>, Chennai, in the capacity of ${field(data.designation)} within the ${field(data.department)} department.
      </p>
      ${experienceTable(data)}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${INK};">
        During their tenure, ${field(data.employeeName)} demonstrated ${field(data.conductSummary)}. They actively contributed to the growth and execution objectives of their department and maintained a high standard of professionalism, accountability, and integrity in all their interactions with the team and clients at all times.
      </p>
    </section>
  `
}

function experienceClose(data) {
  return `
    <section style="${pageStyle()}">
      <p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:${INK};">
        Throughout their employment, ${field(data.employeeName)} was responsible for carrying out the duties and responsibilities associated with the role of ${field(data.designation)} in the ${field(data.department)} department. Their contributions were in alignment with the organisational goals of The Halo Effect Consulting LLP, and their work ethic and conduct were found to be satisfactory throughout their tenure.
      </p>
      <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:${INK};">
        We confirm that ${field(data.employeeName)} has been duly and formally relieved from the services of The Halo Effect Consulting LLP effective ${field(data.lastWorkingDay)}. As of the date of this certificate, there are no pending dues or liabilities outstanding against them, subject to the completion of Full &amp; Final Settlement formalities.
      </p>
      <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:${INK};">
        This certificate is issued in good faith and solely for the purpose of facilitating the employee's future employment or professional pursuits. The Halo Effect Consulting LLP wishes ${field(data.employeeName)} all the very best in their future endeavours.
      </p>
      <div style="display:flex;margin-top:36px;">
        <div style="width:50%;padding-right:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">AUTHORISED SIGNATORY — THEC</div>
          ${signImage(data.coFounderSign)}
          <div style="margin-top:4px;border-top:1px solid ${INK};padding-top:8px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.signatoryName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};">${esc(data.signatoryTitle)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};">The Halo Effect Consulting LLP</div>
          <div style="margin-top:14px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
        <div style="width:50%;padding-left:24px;">
          <div style="font-size:10px;letter-spacing:0.08em;color:${INK};font-weight:700;">RECEIVED &amp; ACKNOWLEDGED — EMPLOYEE</div>
          ${signImage(data.employeeSign)}
          <div style="margin-top:4px;border-top:1px solid ${INK};padding-top:8px;color:${TEAL};font-weight:700;font-size:13px;">${esc(data.employeeName)}</div>
          <div style="margin-top:2px;font-size:11px;color:${MUTED};text-transform:uppercase;">${esc(data.designation)}</div>
          <div style="margin-top:14px;font-size:12px;color:${INK};">Date: ${esc(data.issueDate)}</div>
        </div>
      </div>
      <div style="margin-top:auto;padding-top:14px;border-top:1px solid ${GOLD};text-align:center;color:${MUTED};font-size:9px;line-height:1.45;">
        The Halo Effect Consulting LLP · 83/11, Rajaji Street, Kumaran Nagar, Padi, Chennai · +91 73977 78891 · hello@thehaloeffectconsulting.com · 600 050<br />
        www.thehaloeffectconsulting.com
      </div>
    </section>
  `
}

export async function downloadExperienceCertificate(input) {
  const data = letterData(input)
  await savePdf(exitDocumentHtml('experience', input), `${fileSlug(data.employeeName)}-experience-certificate.pdf`)
}
