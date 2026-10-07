"""
Vérification indépendante avec scikit-learn.

Entraîne les modèles de référence de scikit-learn sur EXACTEMENT les mêmes exemples
et les mêmes découpages entraînement / validation / test que Fidélia, puis compare
l'AUC-PR et l'AUC obtenues. But : montrer que nos implémentations « maison »
(régression logistique, gradient boosting) se comportent comme les implémentations de référence.

Prérequis : python3 -m pip install scikit-learn pandas
Lancement : npm run export-rows && python3 verification/verify_sklearn.py
"""
import json
from pathlib import Path

import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).parent
ours = json.loads((HERE / "fidelia-results.json").read_text())
lines = ["| Modèle | Fidélia logistique | scikit-learn logistique | Fidélia boosting | scikit-learn boosting |", "|---|---|---|---|---|"]

for kind in ["churn", "upgrade", "conversion", "reactivation"]:
    df = pd.read_csv(HERE / f"rows-{kind}.csv")
    features = [c for c in df.columns if c not in ("split", "y")]
    train = df[df.split != "test"]  # entraînement + validation, comme le modèle final de Fidélia
    test = df[df.split == "test"]
    X, y, Xt, yt = train[features], train.y, test[features], test.y

    logit = make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=2000)).fit(X, y)
    gb = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.08, max_iter=150, early_stopping=True, random_state=0).fit(X, y)
    p_log, p_gb = logit.predict_proba(Xt)[:, 1], gb.predict_proba(Xt)[:, 1]

    res = {
        "sk_logistic": (average_precision_score(yt, p_log), roc_auc_score(yt, p_log)),
        "sk_gbdt": (average_precision_score(yt, p_gb), roc_auc_score(yt, p_gb)),
    }
    o = ours[kind]
    fmt = lambda ap, auc: f"AUC-PR {ap:.3f} · AUC {auc:.3f}"
    lines.append(
        f"| {kind} | {fmt(o['logistic']['ap'], o['logistic']['auc'])} | {fmt(*res['sk_logistic'])} "
        f"| {fmt(o['gbdt']['ap'], o['gbdt']['auc'])} | {fmt(*res['sk_gbdt'])} |"
    )
    print(kind, "ok")

table = "\n".join(lines)
(HERE / "RESULTATS.md").write_text("# Vérification scikit-learn\n\nMêmes exemples, mêmes découpages, jeu de test identique.\n\n" + table + "\n")
print(table)
