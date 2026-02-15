# Repository Guidelines

## Project Structure & Module Organization
Source lives under `app/` (route groups, server components, API handlers) and `components/` (client widgets, form controls). Shared logic such as Supabase helpers and input schemas stay in `lib/`. Static assets and icons belong in `public/`, while database policies, edge functions, and seed scripts are grouped under `supabase/`. Unit tests live next to their subjects as `*.test.tsx`, and browser-level scenarios belong in `tests/` so Playwright can discover them automatically.

## Build, Test, and Development Commands
- `pnpm install` – sync dependencies in `package.json` before touching the code.
- `pnpm dev` – launch the Next.js dev server with hot reload at `http://localhost:3000`.
- `pnpm lint` – run `next lint` plus type-checking to catch style and typing regressions.
- `pnpm test` – execute Vitest suites; add `--runInBand` when debugging flaky specs.
- `pnpm build && pnpm start` – create a production bundle and serve it locally.

## Coding Style & Naming Conventions
Use TypeScript, 2-space indentation, and Tailwind utility classes over ad-hoc CSS. Prefer functional React components, `camelCase` variables, `PascalCase` components, and `kebab-case` route segment folders. Keep server-side files in `app/(server)` and mark async functions `use server`. Run `pnpm lint` before committing; it applies ESLint, Prettier, and Stylelint defaults configured in the repo.

## Testing Guidelines
Vitest is the default runner; integration suites rely on Playwright with fixtures in `tests/fixtures`. Name specs after the feature (`workouts-summary.test.tsx`). Cover new Supabase queries with mocked responses and snapshot key UI states. Run `pnpm test --coverage` and ensure statements stay above 85% before opening a PR.

## Commit & Pull Request Guidelines
Commits follow the conventional format `type(scope): message` (e.g., `feat(workouts): add session card`). Keep commits focused and reference tickets such as `RB-123`. Every PR needs a summary, screenshots or GIFs for UI tweaks, migration notes if Supabase schemas change, and a checklist confirming `pnpm lint`, `pnpm test`, and relevant Playwright runs passed.

## Environment & Security Tips
Store Supabase keys and encryption secrets in `.env.local`; never commit them. When sharing runbooks, scrub member data exported from Supabase. PWA metadata sits in `app/manifest.ts`; changes impact browser caching, so bump the version when icons or names shift.
