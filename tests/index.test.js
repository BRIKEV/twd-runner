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
