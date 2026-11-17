function xmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function columnWidth(values) {
  const longest = values.reduce((max, value) => {
    const line = String(value ?? '')
      .split('\n')
      .reduce((width, part) => Math.max(width, part.length), 0)
    return Math.max(max, line)
  }, 12)
  return Math.min(80, longest + 2) * 7
}

export const SCRUM_SHEET_COLUMNS = [
  { key: 'employee', header: 'Employee' },
  { key: 'email', header: 'Email' },
  { key: 'date', header: 'Date' },
  { key: 'morningScrum', header: 'Morning Scrum' },
  { key: 'eodUpdate', header: 'EOD Update' },
]

/** Excel opens this XML workbook with wrapped cells, so notes are not clipped the way a CSV is. */
export function downloadScrumSheet(filename, rows) {
  const list = Array.isArray(rows) ? rows : []
  const columns = SCRUM_SHEET_COLUMNS
  const body = list.map((row) => columns.map((column) => row[column.key] ?? ''))
  const widths = columns.map((column, index) => columnWidth([column.header, ...body.map((row) => row[index])]))
  const header = columns
    .map((column) => `<Cell ss:StyleID="header"><Data ss:Type="String">${xmlText(column.header)}</Data></Cell>`)
    .join('')
  const lines = body
    .map((row) => {
      const cells = row
        .map((value) => `<Cell ss:StyleID="wrap"><Data ss:Type="String">${xmlText(value)}</Data></Cell>`)
        .join('')
      return `<Row ss:AutoFitHeight="1">${cells}</Row>`
    })
    .join('')
  const cols = widths.map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`).join('')
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="header"><Font ss:Bold="1"/><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
<Style ss:ID="wrap"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
</Styles>
<Worksheet ss:Name="Scrum">
<Table>${cols}<Row ss:AutoFitHeight="1">${header}</Row>${lines}</Table>
</Worksheet>
</Workbook>`
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
