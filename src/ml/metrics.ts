/** Métriques d'évaluation pour classification binaire déséquilibrée. Toutes écrites à la main. */

type Pair = readonly [number, number]
const pairs = (s: number[], y: number[]): Pair[] => s.map((v, i) => [v, y[i]] as const)
const byScoreDesc = (a: Pair, b: Pair) => b[0] - a[0]

/** Aire sous la courbe ROC : probabilité qu'un positif soit mieux classé qu'un négatif (égalités = 1/2) */
export function auc(scores: number[], y: number[]): number {
  const idx = pairs(scores, y).sort((a, b) => a[0] - b[0])
  let rankSum = 0
  let pos = 0
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j < idx.length && idx[j][0] === idx[i][0]) j++
    const avgRank = (i + j + 1) / 2
    for (let k = i; k < j; k++) if (idx[k][1] === 1) { rankSum += avgRank; pos++ }
    i = j
  }
  const neg = idx.length - pos
  if (!pos || !neg) return 0.5
  return (rankSum - (pos * (pos + 1)) / 2) / (pos * neg)
}

/** Précision moyenne (aire sous la courbe précision-rappel), métrique principale en classes déséquilibrées */
export function averagePrecision(scores: number[], y: number[]): number {
  const order = pairs(scores, y).sort(byScoreDesc)
  const totalPos = y.reduce((s, v) => s + v, 0)
  if (!totalPos) return 0
  let tp = 0
  let ap = 0
  let k = 0
  while (k < order.length) {
    // les scores égaux sont traités en bloc pour ne pas dépendre de l'ordre
    let j = k
    let blockPos = 0
    while (j < order.length && order[j][0] === order[k][0]) { blockPos += order[j][1]; j++ }
    tp += blockPos
    ap += (blockPos / totalPos) * (tp / j)
    k = j
  }
  return ap
}

export function rocCurve(scores: number[], y: number[], points = 60): { x: number; y: number }[] {
  const pos = y.filter((v) => v === 1).length || 1
  const neg = y.length - pos || 1
  const order = pairs(scores, y).sort(byScoreDesc)
  const out = [{ x: 0, y: 0 }]
  let tp = 0
  let fp = 0
  const step = Math.max(1, Math.floor(order.length / points))
  order.forEach(([, l], k) => {
    if (l === 1) tp++
    else fp++
    if ((k + 1) % step === 0 || k === order.length - 1) out.push({ x: fp / neg, y: tp / pos })
  })
  return out
}

/** Courbe précision (y) en fonction du rappel (x) */
export function prCurve(scores: number[], y: number[], points = 60): { x: number; y: number }[] {
  const totalPos = y.filter((v) => v === 1).length || 1
  const order = pairs(scores, y).sort(byScoreDesc)
  const out: { x: number; y: number }[] = []
  let tp = 0
  const step = Math.max(1, Math.floor(order.length / points))
  order.forEach(([, l], k) => {
    if (l === 1) tp++
    if ((k + 1) % step === 0 || k === order.length - 1) out.push({ x: tp / totalPos, y: tp / (k + 1) })
  })
  return out
}

export function logLoss(p: number[], y: number[]): number {
  const eps = 1e-9
  return -p.reduce((s, pi, i) => s + (y[i] ? Math.log(pi + eps) : Math.log(1 - pi + eps)), 0) / (p.length || 1)
}

/** Score de Brier : erreur quadratique moyenne des probabilités (0 = parfait) */
export function brier(p: number[], y: number[]): number {
  return p.reduce((s, pi, i) => s + (pi - y[i]) ** 2, 0) / (p.length || 1)
}

/** Précision parmi les k donateurs les mieux classés (« les 50 premiers noms ») */
export function precisionAtK(scores: number[], y: number[], k = 50): number {
  const top = pairs(scores, y).sort(byScoreDesc).slice(0, Math.min(k, scores.length))
  return top.length ? top.filter(([, l]) => l === 1).length / top.length : 0
}

