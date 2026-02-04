# ✅ ROADMAP ET ACTIONS À EFFECTUER

**Date** : 3 février 2026  
**Projet** : Décor Analytics v2.0

---

## 🔴 URGENT - À faire cette semaine

### 1. Corriger la performance (10 min → 5s) ⏱️ 20 minutes

**Objectif** : Réduire temps de chargement de 10 minutes à 5 secondes

**Fichiers à modifier** :

- [ ] `src/components/DashboardV2.tsx`
  - Remplacer imports recharts par lazyRecharts
  - Envelopper tous les charts dans `<Suspense><ChartFallback /></Suspense>`

- [ ] `src/components/ABCAnalysis.tsx`
  - Même processus

- [ ] `src/components/Dashboard.tsx`
  - Vérifier si encore utilisé (search dans App.tsx)
  - Si oui, appliquer corrections

- [ ] `src/components/ForecastAnomalies.tsx`
  - Même processus

- [ ] `src/components/StorePerformance.tsx`
  - Même processus

**Documentation détaillée** : Voir `ACTION_CHECKLIST.md`

**Validation** :
```bash
npm run dev
# Vérifier avec Chrome DevTools (F12 → Performance)
# FCP doit être < 2 secondes
```

---

### 2. Envoyer package à Nicolas ⏱️ 10 minutes

**Objectif** : Obtenir les colonnes CSV manquantes

**Email à envoyer** :
```
Sujet: [URGENT] Améliorations CSV requises - Application Analytics

Bonjour Nicolas,

Analyse complète effectuée des exports CSV fournis.
Résultat: 52% de complétude - 17 colonnes critiques manquantes.

3 problèmes BLOQUANTS identifiés:
1. Aucun moyen de distinguer ventes Web vs Magasin
   → 50% des statistiques sont fausses
2. Pas d'emails clients (perte 1.2M€/an marketing estimée)
3. Pas de noms produits (interface illisible)

6 documents attachés avec:
- Liste exacte des colonnes manquantes par fichier
- Exemples concrets de format attendu
- Requêtes SQL suggérées pour extraction
- Planning de livraison en 3 phases

Pouvons-nous planifier une réunion cette semaine?

Cordialement,
Marceau
```

**Fichiers à attacher** :
- [ ] `RESUME_DEMANDES_NICOLAS.md`
- [ ] `DEMANDES_CSV_NICOLAS.md`
- [ ] `MAPPING_TECHNIQUE_NICOLAS.md`
- [ ] `CHECKLIST_NICOLAS.md`
- [ ] `TABLEAU_BORD_DONNEES.md`
- [ ] `ANALYSE_GAPS_DONNEES.md`

**Actions de suivi** :
- [ ] Attendre confirmation réception (J+1)
- [ ] Planifier réunion technique (J+2)
- [ ] Répondre aux questions de faisabilité

---

## 🟡 IMPORTANT - 2 semaines

### 3. Importer catalogue web ⏱️ 1 heure

**Objectif** : Débloquer module King Quentin (recommandations)

**Étapes** :
- [ ] Demander fichier `catalogue_web.csv` à Nicolas
  - Colonnes attendues : code_produit, nom, url, stock_web, actif

**Option A : Table PostgreSQL** (recommandé)
```sql
CREATE TABLE catalogue_web (
  code_produit VARCHAR PRIMARY KEY,
  nom VARCHAR,
  url TEXT,
  stock_web INTEGER,
  actif BOOLEAN
);
```

**Option B : Flag dans table produits**
```sql
ALTER TABLE produits ADD COLUMN sur_web BOOLEAN DEFAULT FALSE;
UPDATE produits SET sur_web = TRUE WHERE id IN (...);
```

- [ ] Import CSV → PostgreSQL
- [ ] Créer API `/api/catalogue-web`
- [ ] Mettre à jour composant `KingQuentin.tsx`
- [ ] Tester

---

### 4. Créer APIs manquantes ⏱️ 2 jours

#### API `/api/cohortes` - Analyse rétention

**Logique** :
```typescript
// 1. Identifier cohorte de chaque client (mois première visite)
SELECT 
  carte,
  DATE_TRUNC('month', MIN(date)) as cohorte,
  DATE_TRUNC('month', date) as mois_achat
FROM transactions
GROUP BY carte, DATE_TRUNC('month', date)

// 2. Calculer taux de rétention par cohorte
// M0 = 100% (première visite)
// M+1 = % clients revenus 1 mois après
// M+2 = % clients revenus 2 mois après
// etc.
```

- [ ] Créer fichier `api/cohortes.js`
- [ ] Implémenter requête SQL
- [ ] Tester avec données 2025
- [ ] Mettre à jour composant `CohortAnalysis.tsx`

#### API `/api/stores` - Performance magasins

**Logique** :
```typescript
// Agrégation par magasin
SELECT 
  depot,
  COUNT(DISTINCT facture) as nb_tickets,
  SUM(ca) as ca_total,
  AVG(ca) as panier_moyen,
  COUNT(DISTINCT carte) as clients_uniques
FROM transactions
WHERE date BETWEEN ? AND ?
GROUP BY depot
ORDER BY ca_total DESC
```

- [ ] Créer fichier `api/stores.js`
- [ ] Implémenter requêtes
- [ ] Ajouter calcul objectifs (si table disponible)
- [ ] Mettre à jour composant `StorePerformance.tsx`

