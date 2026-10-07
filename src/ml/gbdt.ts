/**
 * Gradient boosting d'arbres de décision (perte logistique), écrit à la main.
 * - histogrammes : chaque variable est découpée en au plus 32 intervalles (quantiles), ce qui rend l'entraînement rapide ;
 * - sous-échantillonnage des lignes à chaque arbre (boosting stochastique) ;
 * - arrêt précoce sur un jeu de validation pour choisir le nombre d'arbres.
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
  /** Gain cumulé par variable */
  gain: number[]
}

export interface GbdtOptions {
  rounds?: number
  depth?: number
  learningRate?: number
  minLeaf?: number
  bins?: number
  lambda?: number
  subsample?: number
  seed?: number
  /** Jeu de validation pour l'arrêt précoce */
  valX?: number[][]
  valY?: number[]
  patience?: number
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

function quantileEdges(X: number[][], j: number, bins: number): number[] {
  const values = X.map((x) => x[j]).sort((a, b) => a - b)
  const edges: number[] = []
  for (let b = 1; b < bins; b++) {
    const v = values[Math.floor((b * values.length) / bins)]
    if (!edges.length || v > edges[edges.length - 1]) edges.push(v)
  }
  // la dernière borne est exclue : on ne coupe jamais au-dessus du maximum
  return edges.filter((e) => e < values[values.length - 1])
}

/** Index de l'intervalle : x <= edges[b] → b, sinon edges.length */
function binOf(edges: number[], x: number): number {
  let lo = 0
  let hi = edges.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (x <= edges[mid]) hi = mid
    else lo = mid + 1
  }
  return lo
}

function treeValue(node: TreeNode, x: number[]): number {
  while (node.feature !== undefined) node = x[node.feature] <= node.threshold! ? node.left! : node.right!
  return node.value!
}

export function predictGbdtRaw(model: GbdtModel, x: number[], nTrees = model.trees.length): number {
  let z = model.base
  for (let t = 0; t < nTrees; t++) z += model.learningRate * treeValue(model.trees[t], x)
  return z
}

export function predictGbdt(model: GbdtModel, x: number[]): number {
  return sigmoid(predictGbdtRaw(model, x))
}

export function trainGbdt(X: number[][], y: number[], opts: GbdtOptions = {}): GbdtModel & { bestRound: number; valLoss: number[] } {
  const { rounds = 200, depth = 3, learningRate = 0.08, minLeaf = 20, bins = 32, lambda = 1, subsample = 0.8, seed = 1, patience = 25 } = opts
  const n = X.length
  const p = X[0]?.length ?? 0
  const edges = Array.from({ length: p }, (_, j) => quantileEdges(X, j, bins))
  const B = X.map((x) => x.map((v, j) => binOf(edges[j], v)))
  const rate = Math.min(0.99, Math.max(0.01, y.reduce((s, v) => s + v, 0) / n))
  const base = Math.log(rate / (1 - rate))
  const F = new Float64Array(n).fill(base)
  const g = new Float64Array(n)
  const h = new Float64Array(n)
  const gain = new Array(p).fill(0)
  const trees: TreeNode[] = []
  const valF = opts.valX ? new Float64Array(opts.valX.length).fill(base) : null
  const valLoss: number[] = []
  let best = { loss: Infinity, round: 0 }

  let s = seed >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }

  const build = (rows: number[], d: number): TreeNode => {
    let G = 0
    let H = 0
    for (const i of rows) { G += g[i]; H += h[i] }
    const leaf = { value: -G / (H + lambda) }
    if (d === 0 || rows.length < 2 * minLeaf) return leaf
    const parent = (G * G) / (H + lambda)
    let bestSplit = { gain: 1e-6, feature: -1, bin: 0 }
    for (let j = 0; j < p; j++) {
      const nb = edges[j].length + 1
      if (nb < 2) continue
      const hg = new Float64Array(nb)
      const hh = new Float64Array(nb)
      const hc = new Int32Array(nb)
      for (const i of rows) {
        const b = B[i][j]
        hg[b] += g[i]
        hh[b] += h[i]
        hc[b]++
      }
      let GL = 0, HL = 0, nL = 0
      for (let b = 0; b < nb - 1; b++) {
        GL += hg[b]; HL += hh[b]; nL += hc[b]
        const nR = rows.length - nL
        if (nL < minLeaf) continue
        if (nR < minLeaf) break
        const GR = G - GL
        const HR = H - HL
        const score = (GL * GL) / (HL + lambda) + (GR * GR) / (HR + lambda) - parent
        if (score > bestSplit.gain) bestSplit = { gain: score, feature: j, bin: b }
      }
    }
    if (bestSplit.feature < 0) return leaf
    gain[bestSplit.feature] += bestSplit.gain
    const L: number[] = []
    const R: number[] = []
    for (const i of rows) (B[i][bestSplit.feature] <= bestSplit.bin ? L : R).push(i)
    return {
      feature: bestSplit.feature,
      threshold: edges[bestSplit.feature][bestSplit.bin],
      left: build(L, d - 1),
      right: build(R, d - 1),
    }
  }

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n; i++) {
      const pi = sigmoid(F[i])
      g[i] = pi - y[i]
      h[i] = Math.max(pi * (1 - pi), 1e-6)
    }
    const rows: number[] = []
    for (let i = 0; i < n; i++) if (subsample >= 1 || rand() < subsample) rows.push(i)
    const tree = build(rows, depth)
    trees.push(tree)
    for (let i = 0; i < n; i++) F[i] += learningRate * treeValue(tree, X[i])

    if (valF && opts.valX && opts.valY) {
      let loss = 0
      for (let i = 0; i < valF.length; i++) {
        valF[i] += learningRate * treeValue(tree, opts.valX[i])
        const pi = Math.min(1 - 1e-9, Math.max(1e-9, sigmoid(valF[i])))
        loss -= opts.valY[i] ? Math.log(pi) : Math.log(1 - pi)
      }
      loss /= valF.length
      valLoss.push(loss)
      if (loss < best.loss - 1e-6) best = { loss, round: r + 1 }
      else if (r + 1 - best.round >= patience) break
    }
  }
  const bestRound = valF ? best.round : trees.length
  return { base, learningRate, trees: trees.slice(0, bestRound), gain, bestRound, valLoss }
}
