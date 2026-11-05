# LeadBridge Local Operations

> **Status:** Canonical
> **Last verified:** 2026-11-05
> **Scope:** Locally hosted Next.js application and local PostgreSQL instance

## PostgreSQL Configuration

The runtime reads `DATABASE_URL` from the environment. Prisma 7 uses `PrismaPg` from `@prisma/adapter-pg`; the connection URL is a standard PostgreSQL URI, for example:

```text
postgresql://leadbridge:your-local-password@127.0.0.1:5432/leadbridge?schema=public
```

Create the local role and database using your PostgreSQL installation's normal administration process. Keep real credentials in the local `.env` file, which must not be committed. The checked-in `.env.example` contains placeholders only.

The repository does not pin a PostgreSQL server version or install PostgreSQL command-line utilities. Check the local server with `psql --dbname "$DATABASE_URL" --command='SHOW server_version'`. Install `pg_dump`, `pg_restore`, `psql`, and `createdb` from a PostgreSQL client package compatible with that server; using the same major version is the simplest choice.

## Migrations

- `pnpm db:migrate` runs `prisma migrate dev` for local development, including creating migrations.
- `pnpm db:migrate:status` runs `prisma migrate status` and reports migration state without applying migrations.
- `pnpm db:migrate:deploy` runs `prisma migrate deploy` and applies migrations already checked into `prisma/migrations/` without creating a migration.
- `pnpm db:generate` regenerates the Prisma client.

All commands use `DATABASE_URL`. Before applying a deployment migration, confirm that the URL identifies the intended local database and take a verified backup. Do not use `db:migrate` as the deployment apply command. This task did not apply migrations to any database.

## Backup

Use a backup location outside the repository, with access restricted to the application/database operator. Ensure it has enough free disk space and is covered by the local machine's backup protection. PostgreSQL's custom dump format is compressed and can be inspected/restored with `pg_restore`.

```bash
set -a
source .env
set +a
umask 077
backup_dir="$HOME/leadbridge-backups"
mkdir -p "$backup_dir"
backup_file="$backup_dir/leadbridge-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --file="$backup_file" "$DATABASE_URL"
pg_restore --list "$backup_file" >/dev/null
```

The command writes a new dump and checks that its archive table of contents can be read. It does not establish that a restore succeeds. Keep multiple protected copies if this database is business-critical, and periodically perform a restore drill into a disposable database.

## Restore to a Separate Local Database

Restore into a newly created, empty database. Do not point `pg_restore` at the live application database, and do not use `--clean` for this procedure. Restoring can create or replace application data; a recovery onto an existing database requires a maintenance plan and a separate pre-restore backup.

Set the connection values for the local PostgreSQL instance and select a new database name. `createdb` must connect to an existing maintenance database with permission to create databases. The example uses the local role and port from the connection example; adjust them to match the local PostgreSQL installation. The password can be entered at the prompt or supplied using a protected `.pgpass` file.

```bash
export PGHOST=127.0.0.1
export PGPORT=5432
export PGUSER=leadbridge
backup_file="$HOME/leadbridge-backups/leadbridge-YYYYMMDDTHHMMSSZ.dump"
restore_db="leadbridge_restore_check"
createdb --maintenance-db=postgres "$restore_db"
pg_restore --no-owner --no-privileges --dbname="$restore_db" "$backup_file"
```

These commands target the local instance specified by `PGHOST`, `PGPORT`, and `PGUSER`. Confirm those values before running them. If the database name already exists, stop and choose another disposable name; do not drop or overwrite it as part of a routine restore check.

Verify that the restored schema and migration history are present:

```bash
psql --dbname="$restore_db" --command="SELECT current_database(), to_regclass('\"Lead\"') IS NOT NULL AS lead_table_present, to_regclass('\"_prisma_migrations\"') IS NOT NULL AS migration_table_present"
psql --dbname="$restore_db" --command='SELECT count(*) AS lead_count FROM "Lead"'
psql --dbname="$restore_db" --command='SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at'
```

A successful schema/query check is useful but does not replace an application-level restore drill. This runbook has not been exercised against a database in this environment.

## Liveness and Readiness

Once the Next.js server is listening:

```bash
curl --fail --silent --show-error http://127.0.0.1:3000/api/health/live
curl --fail --silent --show-error http://127.0.0.1:3000/api/health/ready
```

`/api/health/live` returns HTTP 200 when the application can answer a request; it does not query dependencies. `/api/health/ready` executes `SELECT 1` through Prisma and returns HTTP 200 when PostgreSQL responds, or HTTP 503 with `{ "status": "not_ready" }` when it does not. Neither response includes connection details or database errors. Both responses disable HTTP caching. These are unauthenticated operational endpoints; keep the app's network exposure appropriate for the internal deployment.

## Local Scheduler

The application does not run a background scheduler loop. A trusted local trigger must call `POST /api/scheduler/trigger`; the route discovers due enabled connectors and runs them sequentially. Admin sessions may trigger a specific connector. Machine calls authenticated with `SCHEDULER_TRIGGER_SECRET` can run due connectors only.

Set a long random `SCHEDULER_TRIGGER_SECRET` in the server environment and arrange for the local host scheduler to invoke the endpoint on a one-minute cadence. The cadence checks for due connectors; each connector's configured schedule controls whether it runs. Example request from the application host:

```bash
curl --fail --silent --show-error --request POST \
  "http://127.0.0.1:3000/api/scheduler/trigger" \
  --header "Authorization: Bearer ${SCHEDULER_TRIGGER_SECRET}"
```

For cron, place the call in a local wrapper script with restricted file permissions and load the secret from the server's protected environment; have cron run that wrapper. Avoid storing the secret directly in a world-readable crontab or repository file. The repository supplies the authenticated endpoint but does not install or configure the host scheduler.