#### Améliorer `/api/cross-selling`

**Optimisations** :
- [ ] Lever limite 50,000 tickets (actuellement bottleneck)
- [ ] Ajouter index sur colonnes `facture` et `produit`
- [ ] Implémenter pagination côté serveur
- [ ] Cache plus agressif (15 min au lieu de 5)

```sql
-- Optimisation requête
CREATE INDEX idx_transactions_facture_produit 
ON transactions(facture, produit);
```

---

## 🟢 SOUHAITABLE - 1 mois

### 5. Forecast & Anomalies ⏱️ 3-5 jours

**Objectif** : Prévisions de vente + détection anomalies

**Bibliothèques** :
```bash
npm install simple-statistics ml-regression
```

**Algorithmes à implémenter** :
- [ ] Moving Average (MA) sur 7/30 jours
- [ ] Régression linéaire simple
- [ ] Détection anomalies (écart-type)
- [ ] Saisonnalité (décomposition temporelle)

**API `/api/forecast`** :
```typescript
// 1. Calculer tendance historique
// 2. Appliquer moving average
// 3. Détecter anomalies (>2σ)
// 4. Générer prévisions J+7, J+30
```

- [ ] Créer fichier `api/forecast.js`
- [ ] Implémenter algorithmes
- [ ] Tester sur données 2025
- [ ] Mettre à jour composant `ForecastAnomalies.tsx`

---

### 6. Maintenance continue

#### Documentation
- [ ] Mettre à jour README.md avec nouvelles features
- [ ] Créer guide utilisateur (screenshots + explications)
- [ ] Documenter APIs avec exemples
- [ ] Vidéo démo 5 minutes

#### Tests
- [ ] Tests unitaires composants React (Vitest)
- [ ] Tests d'intégration APIs (Jest)
- [ ] Tests E2E (Playwright ou Cypress)
- [ ] Coverage > 70%

#### Monitoring
- [ ] Intégrer Sentry (error tracking)
- [ ] Intégrer LogRocket (session replay)
- [ ] Dashboard Vercel Analytics
- [ ] Alertes email si erreurs critiques

#### Optimisations
- [ ] Audit Lighthouse (score >90)
- [ ] Optimisation images (WebP, lazy loading)
- [ ] Service Worker (PWA)
- [ ] Mode sombre

---

## 📅 Planning prévisionnel

```
SEMAINE 1 (3-9 février)
├─ Lundi 3     : Corriger performance (20 min)
├─ Mardi 4     : Envoyer email Nicolas
├─ Mercredi 5  : Réunion technique Nicolas
├─ Jeudi 6     : Début implémentation selon feedback
└─ Vendredi 7  : Tests et validation

SEMAINE 2-3 (10-23 février)
├─ Réception CSV corrigés de Nicolas
├─ Import catalogue web
├─ Créer APIs manquantes (cohortes, stores)
├─ Tests intensifs
└─ Corrections bugs

SEMAINE 4 (24 février - 2 mars)
├─ Forecast & Anomalies
├─ Documentation complète
├─ Formation utilisateurs
└─ Déploiement production

MARS 2026
├─ Monitoring et ajustements
├─ Optimisations selon feedback
├─ Nouvelles features selon demande
└─ Mesure ROI
```

---

## 📊 Suivi de progression

### Phase 1 : Optimisations immédiates
```
Performance corrigée         [ ] 0%
Email envoyé à Nicolas       [ ] 0%
Réunion planifiée            [ ] 0%
```

### Phase 2 : Corrections données
```
CSV corrigés reçus           [ ] 0%
Import nouvelle structure    [ ] 0%
Tests validation données     [ ] 0%
```

### Phase 3 : Modules manquants
```
Catalogue web importé        [ ] 0%
API cohortes créée           [ ] 0%
API stores créée             [ ] 0%
Cross-selling optimisé       [ ] 0%
```

### Phase 4 : Avancé
```
Forecast implémenté          [ ] 0%
Tests unitaires (>70%)       [ ] 0%
Documentation complète       [ ] 0%
Production déployée          [ ] 0%
```

---

## 🎯 Critères de succès

### KPIs techniques
- [ ] Temps de chargement < 5 secondes
- [ ] Score Lighthouse > 90
- [ ] 0 erreurs console
- [ ] Coverage tests > 70%
- [ ] Tous les modules fonctionnels (13/14)

### KPIs business (avec données complètes)
- [ ] Complétude données > 90%
- [ ] CA Web correctement calculé (≠ 0€)
- [ ] Marketing opérationnel (emails envoyés)
- [ ] Satisfaction utilisateurs > 80%
- [ ] CA marketing généré > 500k€ en 6 mois

### KPIs qualité
- [ ] Documentation à jour
- [ ] Code review systematic
- [ ] Déploiements sans erreur
- [ ] Feedback utilisateurs intégré

---

## 📞 Points de contrôle

**Hebdomadaire** :
- Review progrès vs planning
- Ajustements priorités
- Communication stakeholders

**Mensuel** :
- Analyse métriques (performance, usage)
- Feedback utilisateurs
- ROI marketing (si données complètes)

---

**Prochaine action immédiate** : Corriger performance (20 min) + Envoyer email Nicolas (10 min)

**Dernière mise à jour** : 3 février 2026
