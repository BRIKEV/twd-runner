# twd-browsers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `twd-browsers`, a Playwright-based headless runner that executes TWD tests across Chromium, Firefox, and WebKit in parallel and prints a per-browser + aggregate report.

**Architecture:** Plain ESM JavaScript, mirroring `twd-cli`'s structure. A thin CLI (`bin/`) calls `runAll()` (`src/index.js`), which loads `twd.config.json`, fans out one `runBrowser()` call per configured browser via `Promise.allSettled` (true parallel, per-browser isolation), then prints each browser's buffered report block followed by a cross-browser summary. No coverage, no contract testing, no retries.

**Tech Stack:** Node.js (>=18), ESM, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-09-twd-browsers-design.md`

**Working directory:** `/Users/kevinccbsg/brikev/twd-browsers/` (already a git repo containing only the spec under `docs/`).

---

## File Structure

```
twd-browsers/
  bin/twd-browsers.js      # CLI entry: parse `run`, exit 0/1
  src/
    colors.js              # ANSI color helpers (green/red/yellow)
    formatDuration.js      # ms → "M:SS.mmm" (ported from twd-cli)
    config.js              # loadConfig() — reads twd.config.json + DEFAULT_CONFIG
    testSummary.js         # formatTestSummary, formatFailedTestsBlock (ported)
    report.js              # renderTestTree, formatBrowserReport, formatAggregate, isBrowserFailure
    runBrowser.js          # runBrowser(browserType, config) — single-browser launch→run→result
    index.js               # runAll() — parallel orchestrator
  tests/
    config.test.js
    formatDuration.test.js
    testSummary.test.js
    report.test.js
    runBrowser.test.js
    index.test.js
  vitest.config.js
  package.json
  .gitignore
  README.md
  CLAUDE.md
```

**Dependency direction (leaf → root):** `colors.js`, `formatDuration.js` → `testSummary.js` → `report.js`; `config.js` and `runBrowser.js` are independent; `index.js` composes `config` + `runBrowser` + `report`; `bin/` calls `index`.

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "twd-browsers",
  "version": "0.1.0",
  "description": "Cross-browser test runner for TWD tests using Playwright",
  "type": "module",
  "main": "src/index.js",
  "bin": {
    "twd-browsers": "./bin/twd-browsers.js"
  },
  "scripts": {
    "test": "vitest",
    "test:ci": "vitest --run --coverage",
    "execute:cli": "node ./bin/twd-browsers.js"
  },
  "keywords": [
    "twd",
    "testing",
    "cli",
    "playwright",
    "cross-browser",
    "browser-testing"
  ],
  "author": "",
  "license": "ISC",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['node_modules/**', 'coverage/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'coverage/**',
        'bin/**',
        '**/*.test.js',
        '**/*.spec.js',
      ],
      all: true,
    },
  },
});
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
coverage/
*.log
```

- [ ] **Step 4: Install dependencies**

Run:
```bash
npm install playwright
npm install -D vitest @vitest/coverage-v8
```
Expected: `package.json` now lists `playwright` under `dependencies` and `vitest` + `@vitest/coverage-v8` under `devDependencies`; `package-lock.json` and `node_modules/` created.

- [ ] **Step 5: Install Playwright browser binaries**

Run: `npx playwright install`
Expected: downloads Chromium, Firefox, and WebKit (may take a minute). This is required for the real CLI to launch browsers; tests mock Playwright and don't need it, but install it now.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.js .gitignore
git commit -m "chore: scaffold twd-browsers package"
```

---

## Task 2: `src/colors.js`

**Files:**
- Create: `src/colors.js`
- Test: `tests/colors.test.js`

- [ ] **Step 1: Write the failing test**

`tests/colors.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { green, red, yellow } from '../src/colors.js';

