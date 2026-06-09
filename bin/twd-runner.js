#!/usr/bin/env node

import { runAll } from '../src/index.js';

const command = process.argv[2];

if (command === 'run') {
  try {
    const hasFailures = await runAll();
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
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
  process.exit(command ? 1 : 0);
}
