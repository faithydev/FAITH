# Backups and restore

The live database has no backups of its own (Render's free Postgres keeps none, and it expires
about 30 days after it was created). The `Database backup` workflow fills that gap: every night
at 03:30 Tashkent time it dumps the database, encrypts the dump and stores it in the private R2
bucket under `backups/`, keeping the last 30 days. Nothing is uploaded to GitHub: this
repository is public.

## Turn it on (once, about 10 minutes)

In GitHub, open the repository, then **Settings > Secrets and variables > Actions > New
repository secret**, and add:

| Secret | Where it comes from |
| --- | --- |
| `BACKUP_DATABASE_URL` | Render > `faith-db` > **Connect** > **External Database URL** |
| `BACKUP_PASSPHRASE` | A long random passphrase you make up. Keep a copy in your password manager: without it no backup can be opened |
| `R2_ENDPOINT` | Cloudflare > R2 > bucket `faith-files` > Settings > S3 API, for example `https://<account id>.r2.cloudflarestorage.com` (the same value as `S3_ENDPOINT` on Render) |
| `R2_ACCESS_KEY_ID` | The R2 API token's access key (the same value as `S3_ACCESS_KEY_ID` on Render, or a new token limited to `faith-files`) |
| `R2_SECRET_ACCESS_KEY` | That token's secret (`S3_SECRET_ACCESS_KEY` on Render) |

Then **Actions > Database backup > Run workflow** once. The run ends with `stored
backups/faith-YYYY-MM-DDTHHMM.dump.enc`; the file is visible in the R2 bucket.

Until the secrets exist the workflow only prints which ones are missing.

## Restore

Restores need the PostgreSQL 18 client tools (`pg_restore`), OpenSSL and the passphrase.

1. Download the newest `backups/faith-*.dump.enc` from the R2 bucket (Cloudflare dashboard >
   R2 > `faith-files` > `backups/` > Download).
2. Decrypt it:

   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in faith-2026-12-01T2230.dump.enc -out faith.dump
   ```

3. Restore into an **empty** database:

   ```bash
   pg_restore --no-owner --no-privileges --dbname "$NEW_DATABASE_URL" faith.dump
   ```

4. Point the API at it: on Render, set `DATABASE_URL` to the new address and deploy. The start
   script applies any newer migrations before the API serves traffic.

## Moving off Render's free Postgres (before about 9 December 2026)

1. Create the new database (Neon's free plan, or a paid Render Postgres).
2. Run **Database backup** by hand, then restore that newest dump into the new database (above).
3. In `render.yaml`, replace the `DATABASE_URL` entry's `fromDatabase` block with `sync: false`,
   push, and paste the new connection string on Render (Environment tab).
4. Update the `BACKUP_DATABASE_URL` secret to the new database, so the nightly backups follow.

## Practise a restore

A backup is only as good as the last restore that worked. Once a month, restore the newest dump
into a scratch database (a Neon branch works) and check that people, orders and products are
there. Write the date in the roadmap's operations section.
