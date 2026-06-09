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
