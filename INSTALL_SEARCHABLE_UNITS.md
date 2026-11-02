# ProcureFlow — Searchable Unit of Measurement

## Changed files

- `src/components/SearchableMeasurementUnit.tsx` (new searchable picker)
- `src/components/RequisitionFormModal.tsx` (React/Dashboard requisition modal)
- `src/domain/measurementUnits.ts` (shared search for units and types)
- `src/views/modals/requisition.ts` (legacy requisition modal search)
- `src/events/mainEvents.ts` (legacy unit search, selection, and validation)

## Usage

1. Open **New Purchase Requisition** from Dashboard or Purchase Requisitions.
2. Click **Unit of measurement** and type part of a unit name, abbreviation, or category, such as `kg`, `pieces`, `liter`, `weight`, `packaging`, or `time`.
3. Pick a matching unit; the stored value remains the original stable unit code. The React picker also supports Arrow Up/Down, Enter to choose, and Escape to close.

The older HTML requisition modal has a separate Search field above the native select, with Enter selecting the first filtered option. Search is only a filter; a matching unit must be selected before submission.

The 53 existing measurement units remain unchanged, and saved requisition values are unaffected. Quantity remains integer-only in this update.

## Installation

1. Extract the ZIP into the existing project root, preserving folder names and replacing the corresponding files.
2. Run `npm run build` from the project root.
3. Redeploy the frontend (Cloudflare Pages or GitHub Pages, depending on your setup).
4. Refresh the application to load the new bundle.

No D1 migration and no Cloudflare Worker deployment are required.

## Verification

- Frontend TypeScript check passed (`tsc --noEmit`).
- Search logic checked against the 53-unit catalog for `kg`, `kilogram`, `weight`, `boxes`, `liter`, `pcs`, `square`, `time`, and unmatched searches.
- Full Vite bundle was not verified in the provided Linux working copy (`vite: Permission denied`).
