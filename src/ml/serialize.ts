/**
 * Sérialisation du modèle versionné (src/data/model.json).
 * Les métriques et courbes sont arrondies à 1e-6 pour alléger le fichier. Les paramètres qui servent à prédire
 * (seuils des arbres, poids, moyennes) restent en pleine précision : un seuil d'arbre est une valeur observée
 * dans les données ; arrondi vers le bas, il envoie dans l'autre branche les donateurs situés pile sur le seuil,
 * et les scores de l'application ne correspondent plus à ceux du rapport.
 */
export const MODEL_PARAM_KEYS = new Set(['logistic', 'gbdt', 'rfm', 'rfmModel', 'means'])

export function roundForStorage(value: unknown, digits = 6): unknown {
  const f = 10 ** digits
  const walk = (v: unknown): unknown => {
    if (typeof v === 'number') return Number.isInteger(v) ? v : Math.round(v * f) / f
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, MODEL_PARAM_KEYS.has(k) ? x : walk(x)]))
    return v
  }
  return walk(value)
}
