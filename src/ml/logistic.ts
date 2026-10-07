/**
 * Régression logistique entraînée par descente de gradient (Adam) avec régularisation L2.
 * Écrite à la main : pas de librairie, fonctionne dans le navigateur comme dans une Edge Function.
 */
export interface LogisticModel {
  weights: number[]
  bias: number
  mean: number[]
  std: number[]
}

export interface TrainOptions {
  epochs?: number
  learningRate?: number
  l2?: number
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

export function standardize(X: number[][]): { mean: number[]; std: number[] } {
  const p = X[0]?.length ?? 0
  const mean = new Array(p).fill(0)
  const std = new Array(p).fill(0)
  for (const x of X) for (let j = 0; j < p; j++) mean[j] += x[j] / X.length
  for (const x of X) for (let j = 0; j < p; j++) std[j] += (x[j] - mean[j]) ** 2 / X.length
  return { mean, std: std.map((v) => Math.sqrt(v) || 1) }
}

export function train(X: number[][], y: number[], opts: TrainOptions = {}): LogisticModel {
  const { epochs = 600, learningRate = 0.05, l2 = 0.01 } = opts
  const { mean, std } = standardize(X)
  const Z = X.map((x) => x.map((v, j) => (v - mean[j]) / std[j]))
  const n = Z.length
  const p = mean.length
  const w = new Array(p + 1).fill(0) // w[p] = biais
  const m = new Array(p + 1).fill(0)
  const v = new Array(p + 1).fill(0)
  const b1 = 0.9
  const b2 = 0.999

  for (let epoch = 1; epoch <= epochs; epoch++) {
    const grad = new Array(p + 1).fill(0)
    for (let i = 0; i < n; i++) {
      let z = w[p]
      for (let j = 0; j < p; j++) z += w[j] * Z[i][j]
      const err = sigmoid(z) - y[i]
      for (let j = 0; j < p; j++) grad[j] += (err * Z[i][j]) / n
      grad[p] += err / n
    }
    for (let j = 0; j < p; j++) grad[j] += l2 * w[j]
    for (let j = 0; j <= p; j++) {
      m[j] = b1 * m[j] + (1 - b1) * grad[j]
      v[j] = b2 * v[j] + (1 - b2) * grad[j] ** 2
      const mh = m[j] / (1 - b1 ** epoch)
      const vh = v[j] / (1 - b2 ** epoch)
      w[j] -= (learningRate * mh) / (Math.sqrt(vh) + 1e-8)
    }
  }
  return { weights: w.slice(0, p), bias: w[p], mean, std }
}

/** Contribution de chaque variable au logit (pour expliquer une prédiction) */
export function contributions(model: LogisticModel, x: number[]): number[] {
  return x.map((v, j) => model.weights[j] * ((v - model.mean[j]) / model.std[j]))
}

export function predict(model: LogisticModel, x: number[]): number {
  return sigmoid(model.bias + contributions(model, x).reduce((s, c) => s + c, 0))
}
