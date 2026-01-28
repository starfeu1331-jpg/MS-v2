#!/bin/bash
# Script de test : Réduire la BDD à 6 mois + préparer CSV de test

PSQL="/opt/homebrew/opt/postgresql@16/bin/psql"
DB_URL="postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🧪 Préparation environnement de test"
echo "======================================"

# 1. Statistiques actuelles
echo ""
echo "📊 État ACTUEL de la base :"
$PSQL "$DB_URL" -c "SELECT COUNT(*) as total_transactions FROM transactions"
$PSQL "$DB_URL" -c "SELECT MIN(date) as date_min, MAX(date) as date_max FROM transactions"

# 2. Export 6 derniers mois (août 2024 - janvier 2025)
echo ""
echo "📥 Export des 6 derniers mois dans CSV de test..."

# Transactions 6 mois
$PSQL "$DB_URL" -c "\COPY (SELECT * FROM transactions WHERE date >= '2024-08-01' AND date < '2025-02-01' ORDER BY date) TO 'data/nouveaux/test-6mois-transactions.csv' CSV HEADER"

# Clients associés
$PSQL "$DB_URL" -c "\COPY (SELECT DISTINCT c.* FROM clients c JOIN transactions t ON c.carte = t.carte WHERE t.date >= '2024-08-01' AND t.date < '2025-02-01') TO 'data/nouveaux/test-6mois-clients.csv' CSV HEADER"

# Produits associés
$PSQL "$DB_URL" -c "\COPY (SELECT DISTINCT p.* FROM produits p JOIN transactions t ON p.id = t.produit WHERE t.date >= '2024-08-01' AND t.date < '2025-02-01') TO 'data/nouveaux/test-6mois-produits.csv' CSV HEADER"

# 3. Export quelques jours en plus pour test quotidien (1-7 février)
echo ""
echo "📥 Export 7 jours supplémentaires pour test quotidien..."

$PSQL "$DB_URL" -c "\COPY (SELECT * FROM transactions WHERE date >= '2025-02-01' AND date <= '2025-02-07' ORDER BY date) TO 'data/nouveaux/test-update-transactions.csv' CSV HEADER"

$PSQL "$DB_URL" -c "\COPY (SELECT DISTINCT c.* FROM clients c JOIN transactions t ON c.carte = t.carte WHERE t.date >= '2025-02-01' AND t.date <= '2025-02-07') TO 'data/nouveaux/test-update-clients.csv' CSV HEADER"

$PSQL "$DB_URL" -c "\COPY (SELECT DISTINCT p.* FROM produits p JOIN transactions t ON p.id = t.produit WHERE t.date >= '2025-02-01' AND t.date <= '2025-02-07') TO 'data/nouveaux/test-update-produits.csv' CSV HEADER"

echo ""
echo "✅ CSV de test créés dans data/nouveaux/"
echo ""
ls -lh data/nouveaux/test-*.csv

# 4. Afficher les stats des CSV
echo ""
echo "📊 Statistiques des CSV créés :"
echo "  - 6 mois (base) : $(wc -l < data/nouveaux/test-6mois-transactions.csv) transactions"
echo "  - 7 jours (update) : $(wc -l < data/nouveaux/test-update-transactions.csv) transactions"

echo ""
echo "🎯 Prochaine étape : Vider et recharger la base avec les 6 mois"
echo "   Commande : bash scripts/reload-test-db.sh"
