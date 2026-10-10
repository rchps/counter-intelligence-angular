import { describe, expect, it } from 'vitest';
import { buildStamp } from './build-info';

describe('buildStamp', () => {
  it('puts the version first, then the date and commit', () => {
    expect(buildStamp({ version: 'v1.4.0', date: '2026-10-09', id: 'c68fb5d' })).toBe(
      'v1.4.0 · 2026-10-09 · c68fb5d',
    );
  });

  it('shows a build between releases as it is, not as the release before it', () => {
    expect(buildStamp({ version: 'v1.4.0-3-gc68fb5d', date: '2026-10-09', id: 'c68fb5d' })).toBe(
      'v1.4.0-3-gc68fb5d · 2026-10-09 · c68fb5d',
    );
  });

  it('leaves the version out when there was no tag to describe', () => {
    expect(buildStamp({ version: null, date: '2026-10-09', id: 'c68fb5d' })).toBe(
      '2026-10-09 · c68fb5d',
    );
  });

  it('says unknown for a build with no stamp at all (ng serve, tests)', () => {
    expect(buildStamp(null)).toBe('unknown');
  });
});
