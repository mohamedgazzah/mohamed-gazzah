import { describe, expect, it } from 'vitest'
import { bubbleRadius, classBounds, frameAround, mapClasses, stepFor } from '@/lib/choropleth'

describe('state map classes', () => {
  it('gives each value its own class up to five', () => {
    expect(classBounds(0)).toEqual([])
    expect(classBounds(1)).toEqual([1])
    expect(classBounds(3)).toEqual([1, 2, 3])
    expect(classBounds(5)).toEqual([1, 2, 3, 4, 5])
  })

  it('uses round, rising lower bounds on a rough log scale above five', () => {
    expect(classBounds(8)).toEqual([1, 2, 3, 4, 6])
    expect(classBounds(300)).toEqual([1, 4, 10, 40, 100])
    for (const max of [6, 7, 9, 12, 37, 99, 101, 999, 12_345]) {
      const b = classBounds(max)
      expect(b[0]).toBe(1)
      expect(b.length).toBeLessThanOrEqual(5)
      expect(b.every((x, i) => i === 0 || x > b[i - 1]!)).toBe(true)
      expect(b[b.length - 1]!).toBeLessThanOrEqual(max)
    }
  })

  it('labels contiguous ranges that end at the maximum, darkest at the top', () => {
    const classes = mapClasses(300)
    expect(classes.map((c) => c.label)).toEqual(['1–3', '4–9', '10–39', '40–99', '100–300'])
    expect(classes.map((c) => c.step)).toEqual([1, 2, 3, 4, 5])
    expect(mapClasses(1)).toEqual([{ min: 1, max: 1, step: 4, label: '1' }])
    expect(mapClasses(3).map((c) => c.step)).toEqual([1, 3, 5])
  })

  it('puts every value in exactly one class, and zero in none', () => {
    const classes = mapClasses(300)
    expect(stepFor(0, classes)).toBe(0)
    expect(stepFor(1, classes)).toBe(1)
    expect(stepFor(3, classes)).toBe(1)
    expect(stepFor(4, classes)).toBe(2)
    expect(stepFor(99, classes)).toBe(4)
    expect(stepFor(300, classes)).toBe(5)
  })
})

describe('map frame and bubbles', () => {
  it('keeps the map aspect ratio and contains the box with padding', () => {
    const [x, y, w, h] = frameAround([100, 100, 200, 120])
    expect(w / h).toBeCloseTo(975 / 610, 2)
    expect(x).toBeLessThan(100)
    expect(x + w).toBeGreaterThan(200)
    expect(y).toBeLessThan(100)
    expect(y + h).toBeGreaterThan(120)
  })

  it('sizes bubbles by area, with a visible minimum', () => {
    expect(bubbleRadius(0, 10)).toBe(0)
    expect(bubbleRadius(10, 10)).toBe(22)
    expect(bubbleRadius(1, 400)).toBe(5)
    expect(bubbleRadius(25, 100)).toBeCloseTo(11, 5)
  })
})
