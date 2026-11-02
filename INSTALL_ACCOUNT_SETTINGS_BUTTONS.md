ProcureFlow — My Account settings as buttons

Changed file:
  src/pages/AccountPage.tsx

What changed:
- My Account initially shows only four settings choices: Profile Information, Profile Picture, Email Verification, and Change Password.
- Selecting a choice opens that setting's existing form. Selecting it again closes it, or selecting a different setting replaces it.
- The automatically visible avatar, profile details, email badge, and settings forms have been removed from the default Account page view. All account operations and server calls remain unchanged.
- The page remains mobile-responsive. The contents of a future public profile page are not changed or decided by this patch.

Installation:
1. Replace src/pages/AccountPage.tsx in the existing ProcureFlow project.
2. Run npm run build from the project root.
3. Redeploy the frontend to Cloudflare Pages and hard-refresh the browser.

No Cloudflare Worker redeployment or D1 migration is required for this UI-only change.

Validation: TypeScript check (tsc --noEmit -p tsconfig.json) passed in the available source tree. Full Vite bundle and live UI behavior not tested.
