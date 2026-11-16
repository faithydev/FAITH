# Backups and restore

The live database has no backups of its own (Render's free Postgres keeps none, and it expires
about 30 days after it was created). FAITH makes its own, in two independent ways.

## 1. The API's nightly backup (on by default)

The API backs the database up itself, with nothing outside the app: no GitHub Actions, no
`pg_dump`. Every half hour it checks the newest backup; when that is older than 20 hours it makes
a new one, so there is one a day. Each backup is:

- one consistent snapshot of every table (a single `REPEATABLE READ` transaction),
- streamed through gzip and AES-256-GCM into a temporary file, never held in memory,
- stored in object storage under `backups/app/` (Cloudflare R2 bucket `faith-files` on the live
  site), named `faith-YYYYMMDDTHHMMSSZ.faithbk`,
- kept for `BACKUP_KEEP_DAYS` days (14 by default); the three newest always stay.

Founders (super admins) see the list in **Admin > Settings > Backups**, can make one at once with
**Back up now**, and can download any of them. Every backup made by hand and every download is
written to the audit log.

| Setting (Render > Environment) | Meaning |
| --- | --- |
| `BACKUP_ENABLED` | `true` by default in production; `false` turns the nightly run off |
| `BACKUP_PASSPHRASE` | Optional. The key backups are encrypted with. Without it the key is `APP_ENCRYPTION_KEY` |
| `BACKUP_KEEP_DAYS` | Days to keep backups, 3 to 365, default 14 |

**Keep the key outside Render.** Copy `APP_ENCRYPTION_KEY` (or your `BACKUP_PASSPHRASE`) from
Render's Environment tab into your password manager now. Without it no backup can be opened, and
a restored database also needs `APP_ENCRYPTION_KEY` to read the secrets stored in it (two-factor
keys, webhook secrets). If you set a `BACKUP_PASSPHRASE` later, older backups still need the old
key.

## 2. GitHub Actions (`Database backup` workflow, optional)

A second, independent copy made with `pg_dump` by GitHub. It only runs while GitHub Actions work
for the account (they are currently blocked by a billing issue on the GitHub account). It needs
these repository secrets (**Settings > Secrets and variables > Actions**):

| Secret | Where it comes from |
| --- | --- |
| `BACKUP_DATABASE_URL` | Render > `faith-db` > **Connect** > **External Database URL** |
| `BACKUP_PASSPHRASE` | A long random passphrase you keep in your password manager |
| `R2_ENDPOINT` | The same value as `S3_ENDPOINT` on Render |
| `R2_ACCESS_KEY_ID` | The same value as `S3_ACCESS_KEY_ID` on Render |
| `R2_SECRET_ACCESS_KEY` | The same value as `S3_SECRET_ACCESS_KEY` on Render |

Those files go to `backups/faith-*.dump.enc`. To open one: `openssl enc -d -aes-256-cbc -pbkdf2
-iter 600000 -in <file> -out faith.dump`, then `pg_restore --no-owner --no-privileges --dbname
"$NEW_DATABASE_URL" faith.dump`.

## Restoring an app backup

The restore loads a backup into an **empty** database whose schema is already migrated. It runs
in one transaction: it either completes or changes nothing. The ledger's own checks (balanced
transactions, matching currencies) run on the restored rows, and every foreign key is checked at
the end.

1. Download the backup: Admin > Settings > Backups > **Download** (or from the R2 bucket).
2. Check that the file opens with your key (touches no database):

   ```bash
   APP_ENCRYPTION_KEY='<the key>' node scripts/restore-backup.mjs faith-20261201T030000Z.faithbk --check
   ```

3. Create the new database (for example on Neon) and apply the migrations to it:

   ```bash
   DATABASE_URL='<new database url>' pnpm db:migrate
   ```

4. Load the backup:

   ```bash
   APP_ENCRYPTION_KEY='<the key>' TARGET_DATABASE_URL='<new database url>' node scripts/restore-backup.mjs faith-20261201T030000Z.faithbk
   ```

   Use `BACKUP_PASSPHRASE='<passphrase>'` instead of `APP_ENCRYPTION_KEY` if backups were made
   with one. The script refuses a database that already holds any rows.

5. Point the API at the new database (below) and keep the same `APP_ENCRYPTION_KEY` on Render.

## Moving off Render's free Postgres (before about 9 December 2026)

1. Create the new database (Neon's free plan, or a paid Render Postgres).
2. In Admin > Settings > Backups press **Back up now**, then **Download** the new file.
3. Restore it into the new database (steps 2 to 4 above). Do this while few people use the site:
   anything written after the backup is not in it.
4. In `render.yaml`, replace the `DATABASE_URL` entry's `fromDatabase` block with `sync: false`,
   push, and paste the new connection string on Render (Environment tab). The API restarts on
   the new database; its nightly backups continue there.

## Practise a restore

A backup is only as good as the last restore that worked. Once a month, restore the newest
backup into a scratch database (a Neon branch works) and check that people, orders and products
are there. The automated tests do the same on every run (`database backups` in
`apps/api/test/platform.test.ts`).
