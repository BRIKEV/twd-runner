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
      await page.waitForFunction(
        () => Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
        { timeout: config.timeout }
      );
    }

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
