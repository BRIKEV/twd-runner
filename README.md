# twd-runner

Cross-browser headless test runner for [TWD](https://www.npmjs.com/package/twd-js) tests, built on Playwright. Runs your in-browser TWD tests across **Chromium, Firefox, and WebKit in parallel** and reports per-browser and aggregate results.

It is the cross-browser sibling of `twd-cli`. Unlike `twd-cli`, it does **not** collect code coverage or run API contract testing — it focuses purely on executing tests in every major browser engine.

## Install

```bash
npm install -D twd-runner
npx playwright install
```

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

If a configured browser isn't installed, the run prints `npx playwright install <browser>` and exits non-zero.
