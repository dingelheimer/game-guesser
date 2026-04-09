# Game Guesser

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
