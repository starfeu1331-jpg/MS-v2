# 🏗️ Solution Architecture: Gros Volumes sur Vercel Serverless

## 🚨 Problème Actuel
- **6M transactions** : Requêtes qui prennent 15-30 secondes
- **Vercel Free** : Timeout de 10 secondes max
- **year=all** : Scan complet de 6M lignes → TIMEOUT systématique

## 🔍 Recherche Solutions (Forums & Best Practices)

### 1. **Vercel Discussions** : Tables d'Agrégation Pré-calculées
```sql
-- Créer une table de snapshots par période
CREATE TABLE dashboard_snapshots (
  id SERIAL PRIMARY KEY,
  period_type VARCHAR(20), -- 'year', 'month', 'all'
  period_value VARCHAR(20), -- '2025', '2025-01', 'all'
  total_ca NUMERIC,
  total_tickets INTEGER,
  total_clients INTEGER,
  panier_moyen NUMERIC,
  data JSONB, -- Données complètes
  calculated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. **Stack Overflow** : Requêtes Incrémentales avec Union
```sql
-- Au lieu de scanner 6M lignes, faire des requêtes par année puis UNION
SELECT * FROM transactions WHERE EXTRACT(YEAR FROM date) = 2022
UNION ALL
SELECT * FROM transactions WHERE EXTRACT(YEAR FROM date) = 2023
-- Chaque sous-requête utilise l'index sur date
```

### 3. **Reddit r/webdev** : Streaming API + Background Jobs
- API retourne "en cours" (200 OK) immédiatement
- Calcul en background (Vercel Cron Job ou service externe)
- Client poll pour récupérer le résultat

### 4. **PostgreSQL Wiki** : Vues Matérialisées
```sql
-- Vue matérialisée = table pré-calculée auto-refresh
CREATE MATERIALIZED VIEW dashboard_all AS
SELECT 
  COUNT(DISTINCT carte) as total_clients,
  COUNT(DISTINCT facture) as total_tickets,
  SUM(ca) as total_ca
FROM transactions
WHERE depot NOT IN ('1', '41', '42');

-- Refresh périodique (1x/jour)
REFRESH MATERIALIZED VIEW dashboard_all;
```

## ✅ Solution Retenue : Hybrid Snapshots + Incrémental

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│  1. SCRIPT PYTHON DE PRÉ-CALCUL (1x/jour ou après import)  │
│     - Calcule KPIs par année (2022, 2023, 2024, 2025, 2026) │
│     - Calcule KPIs "all"                                     │
│     - Stocke dans table dashboard_snapshots                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. API VERCEL ULTRA-RAPIDE                                 │
│     - Lit depuis dashboard_snapshots (< 1 seconde)          │
│     - Pas de calcul, juste SELECT sur table pré-calculée    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. FRONTEND                                                │
│     - Reçoit données instantanément                         │
│     - Affiche "Dernière mise à jour: 19/02/2026 14:30"      │
└─────────────────────────────────────────────────────────────┘
```

### Avantages
- ✅ **< 1 seconde** même pour year=all (6M lignes)
- ✅ **Compatible Vercel Free** (pas de timeout)
- ✅ **Données exactes** (refresh quotidien ou on-demand)
- ✅ **RFM sur 100% clients** (pré-calculé en Python, pas de limite)

## 🎯 Implémentation

### Étape 1: Créer la table snapshots
```sql
CREATE TABLE dashboard_snapshots (
  id SERIAL PRIMARY KEY,
  period_type VARCHAR(20),
  period_value VARCHAR(20),
  kpis JSONB,
  stats_clients JSONB,
  top_produits JSONB,
  top_magasins JSONB,
  top_clients JSONB,
  evolution_mensuelle JSONB,
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(period_type, period_value)
);
```

### Étape 2: Script de pré-calcul Python
```python
# calculate-snapshots.py
# Calcule tous les snapshots et les stocke
# À exécuter après chaque import de données

for year in ['2022', '2023', '2024', '2025', '2026']:
    kpis = calculate_kpis(year)
    cursor.execute("""
        INSERT INTO dashboard_snapshots (period_type, period_value, kpis, ...)
        VALUES ('year', %s, %s, ...)
        ON CONFLICT (period_type, period_value) 
        DO UPDATE SET kpis = EXCLUDED.kpis, calculated_at = NOW()
    """, (year, json.dumps(kpis)))
```

### Étape 3: API simplifiée
```javascript
// api/dashboard.js
const snapshot = await prisma.$queryRaw`
  SELECT * FROM dashboard_snapshots 
  WHERE period_type = 'year' AND period_value = ${year}
`
return res.json(snapshot.kpis)
```

## 📊 Pour RFM
Même principe : pré-calculer la segmentation RFM de TOUS les clients
```sql
CREATE TABLE rfm_segments (
  carte VARCHAR PRIMARY KEY,
  recency_score INT,
  frequency_score INT,
  monetary_score INT,
  segment VARCHAR(50),
  last_purchase_date DATE,
  total_ca NUMERIC,
  total_orders INT,
  calculated_at TIMESTAMP
);
```

Calcul Python 1x/jour sur 100% des clients, API Vercel lit juste la table.
