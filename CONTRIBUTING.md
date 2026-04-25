# Contributing to Gamester

Thank you for your interest in contributing! This document explains how to
contribute to Gamester and the licensing terms that apply.

## License

Gamester is licensed under the
[GNU Affero General Public License v3.0 (AGPL-3.0-only)](LICENSE). By
submitting a contribution (pull request, patch, or any other form), you agree
that your contribution is licensed under the same AGPL-3.0-only license.

## Developer Certificate of Origin (DCO)

All contributors must certify that they have the right to submit their
contribution under the project's license. We use the
[Developer Certificate of Origin (DCO)](https://developercertificate.org/) for
this purpose.

By making a contribution, you certify that:

1. The contribution was created in whole or in part by you, and you have the
   right to submit it under the AGPL-3.0-only license; or
2. The contribution is based on previous work that, to the best of your
   knowledge, is covered under an appropriate open-source license and you have
   the right to submit that work with modifications under the AGPL-3.0-only
   license; or
3. The contribution was provided to you by someone who certified (1) or (2) and
   you have not modified it.

## How to Contribute

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/gamester.git
   cd gamester
   pnpm install
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b my-feature
   ```
4. **Make your changes** — follow the coding standards in the project (TypeScript
   strict mode, ESLint, Prettier).
5. **Run checks** before committing:
   ```bash
   pnpm format
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```
6. **Commit** your changes with a clear message.
7. **Push** to your fork and open a **Pull Request** against the `main` branch.

## Code Style

- TypeScript strict mode with no `any`
- ESLint and Prettier must pass with zero warnings
- Keep files under 400 lines — split large modules into smaller ones

## Reporting Issues

If you find a bug or have a feature request, please
[open an issue](https://github.com/dingelheimer/gamester/issues) on GitHub.
