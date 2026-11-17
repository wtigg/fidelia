# Présentation du 3 décembre : affiche et démonstration

- **Où et quand :** Atrium Hydro-Québec, 15 h 30 à 18 h 30.
- **Format :** babillard de 72 po × 48 po, 4 juges, 5 à 10 minutes par équipe.
- **Grille orale (15 points) :** clarté 4, arguments 3, usage de l'affiche 3, appréciation globale 5.

## Message en une phrase

**Fidélia dit à une petite équipe qui relancer, remercier ou solliciter en premier, et ne garde l'IA que là où elle fait mieux que la méthode habituelle.**

Vocabulaire à l'oral (zéro jargon) :

| Ne pas dire | Dire |
|---|---|
| AUC-PR | précision pour trouver les bons donateurs |
| règle RFM | méthode habituelle (dernier don, fréquence, montant) |
| R1 et R2 | nos deux conditions pour utiliser le modèle |
| gradient boosting, régression logistique | modèle qui apprend des dons passés |
| IC à 95 %, bootstrap, Brier | seulement si un juge demande : fiche technique (`docs/affiche/Fiche-technique.pdf`) |

## Affiche : structure (paysage, 5 blocs, 220 mots, un seul message)

**Message unique de l'affiche :** *L'IA n'est utilisée que là où elle gagne : 3 listes sur 4.* Notre différence : l'IA seulement si elle bat la méthode habituelle.

**Modèles à suivre :** les exemples du cours, surtout `files/Poster_Exemple 2.pdf` : peu de blocs, gros visuels, beaucoup d'air. Fichier final : `docs/affiche/Affiche-Fidelia.pdf` (48 × 36 po paysage). Source : `docs/affiche/affiche.html` ; aperçu : `docs/affiche/apercu.png`. Régénérer chiffres, graphique, captures recadrées, QR code et PDF depuis `reports/` : `python3 docs/affiche/build_affiche.py` (QR : `pip install segno`, sinon `qr.svg` est réutilisé). Le script affiche le nombre de mots (cible : 150 à 220 ; texte des graphiques non compté).

**Règles :** 5 blocs au plus, aucun paragraphe de plus de 2 lignes, titre ≥ 160 px, chiffres clés ≥ 200 px, texte ≥ 44 px (page de 4608 × 3456 px). Deux couleurs (vert, or) et un neutre ; orange seulement pour « méthode habituelle gardée ».

**Bandeau :** *Fidélia* ; *Qui relancer, remercier ou solliciter ? L'IA répond aux petits OBNL.* ; les 4 noms, HEC Montréal, TECH 60711. Un seul chiffre : *43,3 %* des donateurs seulement redonnent l'année suivante (FEP, 2025).

**Colonne gauche, 1 · Avant :** Sophie débordée. « J'ai 2 heures par semaine pour 4 000 donateurs. Par qui je commence ? »

