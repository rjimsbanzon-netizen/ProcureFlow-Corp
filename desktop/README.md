# ProcureFlow Windows Desktop (Electron)

This is an **online desktop wrapper** for the existing GitHub Pages frontend:

https://rjimsbanzon-netizen.github.io/Procurement-System/

It uses the existing Cloudflare Worker backend unchanged. It is **not an offline copy**. The hosted website and backend need to remain accessible.

## Build a Windows EXE on GitHub (recommended)

1. Commit the `desktop/` and `.github/workflows/build-windows-exe.yml` files to the `main` branch of `rjimsbanzon-netizen/Procurement-System`.
2. Open **GitHub → Actions → Build ProcureFlow Windows EXE**.
3. Click **Run workflow**, choose `main`, then **Run workflow**. A push that changes `desktop/` also starts a build automatically.
4. Open the completed workflow run and download the **ProcureFlow-Windows-x64** artifact from the **Artifacts** section.
5. Unzip the artifact to find:
   - `ProcureFlow-Setup-1.0.0-x64.exe`: Windows installer.
   - `ProcureFlow-Portable-1.0.0-x64.exe`: runs without installing.

The artifact contains the built `.exe` files. **The source ZIP is not an `.exe`.**

## Local development (optional)

```powershell
cd D:\GitHub\Procurement-System\desktop
npm install
npm start
```

To build locally on a Windows machine:

```powershell
npm run build:win
```

Files are written to `desktop-dist/` at the repository root. The normal React `npm run build` is not needed for this hosted-web wrapper.

## Security and distribution notes

- Only the expected HTTPS GitHub Pages origin is permitted inside the desktop window.
- External HTTPS links open in the user's default browser. Node integration and browser device permissions are disabled.
- The app stores no Google OAuth credentials, API keys, or Cloudflare secrets. They belong in the Worker only.
- The executable uses your existing ProcureFlow logo from `src/procureflow-mark.png`.
- The generated Windows binaries are **not code-signed**, so Windows SmartScreen may warn on first use. Signing requires a trusted code-signing certificate and a separate release process.
- The desktop wrapper is updated by rebuilding this GitHub Action when Electron itself needs upgrading. Website content updates automatically from GitHub Pages.
- If GitHub Actions cannot access the internet/npm or if the website is inaccessible, the app will not function normally; investigate the workflow logs or network connectivity.
- Do not publish executable files containing secrets.
