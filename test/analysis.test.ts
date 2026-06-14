import { describe, it, expect } from 'vitest'
import { mean, stdDev, zNormalize, pearson, resample, median } from '../app/analysis/correlate'

describe('mean / stdDev', () => {
  it('mean of a known set', () => {
    expect(mean([2, 4, 6])).toBeCloseTo(4)
  })
  it('mean of empty is 0', () => {
    expect(mean([])).toBe(0)
  })
  it('stdDev of a constant series is 0', () => {
    expect(stdDev([5, 5, 5, 5])).toBeCloseTo(0)
  })
  it('population stdDev of a known window', () => {
    // population std dev of [2,4,4,4,5,5,7,9] = 2
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 6)
  })
})

describe('zNormalize', () => {
  it('produces mean ~0 and std ~1', () => {
    const z = zNormalize([10, 20, 30, 40, 50])
    expect(mean(z)).toBeCloseTo(0, 10)
    expect(stdDev(z)).toBeCloseTo(1, 10)
  })
  it('maps a flat series to all zeros (no divide-by-zero)', () => {
    expect(zNormalize([7, 7, 7])).toEqual([0, 0, 0])
  })
})

describe('pearson', () => {
  it('identical series correlate at +1', () => {
    expect(pearson([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1)
  })
  it('negated series correlate at -1', () => {
    expect(pearson([1, 2, 3, 4], [-1, -2, -3, -4])).toBeCloseTo(-1)
  })
  it('is invariant to positive scale and offset (level-independent matching)', () => {
    const x = [1, 3, 2, 5, 4]
    const y = x.map((v) => 1000 * v + 50_000) // same shape at a wildly different price level
    expect(pearson(x, y)).toBeCloseTo(1)
  })
  it('returns 0 for a flat series (undefined correlation)', () => {
    expect(pearson([1, 2, 3], [4, 4, 4])).toBe(0)
  })
  it('returns 0 on length mismatch', () => {
    expect(pearson([1, 2, 3], [1, 2])).toBe(0)
  })
})

describe('resample', () => {
  it('returns exactly n points', () => {
    expect(resample([0, 10], 5)).toHaveLength(5)
  })
  it('preserves endpoints', () => {
    const r = resample([2, 9, 4, 7], 10)
    expect(r[0]).toBeCloseTo(2)
    expect(r.at(-1)).toBeCloseTo(7)
  })
  it('keeps a linear ramp linear', () => {
    const r = resample([0, 100], 11) // 0,10,20,...,100
    expect(r[5]).toBeCloseTo(50)
  })
  it('keeps a constant series constant', () => {
    expect(resample([3, 3, 3], 7).every((v) => Math.abs(v - 3) < 1e-9)).toBe(true)
  })
})

describe('median', () => {
  it('odd length', () => {
    expect(median([3, 1, 2])).toBe(2)
  })
  it('even length averages the middle two', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
  it('empty is NaN', () => {
    expect(median([])).toBeNaN()
  })
})
