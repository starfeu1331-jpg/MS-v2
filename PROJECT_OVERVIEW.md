# 📊 DÉCOR ANALYTICS - Vue d'ensemble du projet

**Date de dernière mise à jour** : 3 février 2026  
**Version** : 2.0  
**Statut** : En production avec optimisations en cours

---

## 🎯 Objectif du projet

Application web d'**analyse retail avancée** pour Décor Discount (réseau de magasins de décoration et bricolage). Permet d'analyser les performances commerciales, segmenter les clients, optimiser les stocks et maximiser le CA.

---

## 🏗️ Architecture technique

### Stack Frontend
- **Framework** : React 19.2 + TypeScript
- **Build** : Vite 7.3
- **Styling** : Tailwind CSS 3.4
- **Charts** : Recharts 3.6 (lazy-loaded)
- **Maps** : Leaflet + React-Leaflet
- **Icons** : Lucide React

### Stack Backend
- **Platform** : Vercel Serverless Functions (Node.js 18)
- **ORM** : Prisma 5.22
- **Database** : PostgreSQL (Neon - serverless)
- **API** : 12 endpoints RESTful
- **Timeout** : 30s max par fonction

### Base de données (Neon PostgreSQL)

**4 tables principales** :

```sql
clients (591k lignes)
  - carte (PK), dateCreation, statut, civilite, sexe
  - adresse, cp, ville
  - Relations: transactions[]

produits (55k lignes)
  - id (PK), famille, sousFamille
  - sousSousFamille, sousSousSousFamille
  - Relations: transactions[]

magasins (22 lignes)
  - code (PK), zone, nom
  - adresse, cp, ville
  - Relations: transactions[]

transactions (709k lignes - Q1-Q2 2025)
  - id (PK), facture, carte, depot
  - date, produit, quantite, prix, ca
  - isWeb (Boolean - actuellement toujours FALSE)
  - Indexes: date, carte, produit, depot, facture
```

**Métriques actuelles** :
- 709,121 transactions (janvier-juin 2025)
- 144,066 clients actifs (après exclusion carte "0")
- 55,730 produits actifs
- 22 magasins physiques
- CA total : ~45M€ sur période analysée

---

## ✨ Fonctionnalités implémentées

### 🟢 Opérationnelles (9/14 modules)

1. **Dashboard Principal** - 100%
   - KPIs globaux (CA, transactions, panier moyen)
   - Top produits / Top magasins / Top clients
   - Évolution mensuelle avec graphiques
   - Toggle Web/Magasin
   - Cache 5 minutes

2. **Segmentation RFM** - 100%
   - Calcul avec quintiles dynamiques (NTILE PostgreSQL)
   - 7 segments : Ultra Champions, Champions, Loyaux, À Risque, Perdus, Nouveaux, Occasionnels
   - Performance : 864ms pour 144k clients
   - Export clients par segment
   - Détail par segment avec statistiques

3. **Recherche** - 100%
   - Par ticket (n° facture)
   - Par client (carte fidélité)
   - Par produit (code)
   - Drill-down avec détails complets

4. **Analyse Sous-Familles** - 95%
   - Stats par famille/sous-famille de produits
   - Calcul rentabilité vs CAC
   - Panier moyen par catégorie

5. **Cross-Selling** - 90%
   - Associations de produits
   - Top 50 associations par fréquence
   - CA par association
   - ⚠️ Limité à 50k tickets pour performance

6. **ABC Analysis** - 70%
   - Classification Pareto (80/15/5)
   - Identification produits stratégiques
   - Graphiques de distribution

7. **Export de données** - 100%
   - Export Excel/CSV
   - Formatage automatique
   - Tous les modules compatibles

8. **Zone de chalandise** - 80%
   - Carte interactive avec Leaflet
   - Heatmap par code postal
   - ⚠️ Nécessite GPS magasins pour version complète

9. **WebDashboard** - 60%
   - Statistiques spécifiques Web
   - ⚠️ Actuellement CA = 0€ (colonne Canal manquante)

### 🔴 Non opérationnelles (5/14 modules)

1. **Analyse de Cohortes** ❌
   - Besoin : API `/api/cohortes` + tracking rétention
   - Complexité : Moyenne

