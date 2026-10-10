# Ace's Apex F1 Prediction Bot

A Discord bot for running an F1 prediction competition and community membership system inside a Discord server.

The bot currently supports:

- 🏎️ Race podium predictions (P1/P2/P3)
- 🏁 Qualifying / pole-position predictions
- 🏆 Season leaderboards and individual rankings
- 📊 Prediction statistics
- 🧮 Automatic scoring and result recalculation
- ⏰ Prediction opening, closing, and reminder automation
- 🎟️ Race Passes and supporter memberships
- 💳 Manual payment verification for UPI / PayPal purchases
- 📋 Verified-payment synchronization to Google Sheets
- 💬 DM logging and membership/payment notifications
- 📝 Race feedback collection and feedback statistics
- 👮 Admin tools for race setup, results, points, memberships, and seasons
- 💾 MongoDB backup and restore support

## How the bot runs

The production runtime is Node.js:

```text
Railway
  │
  └── npm start
        │
        └── src/index.js
              ├── Connect to MongoDB
              ├── Run startup data migrations
              ├── Log in to Discord
              ├── Register commands/events
              └── Run the scheduled background worker
```

The bot uses:

- **Discord.js** for Discord commands, buttons, menus, modals, DMs, and roles.
- **MongoDB / Mongoose** for persistent data.
- **node-cron** for the once-per-minute scheduler.
- **Google Sheets API** for verified-payment bookkeeping when configured.
- **MongoDB transactions** for race-result scoring and other consistency-sensitive operations.

### Startup sequence

When `src/index.js` starts, it:

1. Loads environment variables.
2. Connects to MongoDB.
3. Runs the v4/v5 data-integrity migrations.
4. Logs in to Discord.
5. Registers the command and event handlers.
6. Starts the scheduler from the ready event.

If startup fails, the process exits instead of continuing in a partially initialized state.

## Prediction system

### Race predictions

Users run:

```text
/predict
```

The bot shows races that are currently open for predictions.

The user selects:

1. 🥇 P1
2. 🥈 P2
3. 🥉 P3

The bot validates the selections and saves one prediction per user per race.

The default prediction window is:

- **Opens:** 24 hours before the race
- **Closes:** 10 minutes before the race

The exact times are stored on the race record and checked again immediately before submission.

### Qualifying predictions

Users run:

```text
/predictqualifying
```

They select an open qualifying session and predict the pole-position driver.

The same final time-window check is performed before the prediction is saved.

### DM behaviour

`/predict` and `/predictqualifying` are intended to be used inside the Discord server.

If either command is used as a Discord slash command in DMs, the bot replies:

> Use the bot commands in server please, Thanks :)

The bot also detects literal DM messages containing `/predict` or `/predictqualifying` and sends the same response.

Other incoming DMs can be logged to the configured DM-log channel.

## Scoring

### Race scoring

The default scoring table is:

| Correct podium positions | Points |
|---:|---:|
| 3 | 25 |
| 2 | 18 |
| 1 | 15 |
| 0 | 0 |

Only the exact predicted positions count. For example, predicting a driver P1 when they finish P2 does not count as a correct P1 position.

### Qualifying scoring

| Pole prediction | Points |
|---|---:|
| Correct | 5 |
| Incorrect | 0 |

### Score storage

The bot uses a point-transaction ledger as the authoritative source for season totals.

Race and qualifying result processing updates:

- Prediction points
- Point transactions
- Season standings

Race-result processing is performed inside a MongoDB transaction so a failed operation does not intentionally leave half of the result processed.

Corrected results can be recalculated without creating duplicate point transactions.

## Season management

The active season is controlled by `CURRENT_SEASON`.

Administrators can switch seasons with:

```text
/resetseason season:<year>
```

A season switch does **not** delete historical races, predictions, results, or standings.

The bot maintains season-specific records so historical competition data can remain available.

## Race and qualifying administration

Administrators can activate events from the configured season calendar.

### Race

```text
/setrace race:<race>
```

This creates or updates the configured race and calculates its prediction-open and prediction-close times.

### Qualifying

```text
/setqualifying race:<race>
```

This creates or updates the qualifying session associated with that calendar event.

### Enter race results

```text
/results
```

An administrator selects a closed race and enters official:

- P1
- P2
- P3

The bot scores all predictions, records point transactions, updates the race, publishes the result, and rebuilds season standings.

### Correct race results

```text
/recalculateresults
```

Used when an official race result needs to be corrected.

### Enter qualifying results

```text
/qualifyingresult
```

### Correct qualifying results

```text
/recalculatequalifying
```

### Event cancellation

```text
/deleterace
/deletequalifying
```

These commands are intended to cancel events while preserving historical competition records rather than destructively deleting them.

## Automatic scheduler

The bot runs a background scheduler every minute.

It handles:

