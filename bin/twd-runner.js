#!/usr/bin/env node

import { runAll } from '../src/index.js';

const command = process.argv[2];

if (command === 'run') {
  try {
    const hasFailures = await runAll();
    // Set exitCode (don't call process.exit) so Node flushes buffered stdout
    // before exiting. process.exit() truncates unflushed output when stdout is
    // a pipe (e.g. CI), which would cut off later browser reports + the summary.
    process.exitCode = hasFailures ? 1 : 0;
  } catch (error) {
    console.error('Error running tests:', error);
    process.exitCode = 1;
  }
} else {
  console.log(`
twd-runner - Cross-browser test runner for TWD tests (Playwright)

Usage:
  npx twd-runner run    Run all tests across the configured browsers

Options:
  Create a twd.config.json file in your project root to customize settings.
  Set "browsers": ["chromium", "firefox", "webkit"] to choose which browsers run.
  `);
  process.exitCode = command ? 1 : 0;
}
