/** RFC 4180 CSV with protection against spreadsheet formula injection. */
export type CsvValue = string | number | boolean | null | undefined | readonly unknown[] | Record<string, unknown>

const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: CsvValue): string {
  let s: string
  let text = false
  if (value === null || value === undefined) s = ''
  else if (typeof value === 'number') s = Number.isFinite(value) ? String(value) : ''
  else if (typeof value === 'boolean') s = value ? 'true' : 'false'
  else if (Array.isArray(value)) {
    // Arrays of scalars are joined with "; ". Arrays of objects are JSON.
    if (value.every((v) => v === null || ['string', 'number', 'boolean'].includes(typeof v))) {
      s = value.map((v) => String(v ?? '')).join('; ')
      text = true
    } else s = JSON.stringify(value)
  } else if (typeof value === 'object') s = JSON.stringify(value)
  else {
    s = String(value)
    text = true
  }
  // Only text can carry a formula; numbers such as -83.2 are written as they are.
  if (text && FORMULA_START.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [header.map((h) => csvCell(h)).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  return `${lines.join('\r\n')}\r\n`
}