- Race prediction-window status
- Qualifying prediction-window status
- Race opening announcements
- Qualifying opening announcements
- 12-hour prediction reminders
- 6-hour prediction reminders
- 1-hour prediction reminders
- Custom user reminders
- Membership expiry reminders
- Membership role expiry/removal
- Race Pass activation and expiry processing
- Cancelled Race Pass reconciliation
- Verified-payment Google Sheet synchronization
- Recovery of stale payment-verification requests
- Race prediction statistics

The scheduler uses a MongoDB lock so multiple bot processes should not simultaneously perform the same scheduled work.

## Memberships and Race Passes

The bot supports:

- 🏁 Race Pass
- 📅 Monthly Supporter membership
- 📅 Yearly Supporter membership

Memberships are represented by Discord roles and MongoDB records.

Administrators can manually grant memberships with:

```text
/grantmembership
```

Membership information can be checked with:

```text
/membershipinfo
```

Memberships can be removed with:

```text
/deletemembership
```

The scheduler sends expiry reminders and removes expired membership roles.

### Race Passes

Race Passes are tied to a specific configured race.

They can be purchased through:

```text
/purchasemembership
```

Race Passes may be scheduled to activate when the race weekend begins and expire according to the configured race-pass schedule.

## Payment verification

The purchase flow is intentionally **manual verification**, not automatic payment confirmation.

The general flow is:

```text
User
  │
  ├── /purchasemembership
  │
  ├── Select India / International
  │
  ├── Select membership type
  │
  ├── Pay through the displayed method
  │
  └── "I have paid"
          │
          └── Enter payer name
                    │
                    ▼
             PaymentVerification
                    │
                    ▼
              Admin reviews
               ┌────┴────┐
               │         │
            Verify     Reject
               │
               ▼
        Membership/Race Pass
```

Clicking **I have paid** does not grant access by itself.

An administrator must verify the payment and use the verification control before the membership or Race Pass is granted.

The bot also protects against processing the same payment-verification request multiple times.

## Google Sheets integration

Verified payments can be synchronized to Google Sheets.

The integration supports:

- Indian supporter payments
- International supporter payments
- Race Pass payments

The bot expects configured Google service-account credentials and a spreadsheet containing the expected tabs/headers.

Required Google Sheets variables are:

```text
GOOGLE_SHEETS_CLIENT_EMAIL
GOOGLE_SHEETS_PRIVATE_KEY
GOOGLE_SHEETS_SPREADSHEET_ID
```

If a sheet sync fails after a payment is verified, the payment remains verified and the scheduler retries the sheet synchronization.

## Feedback system

The bot contains a feedback workflow for race/community feedback.

Users can be asked:

1. Whether they attended the race stream
2. Their experience rating
3. Optional written feedback

Feedback is stored in MongoDB and administrators can view feedback statistics.

The feedback workflow is separate from prediction scoring.

## Useful commands

### User commands

| Command | Purpose |
|---|---|
| `/predict` | Submit race podium prediction |
| `/predictqualifying` | Submit qualifying/pole prediction |
| `/showprediction` | View a submitted prediction |
| `/leaderboard` | View season leaderboard |
| `/rank` | View ranking |
| `/predictionstats` | View prediction statistics |
| `/membershipinfo` | View membership information |
| `/purchasemembership` | Start membership/Race Pass purchase flow |
| `/feedback` | Start the feedback workflow |
| `/privacy` | View the privacy-policy link |
| `/dm` | Use the configured DM utility |

### Admin commands

Admin access is additionally checked in the command handlers using the configured admin role.

| Command | Purpose |
|---|---|
| `/setrace` | Activate/update a race |
| `/setqualifying` | Activate/update qualifying |
| `/results` | Enter race result |
| `/qualifyingresult` | Enter qualifying result |
| `/recalculateresults` | Correct/recalculate race result |
| `/recalculatequalifying` | Correct/recalculate qualifying result |
| `/deleterace` | Cancel a race |
| `/deletequalifying` | Cancel qualifying |
| `/resetseason` | Switch active season |
| `/adjustpoints` | Add/remove season points |
| `/grantmembership` | Grant membership/Race Pass |
| `/deletemembership` | Remove membership |
| `/remind` | Create a reminder |
| `/announcement` | Send the standard race-weekend announcement |
| `/feedback` | Manage the feedback workflow |
| `/feedbackstats` | View feedback statistics |

> Note: `/announcement` is currently still present in the source and command deployment list. Race/qualifying opening announcements are also generated automatically by the scheduler. This README describes the code as it currently exists rather than the older documentation.

## Environment variables

Create a local `.env` for development, or configure the same variables in Railway.

