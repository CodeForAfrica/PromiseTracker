import type { ImportRow, SourceContent, StructuredImporter } from '@promisetracker/kernel'
import { parse } from 'csv-parse/sync'
import { readSheet } from 'read-excel-file/node'

/** The largest spreadsheet an import reads, and the most rows. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_ROWS = 10_000
const SAMPLE_ROWS = 5

const healthy = async () => ({ healthy: true })

/** A cell as text: dates as YYYY-MM-DD, everything else as written. */
const asText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

function checkSize(content: SourceContent): void {
  if (content.data.byteLength > MAX_IMPORT_BYTES) {
    throw new Error(`The file is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`)
  }
}

/** Splits a sheet into headings and numbered rows, leaving out empty rows. */
function toTable(cells: readonly (readonly unknown[])[]): {
  headings: string[]
  rows: ImportRow[]
} {
  const [first = [], ...rest] = cells
  const headings = first.map(asText)
  const rows: ImportRow[] = []
  rest.forEach((cells, index) => {
    const values = headings.map((_, column) => asText(cells[column]))
    if (values.some(Boolean)) rows.push({ row: index + 1, values })
  })
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`The file has more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files.`)
  }
  return { headings, rows }
}

/**
 * Reads a CSV file into headings and numbered rows, as an import does. For
 * code that reads a spreadsheet outside an import, such as the seed data.
 */
export function readCsv(content: SourceContent) {
  checkSize(content)
  // Empty lines are kept here and skipped in toTable, so row numbers match the file.
  const cells: string[][] = parse(Buffer.from(content.data), {
    bom: true,
    relax_column_count: true,
  })
  return toTable(cells)
}

async function readXlsx(content: SourceContent) {
  checkSize(content)
  // The first sheet. A workbook with several should be split, one sheet a file.
  const cells: unknown[][] = await readSheet(Buffer.from(content.data))
  return toTable(cells)
}

const importer = (
  id: string,
  accepts: readonly string[],
  read: (
    content: SourceContent,
  ) =>
    | { headings: string[]; rows: ImportRow[] }
    | Promise<{ headings: string[]; rows: ImportRow[] }>,
): StructuredImporter => ({
  id,
  accepts,
  health: healthy,
  inspect: async (content) => {
    const { headings, rows } = await read(content)
    return { headings, sampleRows: rows.slice(0, SAMPLE_ROWS).map((r) => [...r.values]) }
  },
  rows: async function* (content) {
    const { rows } = await read(content)
    yield* rows
  },
})

/** Reads CSV, with or without a byte-order mark (section 9.6). */
export const csvImporter = importer('csv', ['text/csv', 'application/csv'], readCsv)

/** Reads the first sheet of an Excel workbook (section 9.6). */
export const xlsxImporter = importer(
  'xlsx',
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  readXlsx,
)
