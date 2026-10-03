# Ace's Apex F1 Prediction Bot

Discord bot for F1 race and qualifying predictions, season standings, scoring, memberships, reminders and administration.

## Important production requirements

- Use MongoDB Atlas or another MongoDB deployment that supports transactions/replica sets. Result processing uses MongoDB transactions to prevent partial scoring.
- For Railway, add the variables from `.env.example` directly in Railway's Variables tab; a local `.env` file is not required.
- Deploy slash commands with `npm run deploy` after code updates.
- The old `/announcement` command has been removed. Race/qualifying opening announcements are automatic from the event prediction windows.
- `/resetseason season:<year>` switches the active season without deleting or resetting historical data.
- `/recalculateresults` corrects a completed race result.
- `/recalculatequalifying` corrects a completed qualifying result.
- `/deleterace` and `/deletequalifying` now safely cancel events instead of destructively deleting historical competition data.

## Backups

Create a BSON backup using the official MongoDB Database Tools (`mongodump`):

```bash
npm run backup
```

The backup is stored in MongoDB dump format (compressed BSON), not JSON. The machine running the bot must have `mongodump` installed and available on `PATH`.

Restore only when intentionally replacing database contents. This uses `mongorestore` with `--drop`, so it replaces the selected database contents:

```bash
ALLOW_RESTORE=YES npm run restore -- ./backups/<timestamp>
```

The restore also requires the official MongoDB Database Tools (`mongorestore`) to be installed and available on `PATH`.

Keep backups off the bot server as well if they are intended for disaster recovery.

## Driver roster

`F1_DRIVERS` can be supplied as a comma-separated environment variable so driver changes do not require editing source code. Existing bundled drivers are used as a fallback.

## Railway variables

The bot reads environment variables directly from Railway. You do not need to upload a `.env` file. `ANNOUNCEMENT_CHANNEL_ID` is still required for the automatic race/qualifying prediction-opening announcements; only the `/announcement` command was removed.

Required: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `MONGODB_URI`, `CURRENT_SEASON`, `ANNOUNCEMENT_CHANNEL_ID`, `RESULTS_CHANNEL_ID`, `STATISTICS_CHANNEL_ID`, `LOGS_CHANNEL_ID`, `DM_LOGS_CHANNEL_ID`, `ADMIN_ROLE_ID`, `PREDICTOR_ROLE_ID`, `SUPPORTER_ROLE_ID`, `RACEPASS_ROLE_ID`.

Optional: `F1_DRIVERS` (comma-separated driver names; bundled drivers are used if omitted). `ALLOW_RESTORE=YES` is only needed temporarily when running the destructive restore script, not for normal Railway bot operation.
