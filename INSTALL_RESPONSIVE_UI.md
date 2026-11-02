# ProcureFlow responsive mobile, tablet, and desktop UI

## Apply the changed files

Copy the files in this ZIP into the root of your latest ProcureFlow/Vite project, keeping the directory structure. **Keep all existing source code and cloudflare files that are not included in this patch.** The new `src/styles/responsive.css` file is required because `src/main.tsx` now imports it.

Files changed:
- `src/App.tsx` — full-width content; mobile navigation drawer state, backdrop, keyboard closing; prevents duplicate event handlers when toggling the drawer.
- `src/components/Sidebar.tsx` — the existing role-filtered navigation becomes a mobile/tablet drawer with close button and keyboard focus management; desktop navigation remains visible.
- `src/components/Header.tsx` — compact adaptive header, menu toggle, and mobile branding.
- `src/components/MobileQuickActions.tsx` — adds a fifth **Menu** shortcut to open all permitted modules.
- `src/main.tsx` — loads the responsive stylesheet after the existing theme.
- `src/styles/responsive.css` — breakpoints, safe-area padding, responsive forms, table scrolling, modals, header, and PWA navigation.

## Deploy

From the project root:

```bash
npm install
npm run build
```

Publish the generated `dist/` folder to your existing Cloudflare Pages project (or push to GitHub if Pages builds the repository automatically). On mobile, close/reopen an installed PWA or refresh to pick up updated assets.

**No database migration and no Wrangler Worker deployment are required.**

## Layout and behavior

- Under **1024px**: primary navigation moves to an accessible slide-out drawer, with an overlay and Escape-to-close. Navigation remains filtered by account permissions.
- Under **768px**: compact toolbar and persistent bottom navigation (including Menu); notification popover stays inside the viewport.
- Under **560px**: dense two-/three-column form groups stack vertically, dashboard content fits narrow screens, modal content scrolls, and tables scroll horizontally within their containers.
- **1024px and above**: persistent desktop sidebar, no bottom menu.
- Retains the PF Corp color palette and all existing procurement actions, approvals, bidding, notifications, and PWA support.

## Verification

- Frontend TypeScript check passed.
- Chromium layout checks passed at 320, 390, 768, 1024, and 1440px with no page-level horizontal overflow in the test fixture.
- A full Vite bundle could **not** be run in the current workspace because the uploaded `node_modules` contains Windows Rollup binaries but lacks `@rollup/rollup-linux-x64-gnu`. Running `npm install` on your own machine should install platform-appropriate dependencies.
- Live Cloudflare Pages / mobile-device verification was not performed.
