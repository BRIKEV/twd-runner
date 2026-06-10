import fs from 'fs';
import path from 'path';

const DEFAULT_CONFIG = {
  url: 'http://localhost:5173',
  timeout: 10000,
  headless: true,
  browsers: ['chromium', 'firefox', 'webkit'],
  launchArgs: [],
  concurrency: 0,
  waitForServiceWorker: false,
};

export function loadConfig() {
  const configPath = path.resolve(process.cwd(), 'twd.config.json');

  if (fs.existsSync(configPath)) {
    try {
      const configFile = fs.readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(configFile);
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch (error) {
      console.warn('Warning: Could not parse twd.config.json, using defaults:', error.message);
      return DEFAULT_CONFIG;
    }
  }

  return DEFAULT_CONFIG;
}
