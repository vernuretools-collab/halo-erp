import { getPaymentDetails, DEFAULT_PAYMENT_DETAILS } from '../../../shared/services/paymentDetailsService'

/**
 * Pure JavaScript PDF Generator Utility for Invoices
 * Generates and triggers a direct .pdf file download in the browser with high-contrast text and crisp colors
 */
export const downloadInvoiceAsPDF = async (invoice) => {
  if (!invoice) return
  const bank = await getPaymentDetails().catch(() => DEFAULT_PAYMENT_DETAILS)

  const invNum = invoice.invoiceNumber || 'INV-2024'
  const client = invoice.clientName || 'Client'
  const project = invoice.projectName || 'General Service'
  const issueDate = invoice.issueDate || new Date().toISOString().split('T')[0]
  const dueDate = invoice.dueDate || 'N/A'
  const totalAmount = (invoice.total || 0).toLocaleString('en-IN')
  const subtotal = (invoice.subtotal || invoice.total || 0).toLocaleString('en-IN')
  const taxTotal = (invoice.taxTotal || Math.round((invoice.total || 0) * 0.1)).toLocaleString('en-IN')

  // Line items
  const items = invoice.lineItems && invoice.lineItems.length > 0
    ? invoice.lineItems
    : [{ description: 'Professional Services & Consulting', quantity: 1, unitPrice: invoice.total || 0 }]

  const pdfStreamCommands = []

  // --- HEADER BRANDING ---
  pdfStreamCommands.push('0 0 0 rg') // Pure black fill for title
  pdfStreamCommands.push('BT /F1 18 Tf 40 750 Td (NEXT-GEN CRM SYSTEMS) Tj ET')
  pdfStreamCommands.push('0.35 0.35 0.35 rg')
  pdfStreamCommands.push('BT /F2 9 Tf 40 735 Td (Enterprise Solutions & Digital Services) Tj ET')
  pdfStreamCommands.push('0.45 0.45 0.45 rg')
  pdfStreamCommands.push('BT /F2 8 Tf 40 722 Td (HQ Headquarters Inc. | Tax ID: US-987654321 | support@nextgencrm.io) Tj ET')

  // --- INVOICE TITLE & DATES ---
  pdfStreamCommands.push('0 0 0 rg') // Pure black fill
  pdfStreamCommands.push('BT /F1 18 Tf 420 750 Td (INVOICE) Tj ET')
  pdfStreamCommands.push('BT /F1 11 Tf 420 732 Td (' + escapePdfString(invNum) + ') Tj ET')
  pdfStreamCommands.push('0.3 0.3 0.3 rg')
  pdfStreamCommands.push('BT /F2 9 Tf 420 715 Td (Issue Date: ' + escapePdfString(issueDate) + ') Tj ET')
  pdfStreamCommands.push('BT /F2 9 Tf 420 702 Td (Due Date: ' + escapePdfString(dueDate) + ') Tj ET')
  pdfStreamCommands.push('BT /F1 9 Tf 420 689 Td (Status: ' + (invoice.status || 'sent').toUpperCase() + ') Tj ET')

  // Divider Line 1
  pdfStreamCommands.push('0.85 0.85 0.85 RG 1 w 40 675 m 570 675 l S')

  // --- BILLED TO & PROJECT DETAILS ---
  pdfStreamCommands.push('0.15 0.25 0.55 rg') // Navy blue label
  pdfStreamCommands.push('BT /F1 10 Tf 40 655 Td (BILLED TO:) Tj ET')
  pdfStreamCommands.push('0 0 0 rg') // Pure black text for client name
  pdfStreamCommands.push('BT /F1 11 Tf 40 640 Td (' + escapePdfString(client) + ') Tj ET')
  if (invoice.clientEmail) {
    pdfStreamCommands.push('0.35 0.35 0.35 rg')
    pdfStreamCommands.push('BT /F2 9 Tf 40 626 Td (' + escapePdfString(invoice.clientEmail) + ') Tj ET')
  }

  pdfStreamCommands.push('0.15 0.25 0.55 rg') // Navy blue label
  pdfStreamCommands.push('BT /F1 10 Tf 300 655 Td (ASSOCIATED PROJECT:) Tj ET')
  pdfStreamCommands.push('0 0 0 rg') // Pure black text for project name
  pdfStreamCommands.push('BT /F1 11 Tf 300 640 Td (' + escapePdfString(project) + ') Tj ET')
  pdfStreamCommands.push('0.35 0.35 0.35 rg')
  pdfStreamCommands.push('BT /F2 9 Tf 300 626 Td (Terms: Net 15 Days) Tj ET')

  // Divider Line 2
  pdfStreamCommands.push('0.85 0.85 0.85 RG 1 w 40 610 m 570 610 l S')

  // --- TABLE HEADER ---
  pdfStreamCommands.push('0.92 0.94 0.98 rg 40 585 530 20 re f') // Light grayish-blue background box
  pdfStreamCommands.push('0.1 0.2 0.45 rg') // DARK NAVY text color for headers
  pdfStreamCommands.push('BT /F1 9 Tf 50 592 Td (#) Tj ET')
  pdfStreamCommands.push('BT /F1 9 Tf 80 592 Td (Item Description) Tj ET')
  pdfStreamCommands.push('BT /F1 9 Tf 350 592 Td (Qty) Tj ET')
  pdfStreamCommands.push('BT /F1 9 Tf 410 592 Td (Unit Price (INR)) Tj ET')
  pdfStreamCommands.push('BT /F1 9 Tf 500 592 Td (Amount (INR)) Tj ET')

  // --- TABLE ROWS ---
  let currentY = 565
  items.forEach((item, index) => {
    const desc = escapePdfString(item.description || 'Service Deliverable')
    const qty = item.quantity || 1
    const price = (item.unitPrice || 0).toLocaleString('en-IN')
    const amt = ((item.quantity || 1) * (item.unitPrice || 0)).toLocaleString('en-IN')

    pdfStreamCommands.push('0.4 0.4 0.4 rg') // Grey index
    pdfStreamCommands.push(`BT /F2 9 Tf 50 ${currentY} Td (${index + 1}) Tj ET`)
    pdfStreamCommands.push('0 0 0 rg') // PURE BLACK for item details & amounts
    pdfStreamCommands.push(`BT /F2 9 Tf 80 ${currentY} Td (${desc}) Tj ET`)
    pdfStreamCommands.push(`BT /F2 9 Tf 355 ${currentY} Td (${qty}) Tj ET`)
    pdfStreamCommands.push(`BT /F2 9 Tf 410 ${currentY} Td (INR ${price}) Tj ET`)
    pdfStreamCommands.push(`BT /F1 9 Tf 500 ${currentY} Td (INR ${amt}) Tj ET`)

    pdfStreamCommands.push(`0.88 0.88 0.88 RG 0.5 w 40 ${currentY - 6} m 570 ${currentY - 6} l S`)
    currentY -= 22
  })

  // --- TOTALS BREAKDOWN ---
  const totalsY = Math.max(currentY - 15, 380)
  pdfStreamCommands.push('0.25 0.25 0.25 rg') // Dark charcoal text for subtotal & tax
  pdfStreamCommands.push(`BT /F2 10 Tf 370 ${totalsY} Td (Subtotal:) Tj ET`)
  pdfStreamCommands.push(`BT /F1 10 Tf 490 ${totalsY} Td (INR ${subtotal}) Tj ET`)

  pdfStreamCommands.push(`BT /F2 10 Tf 370 ${totalsY - 18} Td (GST / Tax (10%):) Tj ET`)
  pdfStreamCommands.push(`BT /F1 10 Tf 490 ${totalsY - 18} Td (INR ${taxTotal}) Tj ET`)

  // --- GRAND TOTAL HIGHLIGHT BOX ---
  pdfStreamCommands.push(`0.15 0.25 0.55 rg 360 ${totalsY - 45} 210 24 re f`) // Dark navy background
  pdfStreamCommands.push('1 1 1 rg') // PURE WHITE text inside dark box!
  pdfStreamCommands.push(`BT /F1 10 Tf 370 ${totalsY - 37} Td (TOTAL AMOUNT DUE:) Tj ET`)
  pdfStreamCommands.push(`BT /F1 10 Tf 490 ${totalsY - 37} Td (INR ${totalAmount}) Tj ET`)

  // --- BANK TRANSFER BOX ---
  const bankY = totalsY - 85
  pdfStreamCommands.push(`0.95 0.96 0.98 rg 40 ${bankY - 45} 300 55 re f`) // Light background box
  pdfStreamCommands.push(`0.8 0.85 0.9 RG 1 w 40 ${bankY - 45} 300 55 re S`) // Box border
  pdfStreamCommands.push('0.1 0.2 0.45 rg') // Dark navy title
  pdfStreamCommands.push(`BT /F1 9 Tf 50 ${bankY - 2} Td (BANK WIRE TRANSFER INSTRUCTIONS) Tj ET`)
  pdfStreamCommands.push('0.2 0.2 0.2 rg') // Dark charcoal details
  pdfStreamCommands.push(`BT /F2 8 Tf 50 ${bankY - 16} Td (Bank: ${escapePdfString(bank.bankName)} | Account: ${escapePdfString(bank.accountName)}) Tj ET`)
  pdfStreamCommands.push(`BT /F2 8 Tf 50 ${bankY - 28} Td (A/C No: ${escapePdfString(bank.accountNumber)} | IFSC Code: ${escapePdfString(bank.ifsc)}) Tj ET`)
  pdfStreamCommands.push(`BT /F2 8 Tf 50 ${bankY - 40} Td (Reference: Include Invoice #${escapePdfString(invNum)} with wire payment) Tj ET`)

  // --- FOOTER NOTE ---
  pdfStreamCommands.push('0.85 0.85 0.85 RG 1 w 40 60 m 570 60 l S')
  pdfStreamCommands.push('0.45 0.45 0.45 rg')
  pdfStreamCommands.push('BT /F2 8 Tf 170 45 Td (Thank you for your business! Official Computer-Generated Invoice.) Tj ET')

  const streamContent = pdfStreamCommands.join('\n')

  // Standard PDF Structure
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Length ${streamContent.length} >>
stream
${streamContent}
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000315 00000 n 
0000000381 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
${400 + streamContent.length}
%%EOF`

  const blob = new Blob([pdfString], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Invoice_${invNum.replace(/[^a-zA-Z0-9-]/g, '_')}_${client.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const escapePdfString = (str) => {
  if (!str) return ''
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}
