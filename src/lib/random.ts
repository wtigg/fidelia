/** Générateur pseudo-aléatoire déterministe (mulberry32) pour une démo reproductible */
export function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const normal = () => {
    const u = 1 - next()
    const v = next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  return {
    next,
    normal,
    chance: (p: number) => next() < p,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    weighted: <T,>(items: readonly [T, number][]): T => {
      const total = items.reduce((s, [, w]) => s + w, 0)
      let r = next() * total
      for (const [v, w] of items) {
        r -= w
        if (r <= 0) return v
      }
      return items[items.length - 1][0]
    },
  }
}

export type Rng = ReturnType<typeof rng>

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
