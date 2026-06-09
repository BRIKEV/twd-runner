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
    close: vi.fn().mockResolvedValue(undefined),
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
    expect(page.waitForSelector).toHaveBeenCalledWith('#twd-sidebar-root', { timeout: 10000, state: 'attached' });
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

  it('still returns an error result (and does not throw) when close() rejects after a failure', async () => {
    const page = mockPage({});
    page.evaluate = vi.fn().mockRejectedValue(new Error('evaluate blew up'));
    const browser = mockBrowser(page);
    browser.close = vi.fn().mockRejectedValue(new Error('close failed too'));
    vi.mocked(chromium.launch).mockResolvedValue(browser);

    const result = await runBrowser('chromium', config);

    expect(result.error).toBe('evaluate blew up');
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