describe('colors', () => {
  it('wraps text in the green ANSI code and resets', () => {
    expect(green('ok')).toBe('\x1b[32mok\x1b[0m');
  });

  it('wraps text in the red ANSI code and resets', () => {
    expect(red('bad')).toBe('\x1b[31mbad\x1b[0m');
  });

  it('wraps text in the yellow ANSI code and resets', () => {
    expect(yellow('meh')).toBe('\x1b[33mmeh\x1b[0m');
  });

  it('coerces non-string input', () => {
    expect(green(3)).toBe('\x1b[32m3\x1b[0m');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/colors.test.js`
Expected: FAIL — `Failed to resolve import "../src/colors.js"`.

- [ ] **Step 3: Write minimal implementation**

`src/colors.js`:
```js
const reset = '\x1b[0m';

export const green = (s) => `\x1b[32m${s}${reset}`;
export const red = (s) => `\x1b[31m${s}${reset}`;
export const yellow = (s) => `\x1b[33m${s}${reset}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/colors.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/colors.js tests/colors.test.js
git commit -m "feat: add ANSI color helpers"
```

---

## Task 3: `src/formatDuration.js`

**Files:**
- Create: `src/formatDuration.js`
- Test: `tests/formatDuration.test.js`

- [ ] **Step 1: Write the failing test**

`tests/formatDuration.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { formatDuration } from '../src/formatDuration.js';

describe('formatDuration', () => {
  it('formats sub-second durations', () => {
    expect(formatDuration(345)).toBe('0:00.345');
  });

  it('formats seconds with zero-padding', () => {
    expect(formatDuration(3100)).toBe('0:03.100');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(65000)).toBe('1:05.000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/formatDuration.test.js`
Expected: FAIL — cannot resolve `../src/formatDuration.js`.

- [ ] **Step 3: Write minimal implementation**

`src/formatDuration.js` (ported verbatim from `twd-cli/src/formatDuration.js`):
```js
export function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/formatDuration.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/formatDuration.js tests/formatDuration.test.js
git commit -m "feat: add formatDuration helper"
```

---

## Task 4: `src/config.js`

**Files:**
- Create: `src/config.js`
- Test: `tests/config.test.js`

- [ ] **Step 1: Write the failing test**

`tests/config.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

const DEFAULTS = {
  url: 'http://localhost:5173',
  timeout: 10000,
  headless: true,
  browsers: ['chromium', 'firefox', 'webkit'],
  launchArgs: [],
};

describe('loadConfig', () => {
  const mockCwd = '/mock/project';
  const originalCwd = process.cwd;

  beforeEach(() => {
    process.cwd = vi.fn(() => mockCwd);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  it('returns defaults when no config file exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const config = loadConfig();

    expect(config).toEqual(DEFAULTS);
    expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(mockCwd, 'twd.config.json'));
  });

  it('merges user config over defaults', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ url: 'http://localhost:3000', headless: false })
    );

    const config = loadConfig();

    expect(config).toEqual({
      ...DEFAULTS,
      url: 'http://localhost:3000',
      headless: false,
    });
  });

  it('lets the user override the browsers list', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ browsers: ['firefox', 'webkit'] })
    );

    const config = loadConfig();

    expect(config.browsers).toEqual(['firefox', 'webkit']);
    expect(config.url).toBe('http://localhost:5173');
  });

  it('ignores coverage/contract keys without error', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ coverage: true, contracts: [{ source: './x.json' }], timeout: 20000 })
    );

    const config = loadConfig();

    // Unknown keys pass through harmlessly; known keys still merge.
    expect(config.timeout).toBe(20000);
    expect(config.coverage).toBe(true);
    expect(config.browsers).toEqual(['chromium', 'firefox', 'webkit']);
  });

  it('returns defaults and warns when JSON is invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');

    const config = loadConfig();

    expect(config).toEqual(DEFAULTS);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Could not parse twd.config.json'),
      expect.any(String)
    );
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/config.test.js`
Expected: FAIL — cannot resolve `../src/config.js`.

- [ ] **Step 3: Write minimal implementation**

`src/config.js`:
```js
import fs from 'fs';
import path from 'path';

const DEFAULT_CONFIG = {
  url: 'http://localhost:5173',
  timeout: 10000,
  headless: true,
  browsers: ['chromium', 'firefox', 'webkit'],
  launchArgs: [],
};

export function loadConfig() {
  const configPath = path.resolve(process.cwd(), 'twd.config.json');

  if (fs.existsSync(configPath)) {
    try {
      const configFile = fs.readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(configFile);
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch (error) {
      console.warn('Warning: Could not parse twd.config.json, using defaults:', error.message);
      return DEFAULT_CONFIG;
    }
  }

  return DEFAULT_CONFIG;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/config.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "feat: add config loader with browsers field"
```

---

## Task 5: `src/testSummary.js`

**Files:**
- Create: `src/testSummary.js`
- Test: `tests/testSummary.test.js`

- [ ] **Step 1: Write the failing test**

`tests/testSummary.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { formatTestSummary, formatFailedTestsBlock } from '../src/testSummary.js';

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('formatTestSummary', () => {
  it('counts pass/fail/skip and appends duration', () => {
    const testStatus = [
      { id: '1', status: 'pass' },
      { id: '2', status: 'fail', error: 'boom' },
      { id: '3', status: 'skip' },
    ];

    const line = stripAnsi(formatTestSummary({ testStatus, durationMs: 3100 }));

    expect(line).toBe('Tests: 1 passed, 1 failed, 1 skipped (3 total) in 0:03.100');
  });
});

describe('formatFailedTestsBlock', () => {
  it('returns null when there are no failures', () => {
    const testStatus = [{ id: '1', status: 'pass' }];
    expect(formatFailedTestsBlock({ testStatus, handlers: [] })).toBeNull();
  });

  it('lists failed test names resolved from handlers', () => {
    const testStatus = [
      { id: '1', status: 'pass' },
      { id: '2', status: 'fail', error: 'boom' },
    ];
    const handlers = [
      { id: '1', name: 'renders', type: 'test' },
      { id: '2', name: 'submits form', type: 'test' },
    ];

    const block = stripAnsi(formatFailedTestsBlock({ testStatus, handlers }));

    expect(block).toContain('Failed tests:');
    expect(block).toContain('submits form');
    expect(block).not.toContain('renders');
  });

  it('falls back to the id when no handler matches', () => {
    const testStatus = [{ id: 'orphan', status: 'fail', error: 'x' }];
    const block = stripAnsi(formatFailedTestsBlock({ testStatus, handlers: [] }));
    expect(block).toContain('orphan');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/testSummary.test.js`
Expected: FAIL — cannot resolve `../src/testSummary.js`.

- [ ] **Step 3: Write minimal implementation**

`src/testSummary.js` (ported from `twd-cli/src/testSummary.js`, using shared `colors.js`):
```js
import { green, red, yellow } from './colors.js';
import { formatDuration } from './formatDuration.js';

export function formatTestSummary({ testStatus, durationMs }) {
  const passed = testStatus.filter((t) => t.status === 'pass').length;
  const failed = testStatus.filter((t) => t.status === 'fail').length;
  const skipped = testStatus.filter((t) => t.status === 'skip').length;
  const total = testStatus.length;

  const passedStr = `${green(passed)} passed`;
  const failedStr = `${failed > 0 ? red(failed) : '0'} failed`;
  const skippedStr = `${skipped > 0 ? yellow(skipped) : '0'} skipped`;

  return `Tests: ${passedStr}, ${failedStr}, ${skippedStr} (${total} total) in ${formatDuration(durationMs)}`;
}

export function formatFailedTestsBlock({ testStatus, handlers }) {
  const failures = testStatus.filter((t) => t.status === 'fail');
  if (failures.length === 0) return null;

  const handlersById = new Map(handlers.map((h) => [h.id, h]));
  const lines = ['Failed tests:'];
  for (const failure of failures) {
    const handler = handlersById.get(failure.id);
    const name = handler ? handler.name : failure.id;
    lines.push(`  ${red('✗')} ${name}`);
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/testSummary.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/testSummary.js tests/testSummary.test.js
git commit -m "feat: add per-browser test summary formatters"
```

---

## Task 6: `src/report.js`

**Files:**
- Create: `src/report.js`
- Test: `tests/report.test.js`

This module owns: the indented test tree (`renderTestTree`, ported from `twd-js/runner-ci`'s renderer but string-returning), the per-browser report block (`formatBrowserReport`), the cross-browser aggregate (`formatAggregate`), and the failure predicate shared with the orchestrator (`isBrowserFailure`).

**Result object shape** (produced by `runBrowser` in Task 7, consumed here):
```
{ browser: string, handlers: Handler[], testStatus: TestResult[], durationMs: number, error?: string }
```
where `Handler = { id, name, type, parent?, children? }` and `TestResult = { id, status: 'pass'|'fail'|'skip', error? }`.

- [ ] **Step 1: Write the failing test**

`tests/report.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  renderTestTree,
  formatBrowserReport,
  formatAggregate,
  isBrowserFailure,
} from '../src/report.js';

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

const handlers = [
  { id: 's1', name: 'Login suite', type: 'suite', children: ['t1', 't2'] },
  { id: 't1', name: 'renders', type: 'test', parent: 's1' },
  { id: 't2', name: 'submits', type: 'test', parent: 's1' },
];

describe('renderTestTree', () => {
  it('renders suites unmarked and tests with status marks + indentation', () => {
    const testStatus = [
      { id: 't1', status: 'pass' },
      { id: 't2', status: 'fail', error: 'boom' },
    ];

    const tree = stripAnsi(renderTestTree(handlers, testStatus));
    const lines = tree.split('\n');

    expect(lines[0]).toBe('Login suite');
    expect(lines[1]).toBe('  ✓ renders');
    expect(lines[2]).toBe('  ✗ submits');
    expect(lines[3]).toBe('   - Error: boom');
  });

  it('marks skipped tests with ○', () => {
    const testStatus = [{ id: 't1', status: 'skip' }, { id: 't2', status: 'skip' }];
    const tree = stripAnsi(renderTestTree(handlers, testStatus));
    expect(tree).toContain('○ renders');
  });
});

describe('isBrowserFailure', () => {
  it('is true when the result carries an error', () => {
    expect(isBrowserFailure({ error: 'nope', testStatus: [] })).toBe(true);
  });

  it('is true when any test failed', () => {
    expect(isBrowserFailure({ testStatus: [{ id: '1', status: 'fail' }] })).toBe(true);
  });

  it('is false when all tests passed and no error', () => {
    expect(isBrowserFailure({ testStatus: [{ id: '1', status: 'pass' }] })).toBe(false);
  });
});

describe('formatBrowserReport', () => {
  it('includes a header, tree, and summary line for a normal run', () => {
    const result = {
      browser: 'chromium',
      handlers,
      testStatus: [{ id: 't1', status: 'pass' }, { id: 't2', status: 'pass' }],
      durationMs: 3100,
    };

    const out = stripAnsi(formatBrowserReport(result));

    expect(out).toContain('=== chromium ===');
    expect(out).toContain('✓ renders');
    expect(out).toContain('Tests: 2 passed, 0 failed, 0 skipped (2 total) in 0:03.100');
  });

  it('renders the error message instead of a tree when the browser errored', () => {
    const result = {
      browser: 'firefox',
      handlers: [],
      testStatus: [],
      durationMs: 0,
      error: 'Browser "firefox" is not installed.',
    };

    const out = stripAnsi(formatBrowserReport(result));

    expect(out).toContain('=== firefox ===');
    expect(out).toContain('Browser "firefox" is not installed.');
    expect(out).not.toContain('Tests:');
  });
});

describe('formatAggregate', () => {
  it('prints one aligned row per browser with pass/fail counts', () => {
    const results = [
      { browser: 'chromium', testStatus: [{ id: '1', status: 'pass' }], durationMs: 3100 },
      {
        browser: 'webkit',
        testStatus: [{ id: '1', status: 'pass' }, { id: '2', status: 'fail' }],
        durationMs: 3800,
      },
    ];

    const out = stripAnsi(formatAggregate(results));

    expect(out).toContain('Cross-browser summary:');
    expect(out).toContain('chromium  ✓  1 passed, 0 failed (0:03.100)');
    expect(out).toContain('webkit    ✗  1 passed, 1 failed (0:03.800)');
  });

  it('shows the error text for an errored browser', () => {
    const results = [
      { browser: 'firefox', testStatus: [], durationMs: 0, error: 'not installed' },
    ];

    const out = stripAnsi(formatAggregate(results));

    expect(out).toContain('firefox  ✗  not installed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/report.test.js`
Expected: FAIL — cannot resolve `../src/report.js`.

- [ ] **Step 3: Write minimal implementation**

`src/report.js`:
```js
import { green, red, yellow } from './colors.js';
import { formatTestSummary, formatFailedTestsBlock } from './testSummary.js';
import { formatDuration } from './formatDuration.js';

export function renderTestTree(handlers, testStatus) {
  const roots = handlers.filter((h) => !h.parent);
  const lines = [];

  const walk = (node, depth = 0) => {
    const indent = '  '.repeat(depth);
    const result = testStatus.find((t) => t.id === node.id);
    let mark = '';
    let errorLine = '';

    if (node.type !== 'suite') {
      if (result?.status === 'pass') {
        mark = green('✓');
      } else if (result?.status === 'fail') {
        mark = red('✗');
        errorLine = ` - Error: ${result.error}`;
      } else {
        mark = yellow('○');
      }
    }

    lines.push(node.type === 'suite' ? `${indent}${node.name}` : `${indent}${mark} ${node.name}`);
    if (errorLine) lines.push(red(`${indent}${errorLine}`));

    if (node.children) {
      for (const childId of node.children) {
        const child = handlers.find((h) => h.id === childId);
        if (child) walk(child, depth + 1);
      }
    }
  };

  for (const root of roots) walk(root);
  return lines.join('\n');
}

export function isBrowserFailure(result) {
  return Boolean(result.error) || result.testStatus.some((t) => t.status === 'fail');
}

export function formatBrowserReport(result) {
  const header = `\n=== ${result.browser} ===`;

  if (result.error) {
    return `${header}\n${red(result.error)}`;
  }

  const parts = [
    header,
    renderTestTree(result.handlers, result.testStatus),
    formatTestSummary({ testStatus: result.testStatus, durationMs: result.durationMs }),
  ];

  const failedBlock = formatFailedTestsBlock({
    testStatus: result.testStatus,
    handlers: result.handlers,
  });
  if (failedBlock) parts.push(failedBlock);

  return parts.join('\n');
}

export function formatAggregate(results) {
  const width = Math.max(...results.map((r) => r.browser.length));
  const lines = ['Cross-browser summary:'];

  for (const result of results) {
    const name = result.browser.padEnd(width);

    if (result.error) {
      lines.push(`  ${name}  ${red('✗')}  ${result.error}`);
      continue;
    }

    const passed = result.testStatus.filter((t) => t.status === 'pass').length;
    const failed = result.testStatus.filter((t) => t.status === 'fail').length;
    const mark = failed > 0 ? red('✗') : green('✓');
    lines.push(`  ${name}  ${mark}  ${passed} passed, ${failed} failed (${formatDuration(result.durationMs)})`);
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/report.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/report.js tests/report.test.js
git commit -m "feat: add buffered tree + aggregate report formatters"
```

---

## Task 7: `src/runBrowser.js`

**Files:**
- Create: `src/runBrowser.js`
- Test: `tests/runBrowser.test.js`

Single-browser flow: resolve the Playwright engine by name, launch, navigate, wait for `#twd-sidebar-root`, run `window.__testRunner` inside `page.evaluate`, and always close the browser. All errors are caught and converted into a result object with an `error` string (so the orchestrator never sees a throw). A missing-browser launch error becomes an actionable `npx playwright install` message.

- [ ] **Step 1: Write the failing test**

`tests/runBrowser.test.js`:
```js
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('playwright', () => ({
  chromium: { launch: vi.fn() },
  firefox: { launch: vi.fn() },
  webkit: { launch: vi.fn() },
}));

import { chromium, firefox } from 'playwright';
import { runBrowser } from '../src/runBrowser.js';

const config = {
  url: 'http://localhost:5173',
  timeout: 10000,
  headless: true,
  launchArgs: [],
};

function mockPage(evaluateResult) {
  return {
    goto: vi.fn(),
    waitForSelector: vi.fn(),
    evaluate: vi.fn().mockResolvedValue(evaluateResult),
  };
}

function mockBrowser(page) {
  return {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn(),
  };
}

describe('runBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('launches with headless + launchArgs and returns handlers/testStatus', async () => {
    const handlers = [{ id: '1', name: 't', type: 'test' }];
    const testStatus = [{ id: '1', status: 'pass' }];
    const page = mockPage({ handlers, testStatus });
    const browser = mockBrowser(page);
    vi.mocked(chromium.launch).mockResolvedValue(browser);

    const result = await runBrowser('chromium', { ...config, launchArgs: ['--x'] });

    expect(chromium.launch).toHaveBeenCalledWith({ headless: true, args: ['--x'] });
    expect(page.goto).toHaveBeenCalledWith('http://localhost:5173');
    expect(page.waitForSelector).toHaveBeenCalledWith('#twd-sidebar-root', { timeout: 10000 });
    expect(result.browser).toBe('chromium');
    expect(result.handlers).toEqual(handlers);
    expect(result.testStatus).toEqual(testStatus);
    expect(typeof result.durationMs).toBe('number');
    expect(result.error).toBeUndefined();
    expect(browser.close).toHaveBeenCalled();
  });

  it('closes the browser and returns an error result when navigation fails', async () => {
    const page = mockPage({});
    page.waitForSelector = vi.fn().mockRejectedValue(new Error('selector timeout'));
    const browser = mockBrowser(page);
    vi.mocked(chromium.launch).mockResolvedValue(browser);

    const result = await runBrowser('chromium', config);

    expect(result.error).toBe('selector timeout');
    expect(result.testStatus).toEqual([]);
    expect(browser.close).toHaveBeenCalled();
  });

  it('returns an install hint when the browser binary is missing', async () => {
    vi.mocked(firefox.launch).mockRejectedValue(
      new Error("browserType.launch: Executable doesn't exist at /path/to/firefox")
    );

    const result = await runBrowser('firefox', config);

    expect(result.error).toBe(
      'Browser "firefox" is not installed. Run "npx playwright install firefox" to install it.'
    );
  });

  it('returns an error for an unknown browser name', async () => {
    const result = await runBrowser('safari', config);

    expect(result.error).toContain('Unknown browser "safari"');
    expect(result.handlers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/runBrowser.test.js`
Expected: FAIL — cannot resolve `../src/runBrowser.js`.

- [ ] **Step 3: Write minimal implementation**

`src/runBrowser.js`:
```js
import { chromium, firefox, webkit } from 'playwright';

const ENGINES = { chromium, firefox, webkit };

function isMissingBrowserError(error) {
  const message = error && error.message ? error.message : '';
  return /Executable doesn't exist|playwright install/i.test(message);
}

export async function runBrowser(browserType, config) {
  const engine = ENGINES[browserType];
  const startedAt = Date.now();

  if (!engine) {
    return {
      browser: browserType,
      handlers: [],
      testStatus: [],
      durationMs: 0,
      error: `Unknown browser "${browserType}". Supported browsers: chromium, firefox, webkit.`,
    };
  }

  let browser;
  try {
    browser = await engine.launch({ headless: config.headless, args: config.launchArgs });
    const page = await browser.newPage();

    await page.goto(config.url);
    await page.waitForSelector('#twd-sidebar-root', { timeout: config.timeout });

    const { handlers, testStatus } = await page.evaluate(async () => {
      const TestRunner = window.__testRunner;
      const testStatus = [];
      const runner = new TestRunner({
        onStart: (test) => {
          test.status = 'running';
        },
        onPass: (test) => {
          test.status = 'done';
          testStatus.push({ id: test.id, status: 'pass' });
        },
        onFail: (test, err) => {
          test.status = 'done';
          testStatus.push({
            id: test.id,
            status: 'fail',
            error: `${err.message} (at ${window.location.href})`,
          });
        },
        onSkip: (test) => {
          test.status = 'done';
          testStatus.push({ id: test.id, status: 'skip' });
        },
      });
      const handlers = await runner.runAll();
      return { handlers: Array.from(handlers.values()), testStatus };
    });

    return {
      browser: browserType,
      handlers,
      testStatus,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = isMissingBrowserError(error)
      ? `Browser "${browserType}" is not installed. Run "npx playwright install ${browserType}" to install it.`
      : error.message;
    return {
      browser: browserType,
      handlers: [],
      testStatus: [],
      durationMs: Date.now() - startedAt,
      error: message,
    };
  } finally {
    if (browser) await browser.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/runBrowser.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/runBrowser.js tests/runBrowser.test.js
git commit -m "feat: add single-browser Playwright runner"
```

---

## Task 8: `src/index.js` (orchestrator)

**Files:**
- Create: `src/index.js`
- Test: `tests/index.test.js`

`runAll()` loads config, runs every configured browser in parallel via `Promise.allSettled` (so one rejection can't abort the others), normalizes any rejected promise into an error result, prints each browser's buffered report then the aggregate, and returns `hasFailures`.

- [ ] **Step 1: Write the failing test**

`tests/index.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/config.js', () => ({ loadConfig: vi.fn() }));
vi.mock('../src/runBrowser.js', () => ({ runBrowser: vi.fn() }));

import { runAll } from '../src/index.js';
import { loadConfig } from '../src/config.js';
import { runBrowser } from '../src/runBrowser.js';

describe('runAll', () => {
  let logSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(loadConfig).mockReturnValue({
      url: 'http://localhost:5173',
      timeout: 10000,
      headless: true,
      browsers: ['chromium', 'firefox'],
      launchArgs: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs every configured browser', async () => {
    vi.mocked(runBrowser).mockResolvedValue({
      browser: 'x',
      handlers: [],
      testStatus: [{ id: '1', status: 'pass' }],
      durationMs: 1,
    });

    await runAll();

    expect(runBrowser).toHaveBeenCalledTimes(2);
    expect(runBrowser).toHaveBeenCalledWith('chromium', expect.any(Object));
    expect(runBrowser).toHaveBeenCalledWith('firefox', expect.any(Object));
  });

  it('returns false when all browsers pass', async () => {
    vi.mocked(runBrowser).mockResolvedValue({
      browser: 'x',
      handlers: [],
      testStatus: [{ id: '1', status: 'pass' }],
      durationMs: 1,
    });

    expect(await runAll()).toBe(false);
  });

  it('returns true when any browser has a failed test', async () => {
    vi.mocked(runBrowser)
      .mockResolvedValueOnce({ browser: 'chromium', handlers: [], testStatus: [{ id: '1', status: 'pass' }], durationMs: 1 })
      .mockResolvedValueOnce({ browser: 'firefox', handlers: [], testStatus: [{ id: '1', status: 'fail', error: 'x' }], durationMs: 1 });

    expect(await runAll()).toBe(true);
  });

  it('isolates a thrown browser into an error result and still returns true', async () => {
    vi.mocked(runBrowser)
      .mockResolvedValueOnce({ browser: 'chromium', handlers: [], testStatus: [{ id: '1', status: 'pass' }], durationMs: 1 })
      .mockRejectedValueOnce(new Error('catastrophic launch crash'));

    const result = await runAll();

    expect(result).toBe(true);
    const printed = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(printed).toContain('catastrophic launch crash');
    expect(printed).toContain('Cross-browser summary:');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/index.test.js`
Expected: FAIL — cannot resolve `../src/index.js`.

- [ ] **Step 3: Write minimal implementation**

`src/index.js`:
```js
import { loadConfig } from './config.js';
import { runBrowser } from './runBrowser.js';
import { formatBrowserReport, formatAggregate, isBrowserFailure } from './report.js';

export async function runAll() {
  const config = loadConfig();

  console.log('Starting TWD cross-browser test runner...');
  console.log('Configuration:', JSON.stringify(config, null, 2));

  const settled = await Promise.allSettled(
    config.browsers.map((browserType) => runBrowser(browserType, config))
  );

  const results = settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') return outcome.value;
    const reason = outcome.reason;
    return {
      browser: config.browsers[index],
      handlers: [],
      testStatus: [],
      durationMs: 0,
      error: reason && reason.message ? reason.message : String(reason),
    };
  });

  for (const result of results) {
    console.log(formatBrowserReport(result));
  }

  console.log('');
  console.log(formatAggregate(results));

  return results.some(isBrowserFailure);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/index.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/index.js tests/index.test.js
git commit -m "feat: add parallel cross-browser orchestrator"
```

---

## Task 9: `bin/twd-browsers.js` (CLI)

**Files:**
- Create: `bin/twd-browsers.js`

The CLI is excluded from coverage (matching `twd-cli`) and verified manually, since exercising it means importing the orchestrator which needs real config/browsers.

- [ ] **Step 1: Create the CLI entry**

`bin/twd-browsers.js`:
```js
#!/usr/bin/env node

import { runAll } from '../src/index.js';

const command = process.argv[2];

if (command === 'run') {
  try {
    const hasFailures = await runAll();
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
} else {
  console.log(`
twd-browsers - Cross-browser test runner for TWD tests (Playwright)

Usage:
  npx twd-browsers run    Run all tests across the configured browsers

Options:
  Create a twd.config.json file in your project root to customize settings.
  Set "browsers": ["chromium", "firefox", "webkit"] to choose which browsers run.
  `);
  process.exit(command ? 1 : 0);
}
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x bin/twd-browsers.js`

- [ ] **Step 3: Verify the usage path (no command)**

Run: `node ./bin/twd-browsers.js; echo "exit=$?"`
Expected: prints the usage block, `exit=0`.

- [ ] **Step 4: Verify the unknown-command path**

Run: `node ./bin/twd-browsers.js bogus; echo "exit=$?"`
Expected: prints the usage block, `exit=1`.

- [ ] **Step 5: Commit**

```bash
git add bin/twd-browsers.js
git commit -m "feat: add twd-browsers CLI entry point"
```

---

## Task 10: Docs + full suite + CLAUDE.md

**Files:**
- Create: `README.md`
- Create: `CLAUDE.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# twd-browsers

Cross-browser headless test runner for [TWD](https://www.npmjs.com/package/twd-js) tests, built on Playwright. Runs your in-browser TWD tests across **Chromium, Firefox, and WebKit in parallel** and reports per-browser and aggregate results.

It is the cross-browser sibling of `twd-cli`. Unlike `twd-cli`, it does **not** collect code coverage or run API contract testing — it focuses purely on executing tests in every major browser engine.

## Install

```bash
npm install -D twd-browsers
npx playwright install
```

## Usage

Start your dev server (with the TWD sidebar mounted), then:

```bash
npx twd-browsers run
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
```

- [ ] **Step 2: Write `CLAUDE.md`**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

twd-browsers is a CLI tool for running TWD (Test While Developing) browser-based tests across Chromium, Firefox, and WebKit using Playwright. It is the cross-browser sibling of `twd-cli`: same in-browser execution model, but multi-engine and parallel, with **no code coverage and no contract testing** (those stay in `twd-cli`).

## Commands

- `npm test` — Run tests in watch mode (vitest)
- `npm run test:ci` — Run tests once with V8 coverage
- `npm run execute:cli` — Run the CLI locally (`node ./bin/twd-browsers.js`)
- `npx twd-browsers run` — Run TWD tests across configured browsers (user-facing)
- `npx playwright install` — Install browser binaries (required before first real run)

## Architecture

ESM-only Node.js CLI:

- **`bin/twd-browsers.js`** — CLI entry. Parses `run`, calls `runAll()`, exits 0 (pass) / 1 (failure).
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
```

- [ ] **Step 3: Run the full test suite with coverage**

Run: `npm run test:ci`
Expected: ALL tests pass (colors, formatDuration, config, testSummary, report, runBrowser, index). `src/` coverage is high (every `src` file except none excluded; `bin/` is excluded by config).

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add README and CLAUDE.md"
```

---

## Final Verification (manual, optional but recommended)

Run the real CLI against a live TWD app to confirm end-to-end behavior beyond the mocked tests:

- [ ] Start a TWD example app dev server (e.g. from `../twd-react-router-example`, `npm run dev`).
- [ ] In `twd-browsers`, run: `node ./bin/twd-browsers.js run`
- [ ] Confirm: three `=== <browser> ===` report blocks appear, followed by a `Cross-browser summary:` table, and the process exits `0` when all pass.
- [ ] Temporarily point `browsers` at an uninstalled engine (or rename its binary) and confirm the `npx playwright install <browser>` hint appears and exit code is `1`.

---

## Notes for the implementer

- **No retries.** Unlike `twd-cli`, there is intentionally no `retryCount`/`retryAttempt`. Do not port that logic.
- **Buffered output is the point.** `report.js` returns strings; only `index.js` and `bin/` call `console.log`. This prevents interleaving when browsers run in parallel. Do not reintroduce `console.log` inside `report.js`/`testSummary.js`.
- **Errors never throw past `runBrowser`.** Every failure mode becomes `result.error`. `runAll` additionally guards against unexpected throws with `Promise.allSettled`.
- **`twd-js` is not imported.** Its `runner-ci` reporter logs directly to the console; we deliberately ported a string-returning equivalent instead.
```