2. **King Quentin (Recommandations)** ❌
   - Besoin : Table `catalogue_web` dans PostgreSQL
   - Fichier CSV requis ou flag `sur_web` dans produits
   - Complexité : Faible (si CSV disponible)

3. **Performance Magasins** ❌
   - Besoin : API `/api/stores` + objectifs/coûts
   - Complexité : Moyenne

4. **Forecast & Anomalies** ❌
   - Besoin : Algorithmes ML (moving average, régression)
   - Complexité : Élevée

5. **Social Media Insights** ❌
   - Besoin : API Meta/Instagram
   - Complexité : Élevée (hors scope BDD)

---

## 🚀 Performance

### Métriques actuelles
- **First Contentful Paint** : 10 minutes ⚠️ (à corriger → cible <2s)
- **Time to Interactive** : 10 minutes ⚠️ (à corriger → cible <5s)
- **API Dashboard** : ~2-3s première charge, <100ms avec cache
- **API RFM** : ~864ms (NTILE sur 144k clients)
- **Bundle JS initial** : 2-3MB (à optimiser → cible 500-700KB)

### Optimisations en cours
- Lazy loading Recharts (3.6MB) → Gain attendu 95%
- Code splitting par route
- Cache frontend 5 minutes
- Index PostgreSQL sur colonnes clés

---

## 📁 Structure du projet

```
decor-analytics/
├── src/
│   ├── components/          # 20 composants React
│   │   ├── DashboardV2.tsx  # Dashboard principal
│   │   ├── RFMAnalysis.tsx  # Segmentation clients
│   │   ├── ABCAnalysis.tsx  # Classification produits
│   │   └── ...
│   ├── services/
│   │   ├── api.ts           # Client API
│   │   └── decorAPI.ts      # Appels spécifiques
│   ├── utils/
│   │   ├── lazyRecharts.tsx # Lazy loading charts
│   │   └── lazyLoading.ts   # Utilities
│   ├── hooks/
│   │   └── useDatabase.ts   # Hook DB locale (optionnel)
│   └── App.tsx              # Point d'entrée
├── api/                     # 12 endpoints Vercel
│   ├── dashboard.js
│   ├── rfm.js
│   ├── search.js
│   └── ...
├── prisma/
│   └── schema.prisma        # Schéma BDD
├── backend/                 # Scripts serveur (legacy)
├── scripts/                 # Scripts Python/Shell
│   ├── convert-csv-format.py
│   ├── load-to-postgres.sh
│   └── update-workflow.sh
├── public/                  # Assets statiques
└── package.json
```

---

## 🔑 Points clés

### ✅ Forces
- Architecture moderne et scalable
- Code TypeScript strict et maintenable
- 9 modules fonctionnels de qualité professionnelle
- Cache intelligent (5min TTL)
- Documentation exhaustive
- Tests de validation RFM

### ⚠️ Limitations actuelles
1. **Performance** : 10 minutes de chargement (correctif prêt, 20 min d'implémentation)
2. **Données CSV incomplètes** : 52% de complétude (17 colonnes critiques manquantes)
3. **CA Web = 0€** : Colonne "Canal" absente des exports
4. **Marketing impossible** : Aucun email client dans les données
5. **Interface produits** : Codes bruts affichés (noms manquants)

### 🎯 Objectifs à 1 mois
- Performance : <5 secondes
- Données : 92% de complétude
- Fonctionnalités : 95% opérationnelles
- CA marketing : +2M€/an estimé

---

## 👥 Stakeholders

- **Marceau** : Développeur principal
- **Nicolas** : Responsable informatique (pôle IT - exports CSV)
- **Direction** : Utilisateurs finaux (analyses business)

---

## 📞 URLs et accès

- **Production** : https://ms-v2.vercel.app
- **Repository** : GitHub starfeu1331-jpg/MS-v2
- **Database** : Neon PostgreSQL (connection string en env)
- **Backend API** : Vercel Serverless Functions

---

## 📈 Métriques de succès

| KPI | Actuel | Cible Q1 2026 |
|-----|--------|---------------|
| Temps de chargement | 10 min | <5s |
| Complétude données | 52% | 92% |
| Modules fonctionnels | 9/14 (64%) | 13/14 (93%) |
| Clients contactables | 0% | 65% |
| CA marketing généré | 0€ | +2M€/an |
| Satisfaction utilisateurs | N/A | >80% |

---

**Dernière révision** : 3 février 2026
