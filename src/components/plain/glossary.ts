/** Glossaire en mots simples, pour une responsable des dons sans formation technique. */
export const GLOSSARY = {
  methode: {
    term: 'Méthode habituelle',
    def: 'Le tri classique des collecteurs de fonds : date du dernier don, nombre de dons et montant donné (règle RFM).',
  },
  precision: {
    term: 'Précision pour trouver les bons donateurs',
    def: 'Mesure de 0 à 1 : à quel point les premiers noms de la liste sont les bons. Plus c’est haut, moins on contacte de personnes pour rien (AUC-PR).',
  },
  conditions: {
    term: 'Nos deux conditions',
    def: 'Fidélia n’utilise son modèle que s’il fait nettement mieux que le hasard ET que la méthode habituelle. Sinon, il garde la méthode habituelle.',
  },
  modele: {
    term: 'Modèle qui apprend des dons passés',
    def: 'Un programme qui repère, dans l’historique de vos donateurs, les signes qui précèdent un départ, une hausse ou un retour.',
  },
  jamaisVus: {
    term: 'Donateurs jamais vus',
    def: 'Une partie des donateurs est mise de côté. Le modèle ne les voit pas pendant son apprentissage : on le teste ensuite sur eux, comme un examen.',
  },
  valeurEnJeu: {
    term: 'Valeur en jeu',
    def: 'Pour chaque donateur : la chance que la situation arrive × l’argent concerné sur un an. On additionne pour toute la base.',
  },
  effet: {
    term: 'Effet de l’action',
    def: 'La part des donateurs visés qui changent vraiment d’avis grâce au contact. C’est une hypothèse, à mesurer avec le groupe témoin.',
  },
  temoin: {
    term: 'Mis de côté pour mesurer (groupe témoin)',
    def: 'Quelques donateurs ciblés qu’on ne contacte pas exprès. En comparant leurs dons à ceux des contactés, on mesure le vrai effet.',
  },
  attrition: {
    term: 'Attrition',
    def: 'Un donateur mensuel qui arrête de donner.',
  },
  tauxBase: {
    term: 'Taux de base',
    def: 'La part des donateurs pour qui la situation arrive vraiment. C’est le score qu’on obtiendrait en choisissant au hasard.',
  },
  ic: {
    term: 'Intervalle de confiance (IC 95 %)',
    def: 'La fourchette dans laquelle le vrai résultat se trouve presque sûrement. Calculée en rejouant le test des centaines de fois (bootstrap).',
  },
  brier: {
    term: 'Score de Brier',
    def: 'Mesure si les pourcentages annoncés sont justes. 0 = parfait. Plus c’est bas, mieux c’est.',
  },
} as const

export type GlossaryKey = keyof typeof GLOSSARY
