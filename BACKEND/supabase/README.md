# Supabase — KingdomDash Backend

This directory contains all database migrations, seed data (as migration files), and schema documentation for the KingdomDash Supabase backend.

---

## Prerequisites

Install the [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started):

```bash
# macOS / Linux (Homebrew)
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# npm (cross-platform)
npm install -g supabase
```

Verify the installation:

```bash
supabase --version
```

---

## Environment Variables

Before running any CLI commands, ensure the following non-`VITE_` variables are set in your local `.env` file (never committed):

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # CLI migrations and admin operations
SUPABASE_DB_PASSWORD=your-db-password             # Direct database connection (supabase db push)
```

> These keys are **SERVER-SIDE ONLY**. They must never appear in any file processed by Vite, and must never be committed to version control. Only `.env.example` is committed — copy it to `.env.local` for browser variables and `.env` for CLI-only variables.

---

## One-Time Setup

### 1. Authenticate with Supabase

```bash
supabase login
```

This opens a browser window to authenticate your CLI session.

### 2. Link to the hosted project

```bash
supabase link --project-ref <your-project-ref>
```

Find your project ref in the Supabase dashboard URL: `https://supabase.com/dashboard/project/<ref>`.

---

## Local Development

Start the full local Supabase stack (Postgres + Auth + REST + Storage):

```bash
supabase start
```

This applies all migrations in `supabase/migrations/` in ascending filename order and seeds reference data. The local dashboard is available at `http://localhost:54323`.

To stop the local stack:

```bash
supabase stop
```

To reset the local database (re-applies all migrations from scratch — useful for a clean re-seed):

```bash
supabase db reset
```

---

## Deploying to Remote (Production / Staging)

Push all pending migrations to the linked remote project:

```bash
supabase db push
```

> Requires `SUPABASE_DB_PASSWORD` to be set in your environment. Already-applied migrations are skipped — the CLI tracks applied migration history.

---

## TypeScript Type Regeneration

After applying migrations locally, regenerate the TypeScript types from the live schema:

```bash
npm run db:types
```

This runs `supabase gen types typescript --local` and writes the output to `src/types/database.types.ts`. **Never edit `database.types.ts` manually** — it is always overwritten by this command.

Run this command whenever:
- You apply a new migration that adds or modifies tables, columns, or enums
- You pull down changes from a teammate that include new migrations

---

## Directory Structure

```
supabase/
├── migrations/    # Versioned SQL migration files (applied in ascending order)
├── docs/          # Schema documentation (schema.md generated in Task 19)
├── seed/          # Placeholder — seed data lives in a migration file per design
└── README.md      # This file
```

All schema changes must be expressed as new migration files. Never edit the Supabase schema via the Dashboard — the migration history is the source of truth.

---

## Migration File Naming

```
{UTC_TIMESTAMP}_{description}.sql
```

Example: `20260902000001_create_enums.sql`

Migrations are applied in ascending filename order. Each new migration file must have a timestamp greater than all existing files.
