# Fidélia

SaaS pour les associations et ONG : un modèle d'IA prédit quels donateurs vont arrêter leur don, lesquels peuvent passer au don mensuel et lesquels relancer, puis prépare les emails correspondants.

Projet étudiant (cours de développement d'applications IA).

## Fonctionnalités

- **Trois modèles prédictifs**
  - churn des donateurs mensuels à 90 jours
  - passage au don mensuel (ponctuel ou annuel) à 6 mois
  - réactivation des donateurs inactifs à 6 mois
- **Deux algorithmes codés à la main**, sans librairie de ML :
  - régression logistique (descente de gradient Adam + régularisation L2)
  - gradient boosting d'arbres de décision
  L'application compare les deux à une règle métier simple et retient automatiquement le meilleur.
- **Explications** : pour chaque donateur, les variables qui font monter le score (« 2 paiements échoués sur 90 jours », « n'ouvre que 12 % des emails »…).
- **Recommandations** classées par valeur attendue (probabilité × montant annuel).
- **Emails personnalisés** générés à partir de l'action et des raisons. Envoi simulé pour l'instant.
- **Automatisations** : seuil de déclenchement et validation humaine, par type d'action.
- **Page Modèle IA** : courbe ROC, AUC, lift, calibration, importance des variables, hyperparamètres modifiables, simulateur de prédiction.
- **Données** : démo générée (2 000 donateurs sur 36 mois) ou import CSV de vos propres données.

## Comment le modèle apprend

1. **Photo à une date T** : 8 variables par donateur, calculées uniquement avec les données antérieures à T. Variables : récence, nombre et montant des dons sur 12 mois, ancienneté, échecs de paiement, ouverture des emails, tendances. On répète pour plusieurs dates T.
2. **Étiquette** : ce qui s'est réellement passé après T (arrêt, conversion, nouveau don).
3. **Entraînement** sur 80 % des donateurs.
4. **Test** sur les 20 % restants, jamais vus, découpés par donateur pour éviter les fuites.

Les données de démo sont simulées mois par mois avec des variables cachées (attachement, humeur). Le modèle doit les retrouver à partir des seuls signaux observables.

Résultats sur la démo (AUC sur le jeu de test) :

| Modèle | Régression logistique | Gradient boosting | Règle métier |
|---|---|---|---|
| Churn 90 j | 0,74 | 0,71 | 0,55 |
| Conversion 6 mois | 0,78 | 0,78 | 0,65 |
| Réactivation 6 mois | 0,62 | 0,65 | 0,47 |

## Lancer en local

```bash
npm install
npm run dev
```

Évaluer les modèles en ligne de commande :

```bash
npm run evaluate
```

## Déploiement (GitHub Pages)

1. Pousser le dossier sur un dépôt GitHub (branche `main`).
2. Dans le dépôt : *Settings → Pages → Source : GitHub Actions*.
3. Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push.

Tout le calcul (entraînement compris) tourne dans le navigateur, dans un Web Worker. Aucun serveur n'est nécessaire.

## Structure

```
src/
  ml/          features, régression logistique, boosting, métriques, pipeline, worker
  data/        générateur de données de démo
  lib/         types, dates, emails, CSV
  state/       état global (modèles, scores, campagnes, automatisations)
  pages/       tableau de bord, recommandations, donateurs, emails, automatisations, modèle, données
scripts/       évaluation en ligne de commande
```

## Format CSV attendu

- `donateurs.csv` : `id, first_name, last_name, email, city, join_date, kind (monthly|annual|one_time), monthly_amount, churn_date, converted_at, converted_from, email_consent`
- `dons.csv` : `donor_id, date, amount, kind, status (paid|failed)`
- `engagement.csv` (optionnel) : `donor_id, month (AAAA-MM), open_rate`

Le bouton « Modèles de fichiers » de la page Données télécharge des exemples complets.

## Prochaines étapes

- Backend (Supabase) : synchronisation nocturne avec la base de l'association, entraînement planifié.
- Envoi réel des emails (Brevo, Resend…) et suivi des ouvertures.
- Mesure de l'impact par groupe témoin (A/B test sur les relances).
