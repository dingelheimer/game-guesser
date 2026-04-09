# Copilot Instructions for Game Guesser

## Project Overview

Video game timeline guessing party game (Hitster-inspired). Players guess when
games were released by placing cards on a timeline. Built with Next.js (App
Router, TypeScript), Tailwind CSS v4, shadcn/ui, Supabase, and deployed on
Vercel.

## Knowledge Base

This project is managed by the CT-SmartHorseshoe AI Agent Development System.
Always start at the KB entry point and follow links:

@../kb/docs/index.md

## Current Stories

@../kb/projects/game-guesser/stories.md

## Pre-Flight Checks (run before every story)

Before starting any story implementation, run these checks automatically:

1. `git pull` — get latest changes
2. `pnpm install` — ensure dependencies are up to date
3. Check if Docker is running — if yes, verify local Supabase:
   - `supabase status` — check if local Supabase is running
   - If not running: `supabase start`
   - `supabase db reset` — apply all migrations to local DB
4. If Docker is not available, use the remote Supabase workflow (cloud project)
5. `pnpm dev` — verify dev server starts at http://localhost:3000

## Development Workflow

Follow the Next.js + Supabase development workflow from the KB:

@../kb/docs/workflows/development_nextjs_supabase_workflow.md

## Post-Implementation Checklist

After completing code changes, always verify:

1. `pnpm lint` — zero warnings or errors
2. `pnpm typecheck` — zero type errors
3. `pnpm build` — succeeds with no warnings
4. `supabase db reset` — migrations apply cleanly (if schema was changed)
5. `pnpm db:types:local` — regenerate types (if schema was changed)
6. `pnpm test:e2e` — E2E tests pass (if tests exist for affected area)
7. Visual verification via Playwright MCP server (if UI was changed)

## Playwright

Two usage modes:

- **MCP server** — Use the Playwright MCP server to open the running app in a
  real browser and visually verify UI changes after implementation. Always do
  this for stories that touch UI.
- **E2E test suite** — Tests live in `e2e/`. Run with `pnpm test:e2e`. Write
  new E2E tests when a story introduces a new user flow.

See [Playwright E2E Testing](../kb/docs/testing/playwright.md) for details.

## Technology References

Follow the coding standards and technology references from the KB:

- [TypeScript](../kb/docs/technologies/typescript/index.md)
- [Next.js](../kb/docs/technologies/nextjs/index.md)
- [Supabase](../kb/docs/technologies/supabase/index.md)
- [Vercel](../kb/docs/technologies/vercel/index.md)

## Key Rules

- **Never commit secrets** — `.env.local` is gitignored
- **Local-first Supabase** — develop against local Docker instance when available
- **Strict TypeScript** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax` are all enabled
- **RLS on all tables** — every new table must have Row Level Security enabled
- **Follow the ⛔ STOP block** in epic files after completing each story
