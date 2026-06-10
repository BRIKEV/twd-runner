import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

const DEFAULTS = {
  url: 'http://localhost:5173',
  timeout: 10000,
  headless: true,
  browsers: ['chromium', 'firefox', 'webkit'],
  launchArgs: [],
  concurrency: 0,
};

describe('loadConfig', () => {
  const mockCwd = '/mock/project';
  const originalCwd = process.cwd;

  beforeEach(() => {
    process.cwd = vi.fn(() => mockCwd);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  it('returns defaults when no config file exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const config = loadConfig();

    expect(config).toEqual(DEFAULTS);
    expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(mockCwd, 'twd.config.json'));
  });

  it('merges user config over defaults', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ url: 'http://localhost:3000', headless: false })
    );

    const config = loadConfig();

    expect(config).toEqual({
      ...DEFAULTS,
      url: 'http://localhost:3000',
      headless: false,
    });
  });

  it('lets the user override the browsers list', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ browsers: ['firefox', 'webkit'] })
    );

    const config = loadConfig();

    expect(config.browsers).toEqual(['firefox', 'webkit']);
    expect(config.url).toBe('http://localhost:5173');
  });

  it('ignores coverage/contract keys without error', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ coverage: true, contracts: [{ source: './x.json' }], timeout: 20000 })
    );

    const config = loadConfig();

    expect(config.timeout).toBe(20000);
    expect(config.coverage).toBe(true);
    expect(config.browsers).toEqual(['chromium', 'firefox', 'webkit']);
  });

  it('returns defaults and warns when JSON is invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');

    const config = loadConfig();

    expect(config).toEqual(DEFAULTS);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Could not parse twd.config.json'),
      expect.any(String)
    );
    warnSpy.mockRestore();
  });
});
