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
