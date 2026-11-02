# ProcureFlow — Responsive fonts and typography patch

This is a **changed-files-only** update for the latest mobile/tablet responsive ProcureFlow system. It does not replace your application or change procurement rules, API routes, or database schema.

## Files included

- `index.html` — loads **Manrope** for headings and **Open Sans** for body/data text. Existing colors and icons are unchanged. The fonts have fallback families if the device is offline.
- `src/main.tsx` — imports the new typography stylesheet **after** `responsive.css`, so the new type scale wins where appropriate.
- `src/styles/typography.css` — adaptive sizing for module headings, sidebar, cards, metrics, buttons, tables, forms, dialogs, login screen and PWA bottom navigation.

Keep the existing `src/styles/responsive.css` from the last responsive UI update; this patch is additive.

## Install

Extract the ZIP at your Vite project root, preserving paths and replacing only the three files above. Then from the project root run:

```bash
npm install
npm run build
```

Redeploy the resulting `dist/` folder to Cloudflare Pages, or push to the repository connected to Pages. For an installed PWA, refresh/reopen it to obtain the new styles. No database migration or Worker `wrangler deploy` is needed.

## Breakpoints and readability

- **320–380px narrow phones:** compact header title, readable five-item bottom navigation, no page-level side scrolling.
- **381–767px phones:** larger hero headings, fluid body text, all form controls at least **16px** to avoid iOS focus zoom.
- **768–1023px tablets:** medium headings and comfortable navigation sizes.
- **1024px+ laptops/desktops:** progressively larger headings and metric values, with comfortable table spacing on 1200px+ screens.
- Type scales with the viewport via CSS `clamp()` rather than fixed sizes everywhere, and the browser's text scaling/zoom remains enabled.

## Validation performed

- Frontend TypeScript check passed.
- The new stylesheet parsed cleanly and Tailwind compiled the original theme in the test workspace.
- Chromium layout tests checked 320, 390, 768, 1024, 1440px and found no page-level overflow in a representative shell fixture; headings and navigation type sizes scaled correctly.
- Full Vite bundle could not complete in the current Linux test container because this project's existing `node_modules` lacks the Linux Rollup native package. Reinstall dependencies on your machine and run the build command above.

The server/Cloudflare Worker was not modified.
