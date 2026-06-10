import { loadConfig } from './config.js';
import { runBrowser } from './runBrowser.js';
import { formatBrowserReport, formatAggregate, isBrowserFailure } from './report.js';

// Run runBrowser but never throw: any rejection becomes an error result so one
// browser can't abort the others.
async function safeRunBrowser(browserType, config) {
  try {
    return await runBrowser(browserType, config);
  } catch (reason) {
    return {
      browser: browserType,
      handlers: [],
      testStatus: [],
      durationMs: 0,
      error: reason && reason.message ? reason.message : String(reason),
    };
  }
}

// Run browsers with at most `concurrency` in flight, preserving input order in
// the results. concurrency <= 0 means "all at once" (the default).
async function runBrowsers(browsers, config) {
  const limit =
    config.concurrency > 0 ? Math.min(config.concurrency, browsers.length) : browsers.length;
  const results = new Array(browsers.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= browsers.length) return;
      results[index] = await safeRunBrowser(browsers[index], config);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

export async function runAll() {
  const config = loadConfig();

  console.log('Starting TWD cross-browser test runner...');
  console.log('Configuration:', JSON.stringify(config, null, 2));

  const results = await runBrowsers(config.browsers, config);

  for (const result of results) {
    console.log(formatBrowserReport(result));
  }

  console.log('');
  console.log(formatAggregate(results));

  return results.some(isBrowserFailure);
}
