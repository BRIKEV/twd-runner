import { describe, it, expect } from 'vitest';
import { formatDuration } from '../src/formatDuration.js';

describe('formatDuration', () => {
  it('formats sub-second durations', () => {
    expect(formatDuration(345)).toBe('0:00.345');
  });

  it('formats seconds with zero-padding', () => {
    expect(formatDuration(3100)).toBe('0:03.100');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(65000)).toBe('1:05.000');
  });
});
