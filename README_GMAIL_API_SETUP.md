# ProcureFlow — Gmail API Verification Setup (no custom domain)

This changes the verification email transport from Resend to Gmail API for
**procureflowcorp@gmail.com**. The website can remain on GitHub Pages.

## Prerequisites

- Gmail API enabled on your Google Cloud project.
- Google Auth Platform: External; test user `procureflowcorp@gmail.com` if in Testing.
- OAuth client type **Desktop app** (download the JSON to your Downloads folder).
- Scope: `https://www.googleapis.com/auth/gmail.send`.
- Cloudflare Wrangler configured and logged in for your existing Worker.
- Python 3 and npm on your Windows PC.
- Existing account migrations `0018` and `0019` applied.

## Step 1 — apply these files

Extract this ZIP over your existing project, keeping the `src/`, `cloudflare/src/`,
and `scripts/` paths. Do not commit or upload your Google OAuth JSON file.

## Step 2 — authorize Gmail on your Windows computer

From the project root in PowerShell:

```powershell
py -m pip install google-auth-oauthlib
py scripts/setup_gmail_oauth.py --client-json "$env:USERPROFILE\Downloads\YOUR_DOWNLOADED_DESKTOP_CLIENT.json"
```

Replace the JSON filename with the one you downloaded from Google Cloud.
Sign in to **procureflowcorp@gmail.com** in the browser. Allow only Gmail Send.
The Python script stores the OAuth values directly into Cloudflare Worker
secrets using Wrangler without printing them or storing tokens in your project.

Four secrets are installed:
- `GMAIL_OAUTH_CLIENT_ID`
- `GMAIL_OAUTH_CLIENT_SECRET`
- `GMAIL_OAUTH_REFRESH_TOKEN`
- `EMAIL_CODE_HASH_SECRET` (a random key for hashing one-time codes)

No `RESEND_API_KEY` or `VERIFICATION_FROM_EMAIL` is needed for Gmail sending.
You may remove obsolete Resend secrets after verifying this patch is deployed.

## Step 3 — deploy

```powershell
cd cloudflare
npx wrangler deploy
cd ..
npm run build
```

Deploy your new frontend build to its existing GitHub Pages site. `wrangler`
commands operate on the Worker, *not* on GitHub Pages. Do not run Wrangler
from the project root unless your config is there.

## Step 4 — test

Sign in to ProcureFlow → My Account → Email Verification. Enter an accessible
recipient email address, click Send Verification Code, and check Inbox/Spam.
Enter the 6-digit code within 10 minutes. The email address changes only after
successful verification. Existing outstanding Resend codes will need a new code.

If Gmail sending fails, inspect Worker logs (avoid logging secrets):

```powershell
cd cloudflare
npx wrangler tail
```

Check that the OAuth token was authorized as `procureflowcorp@gmail.com`, that
Gmail API is enabled, and that the OAuth grant is still valid.

## Google testing-mode limitation

For External OAuth apps in Testing mode, Google generally expires refresh tokens
after **7 days** when requesting Gmail scopes. The sender may stop working after
a week until reauthorized. Publishing for long-term production sending can
require Google OAuth verification for the sensitive `gmail.send` scope. Follow
Google's approval requirements; don't assume a test token will work forever.

Google API references:
- https://developers.google.com/workspace/gmail/api/guides/sending
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/identity/protocols/oauth2
- https://developers.cloudflare.com/workers/configuration/secrets/

## Security and scope

No D1 schema migration is required for this email-transport change. Access
and refresh tokens never belong in GitHub Pages, the React frontend, a public
repo, a chat message, or a screenshot. The Worker can send mail only after
Google OAuth authorization. No real email was sent as part of these source
changes because the user has to authorize the sender on their own computer.
