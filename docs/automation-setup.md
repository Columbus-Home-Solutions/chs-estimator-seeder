# Quarterly Auto-Update + Jobber Sync — Setup Guide

This doc walks you through enabling the quarterly pipeline that:

1. Scrapes fresh labor-cost market data
2. Recomputes target prices
3. Writes them to the Google Sheet
4. Exports the Jobber CSV
5. **Automatically syncs Products & Services to Jobber** via their GraphQL API
6. Emails you the run summary

The workflow runs on **Jan 15, Apr 15, Jul 15, Oct 15 at 9:00am Central** via GitHub Actions. You can also trigger it anytime from the GitHub UI ("Run workflow" button on the Actions tab).

---

## One-time setup (about 45 minutes end-to-end)

### Step 1 — Register a Jobber developer app (10 min)

1. Go to https://developer.getjobber.com/ and sign in with your Jobber account (or create a developer account linked to yours).
2. Navigate to **Apps** → **New**.
3. Fill in:
   - **App name:** `CHS Pricebook Sync`
   - **Developer name:** your business name
   - **OAuth Callback URL:** **leave blank**. Jobber automatically allows any `http://localhost` URL regardless of port, so the bootstrap script's `http://localhost:53682/callback` will work without needing to be listed. (If you enter `localhost` here, Jobber will reject the save with "'localhost' is supported automatically and shouldn't be listed".)
   - **Scopes:** Jobber doesn't have a standalone "Products & Services" scope. Enable whichever scope(s) the UI shows related to products, services, line items, or work items. If the exact name isn't obvious, enable any scope that sounds close and we'll verify via GraphiQL (see Step 2.5 below).
4. Save. The Developer Center will show you a **Client ID** and **Client Secret**. Keep these ready.

### Step 1.5 — Verify the scope lets you access Products & Services

Before leaving the Developer Center, click the three dots next to your app → **Test in GraphiQL**. Paste this query and click Run:

```graphql
query { productOrServices(first: 3) { nodes { id name } } }
```

- If you see your Jobber catalog items, the scope is correct — continue to Step 2.
- If you see a "scope not authorized" / `Permission denied` error, the error message will name the required scope. Go back to the app editor, enable that scope, and test again.

You can also browse the full schema via the **Docs** icon (top-left in GraphiQL) to confirm available fields and mutations (e.g. `productOrServiceEdit`, `productOrServiceCreate`).

### Step 2 — Get your initial Jobber refresh token (5 min)

On your Mac, add these two lines to your `.env` file:

```env
JOBBER_CLIENT_ID=<your client id from step 1>
JOBBER_CLIENT_SECRET=<your client secret from step 1>
```

Then run:

```bash
npm run jobber:bootstrap
```

A browser tab opens asking you to approve the app for your Jobber account. Click **Allow**. The script will catch the callback, exchange the auth code for tokens, and write two more lines to your `.env`:

```env
JOBBER_REFRESH_TOKEN=<refresh token>
JOBBER_ACCESS_TOKEN=<short-lived, auto-refreshed>
```

### Step 3 — Test the Jobber sync locally (5 min)

With your `.env` populated, dry-run the sync to confirm everything is wired correctly:

```bash
DRY_RUN=true npm run sync:jobber
```

You should see output like `[dry] CREATE ...` / `[dry] UPDATE ...`. No writes happen.

Then run the real sync once:

```bash
npm run sync:jobber
```

This will create/update every pricebook item in Jobber. Check your Jobber Products & Services to confirm.

### Step 4 — Create a GitHub Personal Access Token for secret rotation (5 min)

Jobber rotates refresh tokens on every use, so the workflow needs to update the `JOBBER_REFRESH_TOKEN` secret in GitHub after each run.

1. Go to https://github.com/settings/personal-access-tokens/new (fine-grained token, recommended).
2. **Repository access:** "Only select repositories" → pick this repo.
3. **Permissions:**
   - Repository → **Secrets** → **Read and write**
4. Create the token, copy it.

### Step 5 — Configure GitHub repository secrets (10 min)

In your GitHub repo go to **Settings → Secrets and variables → Actions → New repository secret**. Add each of these:

