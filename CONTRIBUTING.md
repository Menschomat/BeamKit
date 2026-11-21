# Contributing to BeamKit

Use Node 24 and npm. Run `npm ci`, then `npm run dev`. Run `npm run check`, `npm test`, and `npm run build` before opening a pull request. Update the lockfile with intentional dependency changes. Keep generated builds, private CAD assets and secrets out of Git.

1. Start from an up-to-date `main` and create a focused branch such as `feat/rectangular-mount`, `fix/stl-scale`, or `docs/fit-guide`.
2. Make small, coherent [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), for example `feat(geometry): add rounded aperture`. Use an imperative description. Flag breaking changes with `!` and explain the migration in the commit body.
3. Open a pull request describing user-visible behavior, test evidence and any physical fit assumptions. For geometry changes, include dimensions and slicer or print results when available.
4. Once hosted on GitHub, require passing CI and review before merging to protected `main`. Use Conventional Commit titles if squash merging.

Use millimetres in the generator. Keep the renderer, printer exports and geometry separate. Add tests for fit-sensitive dimensions, malformed projects, and geometry failures. Report which browser, slicer and physical checks you performed. Review dependency licenses and record the source of lamp measurements before adding a profile.
