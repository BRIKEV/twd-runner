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
