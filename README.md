# Game Guesser

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

A video game timeline guessing party game inspired by Hitster. Built with Next.js, Supabase, and Vercel.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`scoop install supabase` on Windows)
- A free [Supabase](https://supabase.com/) cloud project

### Setup

```bash
pnpm install
cp .env.local.example .env.local
# Fill in values from Supabase Dashboard → Settings → API
```

Link the Supabase CLI to your remote project:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### Development

```bash
pnpm dev          # Start Next.js dev server at http://localhost:3000
pnpm db:push      # Push migrations to remote Supabase
pnpm db:types     # Regenerate TypeScript types from remote schema
```

### Local Supabase (optional — requires Docker)

If Docker Desktop is available, you can run Supabase locally:

```bash
supabase start          # Start local Postgres, Auth, Realtime
pnpm db:types:local     # Generate types from local database
pnpm db:reset:local     # Reset local DB and regenerate types
```

## CI/CD

A GitHub Actions workflow (`.github/workflows/deploy-supabase.yml`) automatically
applies database migrations and deploys all Supabase Edge Functions whenever
changes to `supabase/migrations/**` or `supabase/functions/**` are pushed to `main`.

### Required secrets

Add these in **GitHub repo → Settings → Secrets and variables → Actions**:

| Secret | Where to find it |
|--------|-----------------|
| `SUPABASE_ACCESS_TOKEN` | [app.supabase.com/account/tokens](https://app.supabase.com/account/tokens) |
| `SUPABASE_PROJECT_ID` | Supabase Dashboard → Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | Supabase Dashboard → Settings → Database → Database password |

The workflow runs the migration step before deploying Edge Functions so that any
new schema is in place before the functions that depend on it go live.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before
submitting a pull request.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
