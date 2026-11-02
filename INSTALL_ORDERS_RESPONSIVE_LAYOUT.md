# ProcureFlow — Orders table dimension and responsive layout fix

This patch is based on the OrdersPage.tsx from **Phase 4 — Foundation** and is compatible with the prior Phase 2/3/4 source changes.

## Files to copy

- `src/pages/OrdersPage.tsx` — replaces the mismatched table-grid implementation with real table columns, and provides responsive order cards with the same actions and details.
- `src/pages/orders-responsive.css` — new stylesheet imported by OrdersPage.tsx. It switches between table, 2-column cards, and 1-column cards based on the *actual width* of the Orders panel.

## Why this is needed

The previous view used eight `<th>` headings but displayed each row as a single `<td colSpan={8}>` containing an independent CSS grid. Column widths could not align reliably with the headings, and action cells could become cramped.

## How to install

1. Back up your current `src/pages/OrdersPage.tsx`.
2. Extract this ZIP at the project root, preserving the `src/pages/` folder structure.
3. Run `npm run build`.
4. Publish your updated frontend to Cloudflare Pages or your configured frontend host.
5. Hard refresh the website, or reload the installed PWA so it receives the new bundle.

**No `wrangler deploy`, D1 migration, or backend changes are needed.**

## Responsive behavior

- Panel width below 730px: one order card per row.
- Panel width 730–1099px: two order cards per row.
- Panel width 1100px or wider: an aligned eight-column table.
- These are *container widths*, not viewport widths, so the layout adapts to an expanded sidebar.

## Business logic preserved

- Supplier only sees assigned supplier orders through `useOrders()`.
- Supplier signature action is shown only while awaiting a signature.
- Delivery action is displayed only with existing delivery permission and remaining quantity checks.
- Details preserve links to requisitions, deliveries, and winning bids under existing `canAccessTab()` checks.
- Existing filtering and search behavior is unchanged.

## Validation

- TypeScript `tsc --noEmit` passed in the reconstructed Phase 4 source project.
- CSS parsed successfully with PostCSS.
- Chromium layout fixture passed at 320, 390, 768, 1024, 1280, 1440, and 1730px, without horizontal page overflow.
- Live authenticated workflow was not tested; verify in a staging deployment before production.
