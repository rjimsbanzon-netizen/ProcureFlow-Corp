"""Authorize the ProcureFlow sender using Google OAuth, saving secrets into Cloudflare.

Run LOCALLY on your own Windows machine, NOT in GitHub Actions or a public server.
No OAuth token is saved to disk, echoed to the terminal, or uploaded to ChatGPT.

One-time dependencies: py -m pip install google-auth-oauthlib
Example:
  py scripts/setup_gmail_oauth.py --client-json "$env:USERPROFILE\\Downloads\\client_secret_....json"
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys

SCOPE = "https://www.googleapis.com/auth/gmail.send"
EXPECTED_SENDER = "procureflowcorp@gmail.com"


def store_secret(cloudflare_dir: Path, name: str, value: str) -> None:
    command = ["npx.cmd" if os.name == "nt" else "npx", "wrangler", "secret", "put", name]
    completed = subprocess.run(command, input=value + "\n", text=True, cwd=str(cloudflare_dir), check=False)
    if completed.returncode:
        raise RuntimeError(f"Wrangler could not save {name}. Check Wrangler login and selected Worker.")
    print(f"Stored {name} in Cloudflare Worker secrets.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Connect ProcureFlow's Gmail sender to its Cloudflare Worker")
    parser.add_argument("--client-json", required=True, help="Path to Google Desktop OAuth client JSON (keep private)")
    parser.add_argument("--cloudflare-dir", default=None, help="Worker folder, defaults to project/cloudflare")
    args = parser.parse_args()

    credentials_file = Path(args.client_json).expanduser().resolve()
    project_root = Path(__file__).resolve().parents[1]
    worker_dir = Path(args.cloudflare_dir).expanduser().resolve() if args.cloudflare_dir else project_root / "cloudflare"
    if not credentials_file.is_file():
        print("The OAuth client JSON was not found. Check the --client-json path.", file=sys.stderr)
        return 1
    if not (worker_dir / "wrangler.toml").is_file() and not (worker_dir / "wrangler.jsonc").is_file():
        print("Worker configuration not found in cloudflare/. Supply --cloudflare-dir if needed.", file=sys.stderr)
        return 1
    # Never encourage accidentally committing downloaded credentials to Git.
    if project_root == credentials_file.parent or project_root in credentials_file.parents:
        print("Security warning: OAuth client JSON is inside your project. Move it to Downloads first.", file=sys.stderr)
        return 1

    try:
        config = json.loads(credentials_file.read_text(encoding="utf-8"))
        client = config["installed"]
        client_id = str(client["client_id"])
        client_secret = str(client["client_secret"])
    except (KeyError, ValueError, OSError, TypeError):
        print("Expected a Desktop app OAuth client JSON from Google Cloud Console.", file=sys.stderr)
        return 1

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print("Install the local OAuth helper with: py -m pip install google-auth-oauthlib", file=sys.stderr)
        return 1

    print(f"A browser window will open. Authorize ONLY {EXPECTED_SENDER} to send Gmail messages.")
    print("The permission requested is gmail.send (send only).")
    flow = InstalledAppFlow.from_client_secrets_file(str(credentials_file), [SCOPE])
    auth = flow.run_local_server(port=0, prompt="consent", access_type="offline", login_hint=EXPECTED_SENDER, open_browser=True)
    refresh_token = auth.refresh_token
    if not refresh_token:
        print("Google did not issue a refresh token. Revoke the app's existing grant and retry with consent.", file=sys.stderr)
        return 1

    print("\nCloudflare Worker secrets will be updated now. No tokens will be displayed or written to disk.")
    answer = input("Are you signed in to the intended Cloudflare account and ready? [y/N]: ")
    if answer.strip().lower() != "y":
        print("No secrets uploaded.")
        return 1

    try:
        store_secret(worker_dir, "GMAIL_OAUTH_CLIENT_ID", client_id)
        store_secret(worker_dir, "GMAIL_OAUTH_CLIENT_SECRET", client_secret)
        store_secret(worker_dir, "GMAIL_OAUTH_REFRESH_TOKEN", refresh_token)
        store_secret(worker_dir, "EMAIL_CODE_HASH_SECRET", secrets.token_urlsafe(48))
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print("\nOAuth setup complete. Deploy the updated Worker code with: cd cloudflare && npx wrangler deploy")
    print("Use My Account → Email Verification to send a test code after deployment.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
