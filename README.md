# Routine v2

A quiet, mobile-first PWA for observing the frequency of everyday activities. No cloud account, external JavaScript, analytics, or backend. Designed for iPhone, with a read-only desktop backup viewer.

## Features

- **One-tap logging:** Tap an activity to record it immediately. Undo is available.
- **Easy customization:** Add/rename/archive/delete activities, with optional emoji symbols.
- **Backfill:** Add past events with the actual occurrence date; edit or delete history.
- **Insights:** 7-day and 30-day counts, eight-week trend, and median interval between distinct activity dates.
- **Device-local data:** Records are stored in IndexedDB, never sent to a server.
- **Backups:** JSON export and restore, CSV export. In-app backup reminder after 10 records or 7 days with ≥3 records, then every 30 days after an export. Reminders only appear while the app is open.
- **Desktop viewing:** On the iPhone export JSON to iCloud Drive; on a computer open the same site and select **Settings → View backup (read-only)**. The snapshot is stored locally in that computer's browser. Later phone activity does not sync automatically; import a new JSON backup to refresh.
- **Offline PWA:** An installable home-screen web app with a service worker that caches its shell.

## Why not automatic desktop sync?

GitHub Pages is a static host. iPhone IndexedDB cannot be read from another browser or device. Automatic syncing would need some shared storage/service, such as a database or an authenticated file-storage integration. This build intentionally does not include one.

## Run locally

Serve the folder from a local HTTP server (required for a service worker):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/` in a browser. GitHub Pages can serve these same static files without a build step.

## Deploy

1. Preserve the current `main` branch until V2 is tested.
2. Copy these files to the repository root in a feature branch, retaining the existing `CNAME` file.
3. Review then merge to `main`, or configure GitHub Pages to deploy the new branch.
4. In iPhone Safari, visit `https://routine.zhuyg.com`, use **Share → Add to Home Screen**, and enable **Open as Web App**.

## Privacy and durability

An installed web app can lose locally stored data when site data is cleared, the app is deleted, or the OS purges storage. Store occasional JSON backups somewhere independent (e.g. iCloud Drive). An export means the file was generated; verify it was actually saved.

## Data format

One IndexedDB record holds the local state: `activities`, `logs`, and `meta`. Each log includes both `occurredAt` (when the activity happened) and `recordedAt` (when entered). Backups include `app: "routine-tracker"` and `version: 2` for validation.
