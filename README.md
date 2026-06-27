# twd-runner

[![E2E Cross-Browser](https://github.com/BRIKEV/twd-runner/actions/workflows/e2e.yml/badge.svg?branch=main)](https://github.com/BRIKEV/twd-runner/actions/workflows/e2e.yml)

Cross-browser headless test runner for [TWD](https://www.npmjs.com/package/twd-js) tests, built on Playwright. Runs your in-browser TWD tests across **Chromium, Firefox, and WebKit in parallel** and reports per-browser and aggregate results.

It is the cross-browser sibling of `twd-cli`. Unlike `twd-cli`, it does **not** collect code coverage or run API contract testing — it focuses purely on executing tests in every major browser engine.

## Install

```bash
npm install -D twd-runner
npx playwright install
```

`npm install` pulls in the Playwright library but **not** the browser binaries — `npx playwright install` downloads them. Install all three engines (the default): even if you only test Firefox/WebKit, the service-worker warm-up drives a Chromium page load, so Chromium needs to be present.

In CI you don't need the manual step — the [composite action](#github-action) runs `npx playwright install --with-deps` for you.

## Usage

Start your dev server (with the TWD sidebar mounted), then:

```bash
npx twd-runner run
```

Exit code is `0` when every browser passes, `1` if any browser has a failing test or fails to launch.

## Configuration

Reads the same `twd.config.json` as `twd-cli` (coverage/contract keys are ignored). Supported keys:

| Key | Default | Description |
|---|---|---|
| `url` | `http://localhost:5173` | Dev server URL to test against |
| `timeout` | `10000` | ms to wait for `#twd-sidebar-root` |
| `headless` | `true` | Run browsers headless |
| `browsers` | `["chromium","firefox","webkit"]` | Which engines to run, in parallel |
| `launchArgs` | `[]` | Extra args passed to every browser launch |
| `concurrency` | `0` | Max browsers running at once. `0` means all in parallel. Set `1` (sequential) on constrained CI runners, where parallel engines contend for CPU and slow each other down. |
| `waitForServiceWorker` | `false` | Wait for a service worker to control the page before running tests. Enable this for apps that mock requests via a service worker (e.g. MSW): Firefox/WebKit can be slow to take control, and mocks registered before then are silently lost. Leave `false` for apps with no service worker. |

When `waitForServiceWorker` is enabled, the runner first warms the dev server with one throwaway Chromium page load — a cold Vite server forces an optimizeDeps reload on first load that races SW registration, which Chromium shrugs off but Firefox/WebKit time out on (common in CI, where the server starts cold). This is automatic and best-effort: nothing to configure, and a warm-up that can't complete just logs a warning and continues.

If a configured browser isn't installed, the run prints `npx playwright install <browser>` and exits non-zero.

## GitHub Action

This repo ships a reusable composite action that caches the Playwright browsers, installs them, and runs `twd-runner` across the configured engines. Add `twd-runner` to your project's `devDependencies`, start your dev server, then call the action:

```yaml
name: Cross-browser

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  cross-browser:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci

      - name: Start dev server
        run: |
          nohup npm run dev > dev.log 2>&1 &
          npx wait-on http://localhost:5173

      - name: Run TWD tests across browsers
        uses: BRIKEV/twd-runner/.github/actions/run@main
        with:
          working-directory: .   # directory containing twd.config.json (default ".")
```

The action reads `twd.config.json` and runs every engine listed in `browsers` (default: chromium, firefox, webkit), exiting non-zero if any browser has a failing test.

This is just one job — `npx twd-runner run` launches the configured engines in parallel inside a single runner, so the same two steps (start dev server, run the runner) work unchanged on any CI: GitLab, CircleCI, Jenkins, etc. No CI-specific orchestration required.

> **Optional:** on GitHub Actions you *can* fan each engine out into its own matrix job (set `browsers` to a single engine per job) for full per-engine isolation. It's rarely necessary — a single parallel job is simpler and portable — so reach for the matrix only if you specifically want each engine on its own runner.
