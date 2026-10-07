# Fidélia

**Qui relancer, remercier ou solliciter ?** Outil d'aide à la décision pour les petits OBNL. À partir de l'historique des dons, des modèles d'IA prédisent :
- l'attrition des donateurs mensuels ;
- le passage au don mensuel ;
- la hausse du don ;
- la réactivation des inactifs.

L'outil classe ensuite les donateurs par valeur attendue et prépare des brouillons de courriels. Un humain valide chaque envoi.

Projet d'équipe, TECH60711 *Réalisation d'applications d'IA*, HEC Montréal, automne 2026. Équipe 4 : Geoffrey Carel, Juliette Ponce, Juliette Violon, Paul Soubigou.

## Résultats clés

| | Fidélia | Règle RFM (référence métier) |
|---|---|---|
| AUC-PR attrition, jeu synthétique | **0,243** [0,162–0,377] | 0,091 [0,068–0,139] |
| AUC-PR passage au mensuel, jeu synthétique | **0,113** [0,076–0,195] | 0,043 [0,031–0,080] |
| AUC-PR réactivation, jeu synthétique | **0,123** [0,080–0,241] | 0,039 [0,027–0,060] |
| AUC-PR hausse, jeu synthétique | 0,076 | 0,066 : **règle RFM conservée** |
| AUC-PR réactivation, **vrais donateurs** (KDD Cup 1998) | **0,083** [0,075–0,094] | 0,053 [0,049–0,058] |
| Profit d'une relance réelle avec 20 % des envois (KDD 98) | **2 133 $** | 1 413 $ |
| Écart significatif avec RFM, sur 5 jeux générés × 4 modèles | **15 / 20** | |
| Requis de performance validés (modèle livré) | **17 / 24** (échecs discutés dans le rapport) | |

**Gouvernance.** Un modèle n'est déployé que s'il bat la règle RFM de façon significative. Sinon, l'application garde la règle RFM : c'est le cas aujourd'hui pour « solliciter plus ».

Les implémentations maison donnent des résultats équivalents à scikit-learn (`verification/RESULTATS.md`) : logistique à 0,003 près, boosting à 0,03 près.

## Lancer

```bash
npm install
npm run dev
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Application en local |
| `npm run build` | Version de production (`dist/`, compatible GitHub Pages) |
| `npm run train` | Entraîne les 4 modèles et écrit le modèle versionné `src/data/model.json` |
| `npm run evaluate [graine]` | Rapport détaillé : IC, test temporel, courbes d'apprentissage, équité (`reports/`) |
| `npm run calibration` | Compare le jeu synthétique à des taux de rétention publiés |
| `npm run robustness` | Rejoue l'évaluation sur 5 jeux générés |
| `./scripts/download-kdd98.sh && npm run kdd98` | Validation sur données réelles (KDD Cup 1998, 37 Mo) |
| `npm run export-rows && python3 verification/verify_sklearn.py` | Vérification contre scikit-learn |

## Documentation

- [`docs/RAPPORT.md`](docs/RAPPORT.md) : rapport complet, structuré selon la grille du cours
- [`docs/GRILLE.md`](docs/GRILLE.md) : correspondance entre la grille d'évaluation et le livrable
- [`docs/MODEL_CARD.md`](docs/MODEL_CARD.md) : fiche du modèle
- [`docs/DATASHEET-synthetique.md`](docs/DATASHEET-synthetique.md) et [`docs/DATASHEET-kdd98.md`](docs/DATASHEET-kdd98.md) : datasheets (Gebru et al., 2021)
- [`docs/PRESENTATION.md`](docs/PRESENTATION.md) : affiche et script de démonstration

## Architecture

```
src/
  ml/        variables, régression logistique, gradient boosting, métriques, règle RFM,
             protocole d'expérience, pipeline, worker
  data/      générateur synthétique, modèle versionné (model.json), résultats KDD 98
  lib/       types, impact, requis de performance, qualité des données, courriels, CSV
  state/     état global (scores, campagnes, automatisations, groupe témoin)
  pages/     tableau de bord, recommandations, impact, donateurs, courriels,
             automatisations, modèle IA, données
scripts/     entraînement, évaluation, calibration, robustesse, KDD 98, export
verification/  vérification indépendante avec scikit-learn
docs/        rapport et documentation
```

Tout le calcul tourne dans le navigateur ; aucune donnée ne quitte le poste. Le jeu de démonstration charge un modèle pré-entraîné. Un import CSV déclenche un réentraînement dans un Web Worker.

## Déploiement sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`. Il faut l'activer dans *Settings → Pages → Source : GitHub Actions*. Sur un dépôt privé, GitHub Pages demande un compte GitHub Pro, Team ou Education.

## Données

- **Aucune donnée réelle d'organisation** n'est utilisée. Le jeu de démonstration est synthétique et calibré : voir la datasheet.
- **KDD Cup 1998** est un jeu public de recherche ; il n'est pas versionné. Conditions d'usage : ne pas nommer l'organisation commanditaire, et prévenir Epsilon en cas de résultats publiés.
