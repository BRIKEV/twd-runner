import { chromium, firefox, webkit } from 'playwright';

const ENGINES = { chromium, firefox, webkit };

function isMissingBrowserError(error) {
  const message = error && error.message ? error.message : '';
  return /Executable doesn't exist|playwright install/i.test(message);
}

// Wait until the page is ready to run tests: the TWD sidebar is attached and,
// when requested, the service worker is controlling the page.
async function waitForReady(page, config) {
  // Playwright's waitForSelector defaults to state: 'visible'; the TWD sidebar
  // root is in the DOM but starts hidden (collapsed). Wait for it to be attached
  // instead, matching Puppeteer/twd-cli semantics, so headless runs don't time out.
  await page.waitForSelector('#twd-sidebar-root', { timeout: config.timeout, state: 'attached' });

  // Opt-in: wait until a service worker actually CONTROLS the page before running
  // tests. twd-js registers each mock via navigator.serviceWorker.controller?.post-
  // Message(...), which silently drops the rule if the worker isn't controlling yet.
  // Chromium claims control fast; Firefox/WebKit can be late (esp. headless/CI), so
  // mocks registered in that window vanish. Once the worker controls the page it
  // stays in control, so waiting here guarantees every later mockRequest lands.
  if (config.waitForServiceWorker) {
    // waitForFunction's signature is (pageFunction, arg, options). The timeout
    // MUST go in the third (options) slot — passing it second puts it in `arg`,
    // so the option is ignored and the wait silently falls back to Playwright's
    // 30s default. That cap is too low for Firefox/WebKit claiming the SW in
    // headless CI, where they routinely need longer than 30s.
    await page.waitForFunction(
      () => Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
      undefined,
      { timeout: config.timeout }
    );
  }
}

// Drive one tolerant engine through a full page load before the real run so the
// dev server is warm (module graph compiled, optimizeDeps done, SW activated).
// A cold server forces an optimizeDeps reload that races SW registration —
// harmless for Chromium but fatal for Firefox/WebKit. In a sequential run the
// first engine warms the shared server for the rest; parallel/matrix jobs each
// get a cold server, so they need this done explicitly. This runs automatically
// whenever waitForServiceWorker is set — there's no separate option to tune.
// Best-effort: a warm-up failure is logged and never aborts the actual test run.
export async function warmUp(config) {
  // Chromium tolerates the cold-server reload and claims the SW fastest, so it
  // warms reliably for the others. Fall back to the configured engines if it
  // isn't installed (e.g. a firefox-only job without Chromium available).
  const candidates = ['chromium', ...(config.browsers || [])].filter(
    (name, i, all) => ENGINES[name] && all.indexOf(name) === i
  );

  for (const browserType of candidates) {
    const engine = ENGINES[browserType];
    let browser;
    try {
      browser = await engine.launch({ headless: config.headless, args: config.launchArgs });
      const page = await browser.newPage();
      await page.goto(config.url);
      await waitForReady(page, config);
      return { ok: true, browser: browserType };
    } catch (error) {
      // Only try the next candidate when this engine simply isn't installed;
      // any other failure means the server responded, so warming is "done".
      if (!isMissingBrowserError(error)) {
        return { ok: false, browser: browserType, error: error.message };
      }
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  return { ok: false, error: 'No warm-up browser available.' };
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
    await waitForReady(page, config);

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
    // Never let a failing close() mask the result/error we're returning.
    if (browser) await browser.close().catch(() => {});
  }
}
