import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('playwright', () => ({
  chromium: { launch: vi.fn() },
  firefox: { launch: vi.fn() },
  webkit: { launch: vi.fn() },
}));

import { chromium, firefox, webkit } from 'playwright';
import { runBrowser, warmUp } from '../src/runBrowser.js';

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
    waitForFunction: vi.fn(),
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

  it('does not wait for a service worker by default', async () => {
    const page = mockPage({ handlers: [], testStatus: [] });
    const browser = mockBrowser(page);
    vi.mocked(chromium.launch).mockResolvedValue(browser);

    await runBrowser('chromium', config);

    expect(page.waitForFunction).not.toHaveBeenCalled();
  });

  it('waits for the service worker to control the page when waitForServiceWorker is set', async () => {
    const page = mockPage({ handlers: [], testStatus: [] });
    const browser = mockBrowser(page);
    vi.mocked(chromium.launch).mockResolvedValue(browser);

    await runBrowser('chromium', { ...config, waitForServiceWorker: true });

    // timeout must be in the options (third) slot — passing it second lands it in
    // `arg` and Playwright silently uses its 30s default instead of config.timeout.
    expect(page.waitForFunction).toHaveBeenCalledWith(expect.any(Function), undefined, {
      timeout: 10000,
    });
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

describe('warmUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('warms with Chromium and waits for the SW when enabled', async () => {
    const page = mockPage({});
    const browser = mockBrowser(page);
    vi.mocked(chromium.launch).mockResolvedValue(browser);

    const result = await warmUp({
      ...config,
      waitForServiceWorker: true,
      browsers: ['firefox'],
    });

    expect(result).toEqual({ ok: true, browser: 'chromium' });
    expect(chromium.launch).toHaveBeenCalled();
    expect(page.goto).toHaveBeenCalledWith('http://localhost:5173');
    expect(page.waitForSelector).toHaveBeenCalledWith('#twd-sidebar-root', {
      timeout: 10000,
      state: 'attached',
    });
    expect(page.waitForFunction).toHaveBeenCalledWith(expect.any(Function), undefined, {
      timeout: 10000,
    });
    expect(browser.close).toHaveBeenCalled();
  });

  it('falls back to a configured engine when the warm-up browser is not installed', async () => {
    vi.mocked(chromium.launch).mockRejectedValue(
      new Error("browserType.launch: Executable doesn't exist at /path/to/chromium")
    );
    const page = mockPage({});
    const browser = mockBrowser(page);
    vi.mocked(firefox.launch).mockResolvedValue(browser);

    const result = await warmUp({
      ...config,
      browsers: ['firefox', 'webkit'],
    });

    expect(result).toEqual({ ok: true, browser: 'firefox' });
    expect(chromium.launch).toHaveBeenCalled();
    expect(firefox.launch).toHaveBeenCalled();
  });

  it('is best-effort: a non-missing-browser failure returns ok:false without throwing', async () => {
    const page = mockPage({});
    page.waitForSelector = vi.fn().mockRejectedValue(new Error('sidebar never appeared'));
    const browser = mockBrowser(page);
    vi.mocked(chromium.launch).mockResolvedValue(browser);

    const result = await warmUp({ ...config, browsers: ['chromium'] });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('sidebar never appeared');
    expect(browser.close).toHaveBeenCalled();
  });

  it('reports when no warm-up engine is available', async () => {
    vi.mocked(chromium.launch).mockRejectedValue(
      new Error("browserType.launch: Executable doesn't exist at /path/to/chromium")
    );
    vi.mocked(webkit.launch).mockRejectedValue(
      new Error("browserType.launch: Executable doesn't exist at /path/to/webkit")
    );

    const result = await warmUp({ ...config, browsers: ['webkit'] });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('No warm-up browser available.');
  });
});
