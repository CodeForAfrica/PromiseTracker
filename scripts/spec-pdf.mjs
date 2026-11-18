// Rebuilds the specification PDFs from their Markdown, with headless Chrome.
//   pnpm spec:pdf
// Set CHROME to Chrome's path if it is not in the usual place for macOS.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const documents = ['promisetracker-v3-product-spec', 'promisetracker-v3-system-specification']

const STYLE = `
  @page { size: A4; margin: 20mm 19mm 18mm; }
  body { font: 10.5pt/1.55 Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 0; }
  h1 { font-size: 26pt; line-height: 1.15; margin: 0 0 4mm; }
  h1 + p { color: #555; }
  h2 { font-size: 17pt; margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 1.5pt solid #1a1a1a;
       page-break-before: always; page-break-after: avoid; }
  h2:first-of-type { page-break-before: avoid; margin-top: 9mm; }
  h3 { font-size: 12.5pt; margin: 6.5mm 0 2mm; page-break-after: avoid; }
  h4 { font-size: 11pt; margin: 5mm 0 1.5mm; page-break-after: avoid; }
  p { margin: 0 0 3mm; orphans: 2; widows: 2; }
  ul, ol { margin: 0 0 3mm; padding-left: 6mm; } li { margin-bottom: 1.1mm; }
  code { font: 8.8pt Menlo, Consolas, monospace; background: #f2f2f0; padding: 0.4mm 1mm; }
  pre { font: 8pt/1.4 Menlo, Consolas, monospace; background: #f7f7f5; border-left: 2pt solid #c9c9c4;
        padding: 2.5mm 3mm; margin: 0 0 3.5mm; white-space: pre-wrap; overflow-wrap: anywhere;
        page-break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: inherit; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; line-height: 1.4; margin: 0 0 4mm; }
  th, td { border: 0.5pt solid #b8b8b2; padding: 1.5mm 2mm; text-align: left; vertical-align: top; }
  th { background: #efefec; } tr { page-break-inside: avoid; }
`

const page = (title, markdown) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${title}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
<style>${STYLE}</style></head><body><div id="doc"></div>
<script id="src" type="application/json">${JSON.stringify(markdown).replaceAll('</', '<\\/')}</script>
<script>document.getElementById('doc').innerHTML =
  marked.parse(JSON.parse(document.getElementById('src').textContent));</script></body></html>`

const work = mkdtempSync(path.join(tmpdir(), 'spec-pdf-'))
try {
  for (const name of documents) {
    const markdown = readFileSync(path.join(root, 'docs/spec', `${name}.md`), 'utf8')
    const title = markdown.match(/^# (.+)$/m)?.[1] ?? name
    const html = path.join(work, `${name}.html`)
    writeFileSync(html, page(title, markdown))
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer',
        '--virtual-time-budget=15000',
        `--print-to-pdf=${path.join(root, 'docs/spec', `${name}.pdf`)}`,
        pathToFileURL(html).href,
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    )
    console.log(`Built docs/spec/${name}.pdf`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