### Required Discord/MongoDB variables

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
MONGODB_URI=
CURRENT_SEASON=2026
```

### Required channel IDs

```env
ANNOUNCEMENT_CHANNEL_ID=
RESULTS_CHANNEL_ID=
STATISTICS_CHANNEL_ID=
LOGS_CHANNEL_ID=
DM_LOGS_CHANNEL_ID=
```

### Required role IDs

```env
ADMIN_ROLE_ID=
PREDICTOR_ROLE_ID=
SUPPORTER_ROLE_ID=
RACEPASS_ROLE_ID=
```

### Optional driver configuration

```env
F1_DRIVERS=
```

If `F1_DRIVERS` is empty or omitted, the bundled driver list is used.

### Optional restore flag

```env
ALLOW_RESTORE=YES
```

Do **not** leave this enabled unnecessarily. It is only required to explicitly authorize the destructive restore command.

### Google Sheets variables

If Google Sheets payment synchronization is being used:

```env
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=
```

## Local development

Install dependencies:

```bash
npm install
```

Start the bot:

```bash
npm start
```

Run in watch mode:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Deploy the guild slash commands:

```bash
npm run deploy
```

The command deployment targets the configured Discord guild:

```text
DISCORD_CLIENT_ID
DISCORD_GUILD_ID
```

After changing command definitions, run `npm run deploy` so Discord receives the updated command schema.

## Railway deployment

The intended production process is:

1. Push the code to the GitHub repository.
2. Deploy the `fixed-v4-migration` branch to Railway.
3. Configure the required environment variables in Railway.
4. Make sure MongoDB is reachable and supports transactions.
5. Deploy slash commands with `npm run deploy` when command definitions change.
6. Start the bot with:

```bash
npm start
```

A local `.env` file is not required on Railway.

### Important Railway considerations

- MongoDB must support transactions/replica sets.
- Keep `MONGODB_URI` private.
- Keep `DISCORD_TOKEN` private.
- Keep Google service-account credentials private.
- The bot needs the Discord permissions required for its configured channels and roles.
- The bot needs permission to manage the membership/Race Pass roles it assigns.
- The bot needs access to the configured announcement, results, statistics, logs, and DM-log channels.

## Backups

The project uses the official MongoDB Database Tools.

Create a compressed BSON backup:

```bash
npm run backup
```

The default output is:

```text
./backups/<timestamp>/<database-name>/
```

The backup is **BSON**, not JSON.

The machine performing the backup must have `mongodump` installed and available on `PATH`.

### Restore

Restore is intentionally destructive because the script uses `mongorestore --drop`.

```bash
ALLOW_RESTORE=YES npm run restore -- ./backups/<timestamp>
```

Only use restore when intentionally replacing the database contents.

Keep disaster-recovery backups outside the bot server as well.

## Database and migration notes

The bot runs data migrations during startup before logging in to Discord.

The migration layer handles:

- v4 score reconciliation
- Race Pass guild-safe indexing
- Membership guild-safe indexing
- Legacy score preservation through ledger adjustments
- Season standing reconstruction

The current migration service contains both v4 reconciliation logic and subsequent guild-safety migrations.

Do not manually delete or modify production MongoDB collections unless you understand the consequences for:

- predictions
- results
- point transactions
- season standings
- memberships
- Race Passes
- payment verification
- feedback sessions/responses

## Project structure

```text
src/
├── commands/                 Discord slash commands
├── config/                   F1 calendar, Race Passes, payment configuration
├── database/
│   ├── models/               Mongoose models
│   └── connection.js         MongoDB connection
├── events/
│   ├── ready.js              Startup/ready handling
│   ├── interactionCreate.js  Discord interaction routing
│   └── userUpdate.js         User update handling
├── services/
│   ├── scoringService.js
│   ├── seasonStandingService.js
│   ├── seasonService.js
│   ├── schedulerService.js
│   ├── membershipService.js
│   ├── racePassService.js
│   ├── purchaseMembershipService.js
│   ├── paymentSheetSyncService.js
│   ├── googleSheetsService.js
│   ├── feedbackService.js
│   └── dataMigrationService.js
├── utils/                    Shared validation, embeds, logging, drivers, etc.
├── deploy-commands.js        Guild slash-command deployment
└── index.js                  Application entry point

scripts/
├── backup.js                 MongoDB BSON backup
└── restore.js                Destructive MongoDB restore
```

## Important operational rules

- Production work for the current migration is on **`fixed-v4-migration`**.
- Do not make production changes directly on `main`.
- Take a database backup before major data migrations or destructive maintenance.
- Run `npm run deploy` after changing slash-command definitions.
- Do not expose Discord tokens, MongoDB credentials, or Google service-account credentials.
- Verify that Discord role hierarchy allows the bot to assign/remove membership roles.
- Confirm the announcement, results, statistics, logs, and DM-log channels are configured correctly.

## Current scoring summary

```text
Race podium:
  3 correct positions = 25 points
  2 correct positions = 18 points
  1 correct position  = 15 points
  0 correct positions = 0 points

Qualifying:
  Correct pole prediction   = 5 points
  Incorrect pole prediction = 0 points

Prediction window:
  Opens  = 24 hours before session
  Closes = 10 minutes before session
```

## Version note

This README describes the implementation currently present on the **`fixed-v4-migration`** branch.

It is intentionally based on the source code rather than older README assumptions, so if the bot's commands, environment variables, scoring rules, or production architecture change, update this document with the same change.
