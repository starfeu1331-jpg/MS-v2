#!/bin/bash
# Script pour recharger la BDD avec données de test (6 mois)

PSQL="/opt/homebrew/opt/postgresql@16/bin/psql"
DB_URL="postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "⚠️  ATTENTION: Ce script va SUPPRIMER toutes les données actuelles !"
echo "   et recharger uniquement 6 mois de test (août 2024 - janvier 2025)"
echo ""
read -p "Tapez 'OUI' pour confirmer: " confirm

if [ "$confirm" != "OUI" ]; then
    echo "❌ Opération annulée"
    exit 0
fi

echo ""
echo "🗑️  Suppression des données actuelles..."

# Supprimer les contraintes
$PSQL "$DB_URL" -c "ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_carte_fkey"
$PSQL "$DB_URL" -c "ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_depot_fkey"
$PSQL "$DB_URL" -c "ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_produit_fkey"

# Vider les tables
$PSQL "$DB_URL" -c "TRUNCATE TABLE transactions"
$PSQL "$DB_URL" -c "TRUNCATE TABLE clients CASCADE"
$PSQL "$DB_URL" -c "TRUNCATE TABLE produits CASCADE"

echo "✅ Tables vidées"

echo ""
echo "📥 Chargement des données de test (6 mois)..."

# Charger clients
echo "  → Clients..."
$PSQL "$DB_URL" -c "\COPY clients FROM 'data/nouveaux/test-6mois-clients.csv' CSV HEADER"

# Charger produits
echo "  → Produits..."
$PSQL "$DB_URL" -c "\COPY produits FROM 'data/nouveaux/test-6mois-produits.csv' CSV HEADER"

# Charger transactions
echo "  → Transactions..."
$PSQL "$DB_URL" -c "\COPY transactions FROM 'data/nouveaux/test-6mois-transactions.csv' CSV HEADER"

echo ""
echo "📊 Nouvelles statistiques :"
$PSQL "$DB_URL" -c "SELECT COUNT(*) as total_transactions FROM transactions"
$PSQL "$DB_URL" -c "SELECT MIN(date) as date_min, MAX(date) as date_max FROM transactions"
$PSQL "$DB_URL" -c "SELECT COUNT(*) as total_clients FROM clients"
$PSQL "$DB_URL" -c "SELECT COUNT(*) as total_produits FROM produits"

echo ""
echo "✅ Base de données rechargée avec données de test !"
echo ""
echo "🎯 Tu peux maintenant tester l'interface de mise à jour :"
echo "   1. Va dans Settings → Base de données"
echo "   2. Glisse les fichiers test-update-*.csv"
echo "   3. Clique sur 'Mise à jour Quotidienne'"