| Secret name | Value |
|---|---|
| `SHEET_ID` | Your Google Sheet URL or ID |
| `GCP_SERVICE_ACCOUNT_JSON` | Full JSON contents of the Google service account key that has access to the sheet |
| `JOBBER_CLIENT_ID` | From Step 1 |
| `JOBBER_CLIENT_SECRET` | From Step 1 |
| `JOBBER_REFRESH_TOKEN` | The value of `JOBBER_REFRESH_TOKEN` from your `.env` after Step 2 |
| `REPO_SECRETS_PAT` | The PAT from Step 4 (used to rotate the refresh token) |
| `SMTP_HOST` | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | e.g. `465` |
| `SMTP_USERNAME` | Your SMTP username |
| `SMTP_PASSWORD` | App password (for Gmail, create at https://myaccount.google.com/apppasswords) |
| `SMTP_FROM` | e.g. `"CHS Pricebook Bot <bot@yourdomain.com>"` |
| `NOTIFY_EMAIL_TO` | Your email address |

### Step 6 — Trigger a manual run to validate (5 min)

1. Go to the repo's **Actions** tab.
2. Select **Quarterly Pricebook Update**.
3. Click **Run workflow**. Set **Dry run** to `true` for the first attempt.
4. Watch it run. It should complete in ~2 minutes. Check the log for any errors.
5. Once the dry run is clean, re-run with `dry_run=false` to do the first real sync.

You're done. The workflow will now fire automatically every quarter.

---

## What happens during each quarterly run

```
┌────────────────────────────────────────────────────────┐
│ GitHub Actions (cron trigger)                          │
├────────────────────────────────────────────────────────┤
│ 1. npm run scrape:market                               │
│    → fetches 16 Homewyse URLs, extracts labor ranges   │
│    → writes data/market_labor_observations.json        │
│    → writes data/scrape_report.json (per-source status)│
│                                                         │
│ 2. npm run build:market-rates                          │
│    → blends fresh scrape + RSMeans + prior obs         │
│    → writes data/market_labor_targets.json             │
│                                                         │
│ 3. npm run apply:market-rates                          │
│    → updates Pricebook_Master.labor_hours_per_unit     │
│    → (does NOT touch ARRAYFORMULA calc columns)        │
│                                                         │
│ 4. npm run export:jobber-csv                           │
│    → regenerates data/jobber_products_services.csv     │
│                                                         │
│ 5. npm run sync:jobber                                 │
│    → refreshes access token via OAuth 2.0              │
│    → lists all existing Jobber products                │
│    → upserts each pricebook item (create or edit)      │
│    → writes data/jobber_sync_summary.json              │
│                                                         │
│ 6. Rotate JOBBER_REFRESH_TOKEN secret in GitHub        │
│ 7. Commit updated JSON/CSV to the repo                 │
│ 8. Email summary report                                │
└────────────────────────────────────────────────────────┘
```

## Extending the scraper

To add or modify sources, edit `data/market_scrape_sources.json`. Each entry looks like:

```json
{
  "item_code": "FLR-TILE-STD",
  "unit": "sf",
  "url": "https://www.example.com/cost-guide",
  "source_name": "Example - Tile Install",
  "patterns": [
    "\\$([0-9]+\\.?[0-9]*)\\s*[–-]\\s*\\$([0-9]+\\.?[0-9]*)\\s*per\\s*square\\s*foot"
  ]
}
```

Each regex must have **two capture groups** (low, high). Add multiple patterns if a site's HTML changes seasonally — the first match wins.

## Running outside of GitHub Actions

The whole pipeline runs locally too:

```bash
npm run quarterly:run
```

This does scrape → build → apply → export → sync in order. Handy for off-cycle updates.

## Troubleshooting

- **Jobber sync returns `401`:** the refresh token got revoked. Run `npm run jobber:bootstrap` again, then update the `JOBBER_REFRESH_TOKEN` GitHub secret manually.
- **Scrape "MISS pattern_not_matched":** the site redesigned. Open the URL, copy the actual text near the labor price, and tweak the pattern in `data/market_scrape_sources.json`. The rest of the run still succeeds.
- **Email doesn't arrive:** confirm SMTP secrets are set and the provider allows app passwords. Gmail requires [App Passwords](https://myaccount.google.com/apppasswords) with 2FA enabled.
- **Refresh-token rotation warning:** if `REPO_SECRETS_PAT` isn't set, the workflow logs a warning but still succeeds. You'll eventually need to re-bootstrap (run `npm run jobber:bootstrap`) and update the secret manually when the token expires.
