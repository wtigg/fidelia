# Présentation du 3 décembre : affiche et démonstration

- **Où et quand :** Atrium Hydro-Québec, 15 h 30 à 18 h 30.
- **Format :** babillard de 72 po × 48 po, 4 juges, 5 à 10 minutes par équipe.
- **Grille orale (15 points) :** clarté 4, arguments 3, usage de l'affiche 3, appréciation globale 5.

## Affiche : structure proposée (paysage, 3 colonnes)

**Bandeau :** *Fidélia : qui relancer, remercier ou solliciter.* Sous-titre : *Moins d'un donateur sur deux redonne l'année suivante. Une petite équipe ne peut pas tout lire. L'IA lui dit par où commencer.*

**Colonne 1 : Problème et idée**
- Chiffre choc : 43,3 % de rétention (FEP 2025).
- Persona : responsable des dons d'un OBNL de 3 personnes, 2 heures par semaine.
- Les 4 listes : relancer, proposer le mensuel, solliciter plus, remercier.
- Canevas d'IA en version réduite.

**Colonne 2 : Comment ça marche (centre, la plus grande)**
- Schéma : photo à la date T → 18 variables → 4 modèles → valeur attendue → brouillon → validation humaine → groupe témoin.
- Graphique principal : AUC-PR de Fidélia contre la règle RFM sur les 4 modèles, avec barres d'erreur, et le badge « déployé » ou « RFM conservée ».
- Encadré « Validé sur de vrais donateurs » : KDD 98, +51 % de profit avec 20 % des envois.
- Encadré « Honnêteté » : à gros volume, RFM fait jeu égal ; pour « solliciter plus », RFM est conservée ; deux fuites de données trouvées et corrigées ; prédire n'est pas causer.

**Colonne 3 : Impact et responsabilité**
- Courbe de valeur captée (attrition) : avec 10 % des contacts, 41 % de la valeur captée, contre 7 % pour RFM et 10 % au hasard.
- Garde-fous : un courriel par 30 jours, remerciement d'abord, validation humaine, Loi 25, audit d'équité par âge.
- 3 leçons apprises, en une phrase chacune.
- QR code vers l'application en ligne.

**Pied :** équipe, références clés (Agrawal 2018, Gebru 2021, Suresh et Guttag 2021, Strong 1997), mention « Données synthétiques ; aucune donnée réelle d'organisation ».

## Démonstration : script de 5 minutes

1. **(30 s) Tableau de bord.** « 4 000 donateurs, 8 000 $ de dons mensuels à risque. Voici les priorités du jour. »
2. **(60 s) Fiche d'un donateur à risque.** Ouvrir un donateur « Relancer » avec un paiement échoué. Montrer le risque, les trois raisons, l'historique sur 24 mois (baisse des ouvertures, barre rouge). « Le modèle explique sa décision. »
3. **(45 s) Recommandations, puis courriels.** Préparer les courriels de l'onglet Relancer, en ouvrir un : il mentionne la carte expirée. « Un humain valide toujours. Aucun montant inventé. »
4. **(60 s) Impact.** Faire glisser la capacité de 300 à 100 contacts. « À effort égal, le modèle récupère environ 3 fois plus que la règle RFM. Seul l'effet de l'action est une hypothèse, et on la mesurera avec le groupe témoin. »
5. **(60 s) Modèle IA.** Attrition : 6 requis sur 6, écart significatif avec RFM, courbe précision-rappel. Puis l'onglet Hausse du don : « Ici, le modèle ne bat pas RFM, donc l'outil garde RFM. On ne déploie l'IA que là où elle prouve son utilité. » Enfin, l'onglet Données réelles : « Sur 95 000 vrais donateurs, le modèle bat aussi RFM. »
6. **(30 s) Équité.** « Le modèle classe les aînés plus haut pour les sollicitations. On le mesure et on le limite. »
7. **(15 s) Conclusion.** « Simple, mesurable, responsable. »

**Questions probables des juges**
- *Pourquoi ne pas utiliser ChatGPT ?* Prédiction tabulaire calibrée, reproductibilité, coût, confidentialité (§4.2).
- *Vos données sont fausses ?* Oui, par obligation. C'est pourquoi on a validé sur KDD 98 et testé 5 jeux générés (§6.2, leçon 1).
- *Combien ça coûte ?* Environ 150 à 350 $ par mois d'exploitation pour 50 OBNL (§9).
- *Et si le modèle se trompe ?* Validation humaine, groupe témoin, surveillance, retour arrière (§7).

## Vidéo de secours

Enregistrer le script ci-dessus en capture d'écran (QuickTime, 1080p), avec voix off. La garder sur un ordinateur et sur une clé USB.
