/**
 * Gradient boosting d'arbres de décision (perte logistique), écrit à la main.
 * Chaque arbre corrige les erreurs des précédents ; les seuils candidats sont des quantiles.
 */
export interface TreeNode {
  feature?: number
  threshold?: number
  left?: TreeNode
  right?: TreeNode
  value?: number
}

export interface GbdtModel {
  base: number
  learningRate: number
  trees: TreeNode[]
  /** Gain cumulé par variable (importance) */
  gain: number[]
}

export interface GbdtOptions {
  rounds?: number
  depth?: number
  learningRate?: number
  minLeaf?: number
  bins?: number
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

function candidateThresholds(X: number[][], j: number, bins: number): number[] {
  const values = [...new Set(X.map((x) => x[j]))].sort((a, b) => a - b)
  if (values.length <= bins) return values.slice(0, -1).map((v, i) => (v + values[i + 1]) / 2)
  const out: number[] = []
  for (let b = 1; b < bins; b++) out.push(values[Math.floor((b * values.length) / bins)])
  return [...new Set(out)]
}

function buildTree(
  X: number[][],
  g: number[],
  h: number[],
  rows: number[],
  depth: number,
  thresholds: number[][],
  minLeaf: number,
  gain: number[],
): TreeNode {
  const lambda = 1
  const G = rows.reduce((s, i) => s + g[i], 0)
  const H = rows.reduce((s, i) => s + h[i], 0)
  const leaf = { value: -G / (H + lambda) }
  if (depth === 0 || rows.length < 2 * minLeaf) return leaf

  const parentScore = (G * G) / (H + lambda)
  let best = { gain: 1e-6, feature: -1, threshold: 0 }
  for (let j = 0; j < thresholds.length; j++) {
    for (const t of thresholds[j]) {
      let GL = 0
      let HL = 0
      let nL = 0
      for (const i of rows) {
        if (X[i][j] <= t) {
          GL += g[i]
          HL += h[i]
          nL++
        }
      }
      const nR = rows.length - nL
      if (nL < minLeaf || nR < minLeaf) continue
      const GR = G - GL
      const HR = H - HL
      const score = (GL * GL) / (HL + lambda) + (GR * GR) / (HR + lambda) - parentScore
      if (score > best.gain) best = { gain: score, feature: j, threshold: t }
    }
  }
  if (best.feature < 0) return leaf
  gain[best.feature] += best.gain
  const L = rows.filter((i) => X[i][best.feature] <= best.threshold)
  const R = rows.filter((i) => X[i][best.feature] > best.threshold)
  return {
    feature: best.feature,
    threshold: best.threshold,
    left: buildTree(X, g, h, L, depth - 1, thresholds, minLeaf, gain),
    right: buildTree(X, g, h, R, depth - 1, thresholds, minLeaf, gain),
  }
}

function treeValue(node: TreeNode, x: number[]): number {
  while (node.feature !== undefined) node = x[node.feature] <= node.threshold! ? node.left! : node.right!
  return node.value!
}

export function trainGbdt(X: number[][], y: number[], opts: GbdtOptions = {}): GbdtModel {
  const { rounds = 80, depth = 3, learningRate = 0.1, minLeaf = 20, bins = 16 } = opts
  const p = X[0]?.length ?? 0
  const rate = Math.min(0.99, Math.max(0.01, y.reduce((s, v) => s + v, 0) / y.length))
  const base = Math.log(rate / (1 - rate))
  const F = new Array(X.length).fill(base)
  const thresholds = Array.from({ length: p }, (_, j) => candidateThresholds(X, j, bins))
  const rows = X.map((_, i) => i)
  const gain = new Array(p).fill(0)
  const trees: TreeNode[] = []
  for (let r = 0; r < rounds; r++) {
    const prob = F.map(sigmoid)
    const g = prob.map((pi, i) => pi - y[i])
    const h = prob.map((pi) => Math.max(pi * (1 - pi), 1e-6))
    const tree = buildTree(X, g, h, rows, depth, thresholds, minLeaf, gain)
    trees.push(tree)
    for (let i = 0; i < X.length; i++) F[i] += learningRate * treeValue(tree, X[i])
  }
  return { base, learningRate, trees, gain }
}

export function predictGbdt(model: GbdtModel, x: number[]): number {
  let z = model.base
  for (const t of model.trees) z += model.learningRate * treeValue(t, x)
  return sigmoid(z)
}