**Colonne centre, 2 · Avec Fidélia :** 4 étapes (historique des dons → l'IA classe et explique → l'équipe valide → courriel personnalisé), puis la fiche d'un donateur à relancer, en grand, avec le badge rouge **Démo 1** : risque de 35 %, « Relancer (risque d'arrêt) », dons espérés 63 $, et les 3 raisons (dernier don il y a 101 jours, 3 paiements échoués sur 90 jours, donne moins qu'il y a un an). Captures : `fiche-risque.png` et `fiche-raisons.png` (donateur fictif Olivier Gauthier), recadrées en `*-affiche.png`.

**Colonne droite, 3 · Résultat :** titre *L'IA n'est utilisée que là où elle gagne : 3 listes sur 4* et la règle. Petit graphique à 4 barres (précision du modèle ÷ méthode habituelle) : Relancer ×2,7, Proposer le mensuel ×2,6, Réactiver ×3,1 en vert (IA utilisée) ; Solliciter plus ×1,2 en orange (méthode habituelle gardée). Une ligne sur les 18 824 vrais donateurs : l'IA gagne pour le don plus élevé, pas pour la réactivation. Puis *×3* avec le badge **Démo 2** : « de dons à risque ciblés, à effort égal ; 300 contacts parmi 4 000 donateurs fictifs, contre la méthode habituelle » (`reports/impact-42.json`, ×2,98). Enfin les garde-fous avec le badge **Démo 3** : un humain valide chaque envoi, Loi 25, au plus 1 courriel par 30 jours.

**Pied :** coûts (≈ 27 k$ pour la V1 en 2 mois, puis ≈ 28 k$/an), revenus (99 $/mois, rentable vers 35 clients), feuille de route, grand QR « Essayez la démo », une ligne de sources.

**Fiche technique (à poser sur la table) :** `docs/affiche/Fiche-technique.pdf`, 1 page lettre, source `fiche-technique.html`, régénérée par le même script. Elle reprend tout ce qui a quitté l'affiche : canevas d'IA (4 cases), nos deux conditions (R1, R2) avec AUC-PR et intervalles, graphique « L'IA fait-elle mieux ? » (×2,7, ×2,6, ×3,1, ×1,2), ciblage ×4,8 à 100 contacts et ×3 à 300 (×4,9 et ×3,3 contre le hasard), 41 % des dons à risque avec 10 % des mensuels, robustesse 15 sur 20, KDD 98 (réactivation : méthode habituelle gardée ; don plus élevé : R1 et R2 remplies, AUC-PR 0,040 contre 0,019), équité (ratio 1,80, IC 1,51 à 2,10), garde-fous, limites, rentabilité vers 35 clients, références.

## Démonstration : script de 5 minutes avec la visite guidée

Dans l'application, cliquer sur **« Visite guidée »**. Elle enchaîne 6 étapes, une par écran, dans l'ordre ci-dessous (même ordre que `src/components/tour/GuidedTour.tsx`). Pour chaque étape : lire la bulle, dire une phrase, pointer l'affiche, puis « Suivant ». Les badges rouges **Démo 1**, **Démo 2** et **Démo 3** de l'affiche marquent les trois moments à montrer dans l'application.

0. **(20 s) Accroche, avant la visite.** *Affiche : bandeau (43,3 %) et bloc 1 (Sophie).* « Moins d'un donateur sur deux redonne l'année suivante. Or garder un donateur coûte environ 7 fois moins cher que d'en trouver un nouveau. Au Canada, plus de la moitié des organismes de moins de 1 M$ confient leurs données à quelqu'un qui n'a ni formation ni mandat pour ça. Fidélia leur dit par qui commencer, et n'utilise l'IA que là où elle fait mieux que la méthode habituelle. » Cliquer sur « Visite guidée ».
1. **(30 s) Étape 1 : tableau de bord.** *Affiche : bloc 1, Sophie et ses 4 000 donateurs.* « 4 000 donateurs. Voici la valeur des dons mensuels à risque et les priorités du jour. » Lire le montant affiché à l'écran.
2. **(30 s) Étape 2 : recommandations.** *Affiche : bloc 2, les 4 étapes.* « Fidélia dit par où commencer : qui relancer, qui remercier, qui solliciter. Les listes sont classées par dollars à gagner. »
3. **(60 s) Étape 3 : fiche d'un donateur à relancer.** *Affiche : badge **Démo 1**, la fiche du donateur.* Montrer le risque d'arrêter son don, les raisons en mots simples, l'historique sur 24 mois (paiements échoués en rouge). Le donateur de l'affiche est Olivier Gauthier : risque de 35 %, « Relancer », dernier don il y a 101 jours, 3 paiements échoués sur 90 jours. Si la visite ouvre un autre donateur, lire son pourcentage à l'écran ; pour retrouver celui de l'affiche : Donateurs, filtre Mensuel, Olivier Gauthier. « Le modèle explique sa décision. Vous décidez : un clic prépare le courriel. »
4. **(60 s) Étape 4 : impact.** *Affiche : badge **Démo 2**, le ×3.* La visite descend jusqu'au curseur « Donateurs contactés ». Partir de 300 contacts, puis glisser à 100. « À effort égal, Fidélia cible environ 3 fois plus de dons à risque que la méthode habituelle avec 300 contacts, et environ 4,8 fois plus avec 100. Ce sont des donateurs fictifs. » Ces chiffres sont ceux de l'écran (« soit 3,0 fois plus », « soit 4,8 fois plus »), identiques à `reports/impact-42.json` (×2,98 et ×4,76 ; modèle v20261110.0138) ; `npm run check:browser` le vérifie dans Chrome. « On mesure bien le ciblage. L'effet d'un courriel, lui, est une hypothèse, réglable ici. Les donateurs mis de côté le mesureront. »
5. **(60 s) Étape 5 : modèle IA (facultative si le temps manque).** *Affiche : titre et graphique à 4 barres du bloc 3 (3 vertes, 1 orange) ; détail sur la fiche technique.* « Le modèle apprend des dons passés. On ne l'utilise que s'il remplit nos deux conditions : trouver les bons donateurs 2 fois mieux que le hasard, et mieux que la méthode habituelle. » Onglet Hausse du don : « Ici, il ne fait pas mieux, donc l'outil garde la méthode habituelle. » Onglet Données réelles : « Sur 18 824 vrais donateurs, le modèle remplit nos deux conditions pour repérer qui donnera plus que son dernier don, mais pas pour la réactivation : là, on garde la méthode habituelle. Nous le disons. »
6. **(45 s) Étape 6 : lundi matin, les courriels.** *Affiche : badge **Démo 3**, les garde-fous.* La visite ouvre Courriels avec un brouillon prêt. « Le courriel parle de la carte expirée, sans montant inventé. Je relis, j'approuve, j'envoie. Rien ne part sans un humain. »
7. **(30 s) Après la visite : équité.** *Fiche technique : encadré Équité.* « Pour proposer le don mensuel, le modèle choisit 1,8 fois plus souvent les 70 ans et plus. L'âge n'est pas utilisé, mais d'autres indices le reflètent. C'est un écart à surveiller : on le mesure et on le revérifiera sur de vraies données. »
8. **(15 s) Conclusion.** « Simple, mesurable, responsable. Un humain décide toujours. »

Si un juge veut les chiffres techniques : tendre la fiche technique (`Fiche-technique.pdf`), ou le volet « Voir le détail » de l'application.

## Les 5 questions probables des juges

1. **Pourquoi ne pas utiliser ChatGPT ?** ChatGPT écrit bien, mais il ne sait pas qui va partir. Notre modèle apprend des dons passés, donne toujours la même réponse, coûte peu et protège la confidentialité (§4.2).
2. **Vos données sont fausses ?** Oui, par obligation : pas de vraies données d'OBNL. C'est pourquoi on a testé la méthode sur 18 824 vrais donateurs (KDD 98) et sur 5 autres jeux fictifs (§6.2).
3. **Un OBNL de 3 personnes a-t-il assez de données ?** Il faut environ 100 cas par liste (par exemple 100 départs). En dessous, l'outil classe automatiquement avec la méthode habituelle. Avec très peu de cas (moins d'une quinzaine), la liste n'est pas proposée et un message l'explique (§5.4).
4. **Combien ça coûte ?** 99 $ par mois par OBNL. Hébergement : 2,10 à 7 $ par OBNL et par mois. Frais fixes : environ 28 000 $ par an (un quart de poste pour la maintenance et le support). Première version : environ 27 000 $ en 2 mois, car le prototype existe déjà ; 30 000 à 33 000 $ avec une réserve. Puis un pilote de 3 mois. Rentable vers 35 clients.
5. **Comment savoir que ça marche vraiment, et si le modèle se trompe ?** Un humain valide chaque envoi. Un groupe témoin ne reçoit rien : on compare. Chez un seul petit OBNL, il est trop petit pour conclure ; il faut regrouper plusieurs organisations (environ 1 100 à 1 300 témoins, §5.4, §11). En cas de dérive : surveillance et retour à la méthode habituelle (§7).

## Vidéo de secours

Enregistrer la visite guidée et le script ci-dessus en capture d'écran (QuickTime, 1080p), avec voix off. La garder sur un ordinateur et sur une clé USB.
