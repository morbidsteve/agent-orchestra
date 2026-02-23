import { describe, it, expect } from 'vitest';
import { formatDate, formatDuration, formatRelativeTime, formatExecutionId } from './formatters';

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2025-06-15T10:30:00Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

describe('formatDuration', () => {
  it('returns seconds for short durations', () => {
    const start = '2025-01-01T00:00:00Z';
    const end = '2025-01-01T00:00:45Z';
    expect(formatDuration(start, end)).toBe('45s');
  });

  it('returns minutes and seconds', () => {
    const start = '2025-01-01T00:00:00Z';
    const end = '2025-01-01T00:05:30Z';
    expect(formatDuration(start, end)).toBe('5m 30s');
  });

  it('uses current time when end is null', () => {
    const start = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
    const result = formatDuration(start, null);
    expect(result).toMatch(/^2m/);
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for very recent times', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });

  it('returns days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
  });
});

describe('formatExecutionId', () => {
  it('strips exec- prefix and adds #', () => {
    expect(formatExecutionId('exec-001')).toBe('#001');
  });

  it('handles other ids', () => {
    expect(formatExecutionId('exec-123')).toBe('#123');
  });
});
