# PF Corp logo in ProcureFlow Advanced Reports

This update uses the exact PF Corp Enterprise System logo supplied in chat. The logo artwork is unchanged; only wide whitespace is cropped for legibility in the PDF header.

## Install

Extract the ZIP into your Procurement-System project root, keeping the `src/` subfolders intact. Confirm that these two files exist:

- `src/services/reportExports.ts`
- `src/assets/pf-corp-report-logo.jpg`

Build and publish your frontend:

```powershell
npm run build
git add src/services/reportExports.ts src/assets/pf-corp-report-logo.jpg
git commit -m "Add PF Corp logo to Advanced Reports PDFs"
git push origin main
```

No database changes and no Worker deploy are necessary. CSV remains a clean spreadsheet-compatible plain-text format (images cannot be embedded in CSV). Other reports and approval roles are unchanged.
