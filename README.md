# Fidélia

**Démonstration en ligne, sans installation :** https://wtigg.github.io/fidelia/  
**Dépôt :** https://github.com/wtigg/fidelia

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
| AUC-PR réactivation, **vrais donateurs** (KDD Cup 1998) : bat RFM, mais échoue à R1 (0,083 < 0,102) | **0,083** [0,075–0,094] | 0,053 [0,049–0,058] |
| Profit d'une relance réelle avec 20 % des envois (KDD 98) : valide la méthode de classement, pas un modèle déployable (échec à R1) | **2 133 $** | 1 413 $ |
| Condition de déploiement R1 + R2 remplie, 5 jeux générés × 4 modèles | **15 / 20** | |
| Requis de performance R1 à R6 validés par le meilleur candidat (6 requis × 4 modèles) | **17 / 24** (échecs discutés dans le rapport) | |

**Gouvernance.** Un modèle n'est déployé que s'il fait au moins 2 fois mieux que le hasard (R1) et bat la règle RFM de façon significative (R2). Sinon, l'application garde la règle RFM : c'est le cas aujourd'hui pour la hausse du don mensuel. R3 à R6 sont des alertes, à examiner par un humain avant tout usage réel : le passage au mensuel (R6) et la réactivation (R5, R6) en portent une.

**Portée de KDD 98.** KDD 98 valide la méthode sur deux tâches voisines (réactivation d'inactifs, don plus élevé que le dernier). Il ne valide pas le modèle de hausse du mensuel de l'application.

Les implémentations maison donnent des résultats équivalents à scikit-learn (`verification/RESULTATS.md`) : logistique à 0,003 près, boosting à 0,03 près.

## Prérequis

| Outil | Version | Usage |
|---|---|---|
| Node.js et npm | Node 22 ou plus (`engines` du `package.json` ; environnement de l’équipe : Node 24.14) | Application et scripts |
| Python | 3.11 ou plus (environnement de l’équipe : 3.14.3) | Vérification indépendante |
| scikit-learn, pandas, numpy | Environnement de l’équipe : scikit-learn 1.9.0, pandas 3.0.2, numpy 2.4.4 | Vérification ; l'écart « à 0,003 près » peut varier selon la version |
| `curl` et `unzip` | Toute version récente | Téléchargement de KDD Cup 1998 |

```bash
python3 -m pip install -r verification/requirements.txt  # scikit-learn 1.9.0, pandas 3.0.2, numpy 2.4.4
```

## Lancer avec Docker (recommandé)

Seul Docker est requis. Le `Dockerfile` fige la version de Node et installe les dépendances exactes du `package-lock.json` (`npm ci`).

```bash
# Application sur http://localhost:8080
docker build -t fidelia . && docker run --rm -p 8080:80 fidelia

# 24 tests, puis contrôle de reproductibilité (graine 42)
docker build --target eval -t fidelia-eval .
docker run --rm fidelia-eval
```

La cible `eval` lance les 24 tests, réentraîne la graine 42 dans un dossier temporaire et compare le résultat au rapport versionné `reports/synthetique-42.json` (tolérance 1e-9, horodatage et durée ignorés). Message attendu : « Reproductible : rapport graine 42 identique à reports/synthetique-42.json ». Rien n'est écrit dans `reports/`.

Pour régénérer le rapport sur le poste :

```bash
docker run --rm -v "$PWD/reports:/app/reports" fidelia-eval npm run evaluate 42
```

## Lancer sans Docker

```bash
npm ci        # dépendances exactes du package-lock.json
npm test      # 24 tests
npm run dev
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Application en local |
| `npm test` | 24 tests unitaires : métriques, règle RFM, pipeline, requis R1, R2, R6 et gouvernance, CSV, comptes par action |
| `npm run build` | Version de production (`dist/`, compatible GitHub Pages) |
| `npm run check:repro` | Réentraîne la graine 42 dans un dossier temporaire et compare au rapport versionné `reports/synthetique-42.json` (tolérance 1e-9) |
| `npm run check:browser` | Construit le site, ouvre la page Impact dans Chrome sans interface (profil neuf) et compare ses chiffres au bloc `app` de `reports/impact-42.json`. Garde-fou contre les écarts de `Math.log` d'un moteur JavaScript à l'autre (variables arrondies à 12 chiffres dans `src/ml/features.ts`) |
| `npm run train` | Entraîne les 4 modèles et écrit le modèle versionné `src/data/model.json` |
| `npm run evaluate 42 > reports/evaluate-42.txt` | Rapport détaillé : IC, test temporel, courbes d'apprentissage, équité. Écrit aussi `reports/synthetique-42.json` |
| `npm run calibration > reports/calibration.txt` | Compare le jeu synthétique à des taux de rétention publiés |
| `npm run robustness > reports/robustesse.txt` | Rejoue l'évaluation sur 5 jeux générés. Écrit aussi `reports/robustesse.json` |
| `./scripts/download-kdd98.sh` | Télécharge KDD Cup 1998 (37 Mo) dans `data/kdd98/` ; exige `curl` et `unzip` |
| `npm run kdd98 > reports/kdd98.txt` | Validation sur données réelles. Écrit aussi `reports/kdd98.json` |
| `npm run export-rows` | Exporte les exemples et les résultats de Fidélia dans `verification/` |
| `python3 verification/verify_sklearn.py > reports/sklearn.txt` | Vérification contre scikit-learn |

Les fichiers `.txt` de `reports/` sont la sortie console des scripts, redirigée. Les fichiers `.json` sont écrits par les scripts eux-mêmes.

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

## Intégration continue et déploiement sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` s'exécute à chaque push et à chaque pull request. Il lance `npm ci`, le linter, `npm test`, puis `npm run check:repro` (réentraînement graine 42 comparé au rapport versionné, tolérance 1e-9). Il construit ensuite le site, construit les images Docker `web` et `eval`, et exécute l'image `eval`. Il publie enfin le site à chaque push sur `main`. Il faut l'activer dans *Settings → Pages → Source : GitHub Actions*. Sur un dépôt privé, GitHub Pages demande un compte GitHub Pro, Team ou Education.

## Données

- **Aucune donnée réelle d'organisation** n'est utilisée. Le jeu de démonstration est synthétique et calibré : voir la datasheet.
- **KDD Cup 1998** est un jeu public de recherche ; il n'est pas versionné. Conditions d'usage : ne pas nommer l'organisation commanditaire, et prévenir Epsilon en cas de résultats publiés.
