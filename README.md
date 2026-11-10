# Routine v2.2

A quiet, mobile-first PWA for observing the frequency of everyday activities. No cloud account, external JavaScript, analytics, or backend. Designed for iPhone, with a read-only desktop backup viewer.

## Features

- **One-tap logging:** Tap an activity to record it immediately. Each card shows today's count; same-day records are unlimited. A 600 ms per-activity guard suppresses accidental rapid taps, while deliberate repeats and separately submitted backfills remain available. Undo is available.
- **Easy customization:** Add/rename/archive/delete activities, with a searchable, categorized emoji library and custom emoji input.
- **Backfill:** Add past events with the actual occurrence date using the lower-right button (at least 48 × 44 CSS px); edit or delete history.
- **Insights:** 7-day and 30-day counts, per-activity stats (7-day, 30-day, all-time) and approximate integer frequency per day, week or month.
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

Run regression checks with `node --test tests/*.test.mjs` (Node 22+).

## Frequency calculation

The window includes today and the preceding 29 local calendar days. Observation starts on the activity's creation date (or an earlier recorded-at date in an imported backup). It is capped at 30 days, with partial observation explicitly labeled. Backfills before observation began remain in history and actual period counts but do not extend observation or enter the frequency estimate. DST does not shorten or lengthen a calendar day.

Estimates require at least 7 observed calendar days and at least 2 records on different dates. Otherwise the UI shows “记录不足”; a full 30-day window without records shows “近 30 天无记录”. Multiple records on the same date are counted individually. Future dates are excluded.

The estimate divides the eligible record count by observed days. It chooses the smallest of day/week/30-day month whose integer rounding error is at most 10%, falling back to month. In-session hysteresis (15% exit, 5% entry) reduces switching near boundaries. Every estimate says “约”; counts and stored records are never rounded. Missing logs can lower the estimate.

V2.2 retains the IndexedDB name `routine-tracker-v2`, database version 1, `documents` store, `state` key, state schema 2, and JSON backup version 2. No migration or clearing is performed. The service worker only replaces shell caches.

## Deploy

1. Preserve the current `main` branch until V2 is tested.
2. Copy these files to the repository root in a feature branch, retaining the existing `CNAME` file.
3. Review then merge to `main`, or configure GitHub Pages to deploy the new branch.
4. In iPhone Safari, visit `https://routine.zhuyg.com`, use **Share → Add to Home Screen**, and enable **Open as Web App**.

## Privacy and durability

An installed web app can lose locally stored data when site data is cleared, the app is deleted, or the OS purges storage. Store occasional JSON backups somewhere independent (e.g. iCloud Drive). An export means the file was generated; verify it was actually saved.

## Data format

One IndexedDB record holds the local state: `activities`, `logs`, and `meta`. Each log includes both `occurredAt` (when the activity happened) and `recordedAt` (when entered). Backups include `app: "routine-tracker"` and `version: 2` for validation.

## V2.1 preview

The mobile preview runs under a separate IndexedDB database and uses example logs; it does not modify the live site or real local data. Production update can be merged only after review. The installed PWA normally updates on reopening/reloading and does not need reinstallation; never delete the installed app just to get an update, because local data can be lost.
