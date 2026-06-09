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
