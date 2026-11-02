# ProcureFlow Advanced Reports — Export Design Fix

This update is based on the integrated ProcureFlow system supplied in your conversation (Features 12–14).

## Updated files
- `src/pages/AdvancedReportsPage.tsx` — Replaces the former CSV/PDF buttons with consistent export configurations for all three reports.
- `src/services/reportExports.ts` — New reusable, print-ready PDF and Excel-compatible CSV exporter.

## Improvements
- PDF: A4 landscape, ProcureFlow header, summary KPI tiles, structured tables, readable numeric alignment, alternating rows, repeated headings, continuation pages, page numbers and a department spending mini-chart.
- PDF: Currency appears as `PHP` rather than a missing peso glyph (the stock jsPDF Helvetica font cannot display the Philippine peso symbol reliably).
- CSV: UTF-8 BOM, real numeric values (no currency symbols embedded in numeric cells), accurate headers with units, blanks for unavailable numeric readings, consistent line breaks, proper quoting of commas/quotes, and protection against Excel formula injection from untrusted text.
- New filenames use `procureflow-` prefix. Existing calculations, data API, navigation, permissions, approval process and other modules are left unchanged.

CSV is a plain-text data format, so it cannot have colors, fonts, borders, merged cells or column widths. Use the PDF for a designed presentation and the CSV for sortable spreadsheet data.

## Installation: small update ZIP
1. Back up your project folder or commit your current changes.
2. Extract the ZIP into `D:\GitHub\Procurement-System`, merging the `src` folder and replacing `AdvancedReportsPage.tsx`.
3. Run from the project root:

```powershell
npm run build
git add src/pages/AdvancedReportsPage.tsx src/services/reportExports.ts
git commit -m "Improve Advanced Reports PDF and CSV exports"
git push origin main
```

No Cloudflare Worker change and no D1 migration is needed. This is a frontend-only improvement.

## Installation: complete project ZIP
Extract into a new folder, run `npm ci` then `npm run build` and deploy as you normally do. Do not overwrite a project with newer local edits without reviewing the changes.

## QA summary
- TypeScript `tsc --noEmit` completed without errors in the project extracted from your upload.
- PDFs generated using jsPDF 2.5.2, rendered to images and inspected on the first and subsequent pages.
- CSV tested for quoted supplier names, missing numeric values and suspicious formula-like text.
- Linux Vite bundle was unavailable because the uploaded `node_modules` came from Windows and lacks Linux-specific Rollup binaries. Run `npm ci` on Windows first if required.

*Example previews use fabricated data and are not actual system transactions.*
