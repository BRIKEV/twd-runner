import { describe, it, expect } from 'vitest';
import { green, red, yellow } from '../src/colors.js';

describe('colors', () => {
  it('wraps text in the green ANSI code and resets', () => {
    expect(green('ok')).toBe('\x1b[32mok\x1b[0m');
  });

  it('wraps text in the red ANSI code and resets', () => {
    expect(red('bad')).toBe('\x1b[31mbad\x1b[0m');
  });

  it('wraps text in the yellow ANSI code and resets', () => {
    expect(yellow('meh')).toBe('\x1b[33mmeh\x1b[0m');
  });

  it('coerces non-string input', () => {
    expect(green(3)).toBe('\x1b[32m3\x1b[0m');
  });
});
