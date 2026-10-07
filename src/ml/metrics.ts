/** Aire sous la courbe ROC (probabilité qu'un positif soit mieux classé qu'un négatif) */
export function auc(scores: number[], y: number[]): number {
  const idx = scores.map((s, i) => [s, y[i]] as const).sort((a, b) => a[0] - b[0])
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

export function rocCurve(scores: number[], y: number[], points = 40): { fpr: number; tpr: number }[] {
  const pos = y.filter((v) => v === 1).length || 1
  const neg = y.length - pos || 1
  const order = scores.map((s, i) => [s, y[i]] as const).sort((a, b) => b[0] - a[0])
  const out = [{ fpr: 0, tpr: 0 }]
  let tp = 0
  let fp = 0
  const step = Math.max(1, Math.floor(order.length / points))
  order.forEach(([, label], k) => {
    if (label === 1) tp++
    else fp++
    if ((k + 1) % step === 0 || k === order.length - 1) out.push({ fpr: fp / neg, tpr: tp / pos })
  })
  return out
}

export function logLoss(p: number[], y: number[]): number {
  const eps = 1e-9
  return -p.reduce((s, pi, i) => s + (y[i] ? Math.log(pi + eps) : Math.log(1 - pi + eps)), 0) / (p.length || 1)
}

/** Part des positifs parmi les k % les mieux scorés, et lift par rapport au hasard */
export function topK(scores: number[], y: number[], frac = 0.1): { precision: number; lift: number; recall: number } {
  const n = Math.max(1, Math.round(scores.length * frac))
  const order = scores.map((s, i) => [s, y[i]] as const).sort((a, b) => b[0] - a[0]).slice(0, n)
  const hits = order.filter(([, l]) => l === 1).length
  const base = y.filter((v) => v === 1).length / (y.length || 1)
  const totalPos = y.filter((v) => v === 1).length || 1
  return { precision: hits / n, lift: base ? hits / n / base : 0, recall: hits / totalPos }
}

/** Calibration : probabilité moyenne prédite vs taux observé par décile */
export function calibration(p: number[], y: number[], bins = 10): { predicted: number; observed: number; n: number }[] {
  const order = p.map((pi, i) => [pi, y[i]] as const).sort((a, b) => a[0] - b[0])
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