/** Lift et rappel sur la fraction la mieux classée */
export function topFraction(scores: number[], y: number[], frac = 0.1): { precision: number; lift: number; recall: number } {
  const n = Math.max(1, Math.round(scores.length * frac))
  const top = pairs(scores, y).sort(byScoreDesc).slice(0, n)
  const hits = top.filter(([, l]) => l === 1).length
  const totalPos = y.filter((v) => v === 1).length
  const base = totalPos / (y.length || 1)
  return { precision: hits / n, lift: base ? hits / n / base : 0, recall: totalPos ? hits / totalPos : 0 }
}

/** Courbe de gain cumulé : part des positifs captés en contactant x % des donateurs */
export function gainCurve(scores: number[], y: number[], points = 20): { x: number; y: number }[] {
  const totalPos = y.filter((v) => v === 1).length || 1
  const order = pairs(scores, y).sort(byScoreDesc)
  const out = [{ x: 0, y: 0 }]
  let tp = 0
  let next = 1
  order.forEach(([, l], k) => {
    if (l === 1) tp++
    if ((k + 1) / order.length >= next / points) {
      out.push({ x: (k + 1) / order.length, y: tp / totalPos })
      next++
    }
  })
  return out
}

export function confusion(p: number[], y: number[], threshold: number) {
  let tp = 0, fp = 0, tn = 0, fn = 0
  p.forEach((pi, i) => {
    if (pi >= threshold) {
      if (y[i]) tp++
      else fp++
    } else if (y[i]) fn++
    else tn++
  })
  return { tp, fp, tn, fn, precision: tp / (tp + fp || 1), recall: tp / (tp + fn || 1) }
}

/** Calibration : probabilité moyenne prédite vs taux observé par décile */
export function calibration(p: number[], y: number[], bins = 10): { predicted: number; observed: number; n: number }[] {
  const order = pairs(p, y).sort((a, b) => a[0] - b[0])
  const size = Math.ceil(order.length / bins)
  const out = []
  for (let b = 0; b < bins; b++) {
    const chunk = order.slice(b * size, (b + 1) * size)
    if (!chunk.length) continue
    out.push({
      predicted: chunk.reduce((s, [pi]) => s + pi, 0) / chunk.length,
      observed: chunk.reduce((s, [, yi]) => s + yi, 0) / chunk.length,
      n: chunk.length,
    })
  }
  return out
}

/**
 * IC à 95 % de l'ÉCART de métrique entre deux classements (A − B), par bootstrap apparié :
 * les deux classements sont évalués sur les mêmes rééchantillons du même jeu de test.
 * Plus juste que comparer deux IC séparés (trop conservateur).
 */
export function bootstrapDiffCI(
  metric: (s: number[], y: number[]) => number,
  a: number[],
  b: number[],
  y: number[],
  rounds = 200,
  seed = 13,
): [number, number] {
  let st = seed >>> 0
  const rand = () => {
    st = (st + 0x6d2b79f5) >>> 0
    let t = st
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const n = y.length
  const diffs: number[] = []
  for (let r = 0; r < rounds; r++) {
    const sa = new Array<number>(n)
    const sb = new Array<number>(n)
    const yy = new Array<number>(n)
    for (let i = 0; i < n; i++) {
      const k = Math.floor(rand() * n)
      sa[i] = a[k]
      sb[i] = b[k]
      yy[i] = y[k]
    }
    diffs.push(metric(sa, yy) - metric(sb, yy))
  }
  diffs.sort((x, z) => x - z)
  return [diffs[Math.floor(rounds * 0.025)], diffs[Math.ceil(rounds * 0.975) - 1]]
}

/** Intervalle de confiance à 95 % par bootstrap (rééchantillonnage avec remise du jeu de test) */
export function bootstrapCI(
  metric: (s: number[], y: number[]) => number,
  scores: number[],
  y: number[],
  rounds = 200,
  seed = 7,
): [number, number] {
  let a = seed >>> 0
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const n = scores.length
  const values: number[] = []
  for (let r = 0; r < rounds; r++) {
    const s = new Array<number>(n)
    const yy = new Array<number>(n)
    for (let i = 0; i < n; i++) {
      const k = Math.floor(rand() * n)
      s[i] = scores[k]
      yy[i] = y[k]
    }
    values.push(metric(s, yy))
  }
  values.sort((x, z) => x - z)
  return [values[Math.floor(rounds * 0.025)], values[Math.ceil(rounds * 0.975) - 1]]
}
