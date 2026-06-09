# twd-browsers — Design Spec

**Date:** 2026-06-09
**Status:** Approved for planning

## 1. Purpose & Scope

`twd-browsers` is a headless cross-browser test runner for TWD (Test While Developing). It is the **execution + reporting core** of `twd-cli`, ported from Puppeteer to **Playwright** so that TWD tests can run in **Chromium, Firefox, and WebKit in parallel** — closing the gap that `twd-cli` only supports Chromium.

It is intentionally narrow. To keep concerns separate, `twd-browsers` does **not** collect code coverage and does **not** perform API contract testing. Those capabilities remain in `twd-cli`. This package only launches browsers, executes the registered TWD tests, and prints a small per-browser and aggregate report.

- **Location:** new sibling git repo at `/Users/kevinccbsg/brikev/twd-browsers/`
- **Language:** plain ESM JavaScript (no TypeScript, no build step) — mirrors `twd-cli` for ecosystem consistency
- **Published name:** `twd-browsers`

## 2. Package Layout

```
twd-browsers/
  bin/twd-browsers.js      # CLI entry: parse `run`, exit 0/1
  src/
    index.js               # runAll() orchestrator — parallel fan-out over browsers
    runBrowser.js          # single-browser run: launch → goto → evaluate → result
    config.js              # loadConfig() — reads twd.config.json, adds `browsers`
    report.js              # string-returning reporter (ported from twd-js, buffered)
    testSummary.js         # per-browser + aggregate summary lines (ported)
    formatDuration.js      # ported from twd-cli
  tests/                   # vitest, Playwright mocked
  package.json
  CLAUDE.md
  README.md
```

## 3. Configuration (`src/config.js`)

`loadConfig()` reads the **same `twd.config.json`** from `process.cwd()` that `twd-cli` uses, merged over defaults. Coverage and contract keys (`coverage`, `coverageDir`, `nycOutputDir`, `contracts`, `contractReportPath`, `protocolTimeout`, `puppeteerArgs`) are simply ignored if present — existing `twd-cli` users can drop this runner in with zero migration.

Defaults:

```js
const DEFAULT_CONFIG = {
  url: 'http://localhost:5173',
  timeout: 10000,
  headless: true,
  browsers: ['chromium', 'firefox', 'webkit'], // NEW — default full matrix
  launchArgs: [],                              // optional, applied to every browser launch
};
```

Behavior matches `twd-cli/src/config.js`: if the file is missing or unparseable, fall back to defaults (with a warning on parse failure). Unknown keys pass through harmlessly.

## 4. Execution Flow

### `runBrowser(browserType, config)` — `src/runBrowser.js`

Runs a single browser. Mirrors `twd-cli`'s proven flow:

1. `playwright[browserType].launch({ headless: config.headless, args: config.launchArgs })`
2. `const page = await browser.newPage()`
3. `await page.goto(config.url)`
4. `await page.waitForSelector('#twd-sidebar-root', { timeout: config.timeout })`
5. `await page.evaluate(...)` — runs `window.__testRunner` with `onStart`/`onPass`/`onFail`/`onSkip` callbacks that collect `{ id, status, error }` per test. No retry logic (`retryCount`/`retryAttempt` are intentionally omitted). Returns `{ handlers, testStatus }`.
6. Always close the browser (success or failure).
7. Returns a result object: `{ browser: browserType, handlers, testStatus, durationMs, error }` where `error` is set on failure.

Errors are caught inside `runBrowser` so a single browser failure becomes a result, not an exception.

### `runAll()` — `src/index.js`

1. `loadConfig()`.
2. `Promise.allSettled(config.browsers.map((b) => runBrowser(b, config)))` → true parallel execution across all configured browsers.
3. **Per-browser isolation:** one browser launching, crashing, or timing out does not abort the others; its failure is captured and surfaced in the report.
4. **Missing-browser handling:** a launch failure caused by a browser binary not being installed produces a clear, actionable message — `Run "npx playwright install <browser>" to install it.` — and counts the browser as failed.
5. After all settle, print each browser's **buffered** report block sequentially (no interleaving), then the aggregate summary.
6. Return `hasFailures` = (any test has status `fail`) OR (any browser produced an `error`).

## 5. Reporting (`src/report.js` + `src/testSummary.js`)

Because parallel `console.log` interleaves across browsers, the reporter **builds and returns strings** instead of logging directly (this is the key reason `twd-js/runner-ci`'s `reportResults` is **not** reused — it logs straight to `console.log`). The tree-render and summary logic are ported into this package so output stays buffered and self-contained.

Per browser, the report contains:
- The indented pass/fail/skip test tree (ported from `twd-js` `reportResults` render logic).
- A summary line: `Tests: X passed, Y failed, Z skipped (N total) in <duration>` (ported from `twd-cli/src/testSummary.js`).
- A failed-tests block when applicable (ported from `formatFailedTestsBlock`).

Then a final **aggregate** across browsers:

```
Cross-browser summary:
  chromium  ✓  12 passed, 0 failed (3.1s)
  firefox   ✓  12 passed, 0 failed (4.0s)
  webkit    ✗  11 passed, 1 failed (3.8s)
```

A browser that errored (e.g. not installed) shows its error in place of the counts. Exit code is 1 if any row failed or errored.

## 6. CLI (`bin/twd-browsers.js`)

Same shape as `twd-cli/bin/twd-cli.js`:

- `npx twd-browsers run` → `await runAll()` → `process.exit(hasFailures ? 1 : 0)`; on thrown error, exit 1.
- Any other command or no command prints usage and exits (0 for no command, 1 for unknown).
- Config-driven only — no CLI flag overrides (matches `twd-cli`).

## 7. Dependencies & Install

- **`playwright`** (not `playwright-core`) — so `npm install` pulls the browser binaries and the full-matrix default works out of the box.
- **`twd-js`** — `reportResults` is intentionally **not** imported (it logs directly; we need buffered output). `twd-js` is only relevant at runtime *inside the browser* (it provides `window.__testRunner`), which the application under test already bundles. Therefore `twd-browsers` likely needs **no** `twd-js` runtime dependency. This will be confirmed during implementation; if genuinely unused, it is omitted.
- **devDependencies:** `vitest`, `@vitest/coverage-v8` (for the package's own test coverage, mirroring `twd-cli`).
- `engines.node >= 18`, `type: module`.

## 8. Testing

`vitest`, mirroring `twd-cli/tests`:
- Mock `playwright` to test the launch → goto → waitForSelector → evaluate → close flow without real browsers.
- Mock `fs` to test config loading and merge behavior.
- Cover: parallel orchestration via `Promise.allSettled`, fail-if-any exit logic, per-browser isolation (one browser errors, others still report), and the missing-browser actionable message.
- Coverage configured for `src/**/*.js` only.

## 9. Explicitly Out of Scope (YAGNI)

- Code coverage collection (stays in `twd-cli`).
- API contract testing (stays in `twd-cli`).
- CLI flag overrides (`--browser`, `--url`, `--headed`).
- Screenshots, video, or Playwright trace artifacts.
- Test sharding / concurrency limits beyond "all browsers at once".
- Per-test retries (`retryCount` / `retryAttempt`) — not carried over from `twd-cli`.
- Custom or machine-readable (JSON/JUnit) reporters.

These may be added later if a concrete need arises.
