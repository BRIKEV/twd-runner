# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

twd-runner is a CLI tool for running TWD (Test While Developing) browser-based tests across Chromium, Firefox, and WebKit using Playwright. It is the cross-browser sibling of `twd-cli`: same in-browser execution model, but multi-engine and parallel, with **no code coverage and no contract testing** (those stay in `twd-cli`).

## Commands

- `npm test` — Run tests in watch mode (vitest)
- `npm run test:ci` — Run tests once with V8 coverage
- `npm run execute:cli` — Run the CLI locally (`node ./bin/twd-runner.js`)
- `npx twd-runner run` — Run TWD tests across configured browsers (user-facing)
- `npx playwright install` — Install browser binaries (required before first real run)

## Architecture

ESM-only Node.js CLI:

- **`bin/twd-runner.js`** — CLI entry. Parses `run`, calls `runAll()`, exits 0 (pass) / 1 (failure).
- **`src/config.js`** — `loadConfig()` reads `twd.config.json`, merges with defaults (url, timeout, headless, browsers, launchArgs). Coverage/contract keys are ignored.
- **`src/runBrowser.js`** — `runBrowser(browserType, config)` launches one Playwright engine, navigates, waits for `#twd-sidebar-root`, runs `window.__testRunner` in `page.evaluate`, and always closes the browser. Errors (including missing-browser) become an `error` field on the result object instead of throwing.
- **`src/index.js`** — `runAll()` fans out `runBrowser` over `config.browsers` with `Promise.allSettled` (parallel, isolated), prints each browser's buffered report then the aggregate, returns `hasFailures`.
- **`src/report.js`** — `renderTestTree`, `formatBrowserReport`, `formatAggregate`, `isBrowserFailure`. String-returning (not `console.log`) so parallel output doesn't interleave.
- **`src/testSummary.js`, `src/formatDuration.js`, `src/colors.js`** — formatting helpers ported from `twd-cli`.

## Testing

Tests are in `tests/` and use vitest. Playwright and `fs` are mocked. Coverage is configured for `src/**/*.js` only; `bin/` is excluded and verified manually.

## Key Dependencies

- **playwright** — Browser automation across Chromium/Firefox/WebKit.
- **twd-js** — Not a direct dependency. Provides `window.__testRunner` at runtime *inside the app under test*; this package only calls it.
