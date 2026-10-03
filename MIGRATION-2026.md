# Migrating the existing 2026 bot safely

1. Back up the current MongoDB database with `mongodump` before deploying the new bot.
2. Do not reset/delete the existing database.
3. Deploy this version with `CURRENT_SEASON=2026` so the migration can reconcile the current season.
4. On first startup, the migration creates point transactions for completed race/qualifying results and preserves manual point adjustments as signed legacy adjustments.
5. The current season's legacy global `User.totalPoints` is used to reconcile the final current-season total, so positive and negative manual adjustments are not lost.
6. After startup, compare `/leaderboard` and `/predictionstats` for a few users, especially users whose points were manually adjusted.
7. Once verified, future scoring and `/adjustpoints` use the season ledger; `User.totalPoints` is no longer the scoring source of truth.

Do not run `mongorestore` against production unless you intentionally want to replace the database.
