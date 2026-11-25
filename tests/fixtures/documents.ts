import { crc32 } from 'node:zlib'

/**
 * Small PDF and Word files built in code, so the tests carry no binary files
 * and the text in them is plain to read here.
 */

/** Characters outside Latin-1 that Windows-1252, the PDF's encoding, has. */
const WINDOWS_1252: Record<string, number> = { '€': 0x80, '’': 0x92, Œ: 0x8c, œ: 0x9c }

function pdfString(text: string): number[] {
  const bytes: number[] = []
  for (const char of text) {
    const code = WINDOWS_1252[char] ?? char.codePointAt(0) ?? 0x3f
    if (code > 0xff) throw new Error(`Cannot write ${char} in this PDF`)
    // Brackets and backslashes are escaped inside a PDF string.
    if (char === '(' || char === ')' || char === '\\') bytes.push(0x5c)
    bytes.push(code)
  }
  return bytes
}

/** A PDF with one page per item, each holding that text in Helvetica. */
export function pdfWith(pages: readonly string[]): Uint8Array {
  const objects: number[][] = []
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
  const pageIds = pages.map((_, i) => 4 + i * 2)
  objects.push(ascii('<< /Type /Catalog /Pages 2 0 R >>'))
  objects.push(
    ascii(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    ),
  )
  objects.push(
    ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
  )
  pages.forEach((text, i) => {
    const content = [...ascii('BT /F1 12 Tf 50 750 Td ('), ...pdfString(text), ...ascii(') Tj ET')]
    objects.push(
      ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
      ),
    )
    objects.push([
      ...ascii(`<< /Length ${content.length} >>\nstream\n`),
      ...content,
      ...ascii('\nendstream'),
    ])
  })
  const out: number[] = ascii('%PDF-1.4\n')
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out.push(...ascii(`${i + 1} 0 obj\n`), ...body, ...ascii('\nendobj\n'))
  })
  const xref = out.length
  out.push(...ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`))
  for (const offset of offsets) out.push(...ascii(`${String(offset).padStart(10, '0')} 00000 n \n`))
  out.push(
    ...ascii(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`),
  )
  return Uint8Array.from(out)
}

/** A ZIP of the given files, stored without compression. */
function zip(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder()
  const local: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name)
    const data = Buffer.from(encoder.encode(text))
    const crc = crc32(data)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    // Bit 11: the name is UTF-8.
    header.writeUInt16LE(0x0800, 6)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(data.length, 18)
    header.writeUInt32LE(data.length, 22)
    header.writeUInt16LE(nameBytes.length, 26)
    local.push(header, nameBytes, data)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(data.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(nameBytes.length, 28)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, nameBytes)
    offset += header.length + nameBytes.length + data.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...local, directory, end]))
}

const xml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** A Word file, one paragraph per item. */
export function docxWith(paragraphs: readonly string[]): Uint8Array {
  const body = paragraphs.map(
    (p) => `<w:p><w:r><w:t xml:space="preserve">${xml(p)}</w:t></w:r></w:p>`,
  )
  return zip({
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}</w:body></w:document>`,
  })
}
