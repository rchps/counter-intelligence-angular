import { describe, expect, it } from 'vitest';
import { balancedLogoHeight } from './logo-size';

describe('balancedLogoHeight', () => {
  it('gives a wider logo less height', () => {
    expect(balancedLogoHeight(400, 100)).toBeLessThan(balancedLogoHeight(200, 100)!);
  });

  it('gives logos of different shapes about the same area', () => {
    const area = (width: number, height: number): number => {
      const shown = balancedLogoHeight(width, height)!;
      return shown * shown * (width / height);
    };
    expect(area(600, 100) / area(200, 100)).toBeCloseTo(1, 1);
  });

  it('caps a square logo at the plate height', () => {
    expect(balancedLogoHeight(300, 300)).toBe(52);
  });

  it('never enlarges an image past its own height', () => {
    expect(balancedLogoHeight(80, 20)).toBe(20);
  });

  it('leaves sizing to the stylesheet when the image has no dimensions', () => {
    expect(balancedLogoHeight(0, 0)).toBeNull();
  });
});
