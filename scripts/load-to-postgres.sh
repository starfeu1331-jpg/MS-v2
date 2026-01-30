#!/bin/bash

# Script pour charger les données converties directement dans PostgreSQL via \COPY
# Usage: ./load-to-postgres.sh <dossier_csv>

set -e

PSQL_CMD="/opt/homebrew/opt/postgresql@16/bin/psql"
DB_URL="postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

if [ -z "$1" ]; then
  echo "❌ Usage: ./load-to-postgres.sh <dossier_csv>"
  echo "Exemple: ./load-to-postgres.sh converted-data-avant"
  exit 1
fi

CSV_DIR="$1"

# Si chemin relatif, le rendre absolu
if [[ "$CSV_DIR" != /* ]]; then
  CSV_DIR="$PWD/$CSV_DIR"
fi

if [ ! -d "$CSV_DIR" ]; then
  echo "❌ Dossier introuvable: $CSV_DIR"
  exit 1
fi

echo "🗑️  ATTENTION: Cette opération va SUPPRIMER toutes les données existantes"
echo "📁 Dossier CSV: $CSV_DIR"
echo ""
read -p "Tapez OUI pour confirmer: " confirmation

if [ "$confirmation" != "OUI" ]; then
  echo "❌ Annulé"
  exit 1
fi

echo ""
echo "🚀 Démarrage du chargement..."
echo ""

# 1. Supprimer les contraintes
echo "📌 Suppression des contraintes..."
$PSQL_CMD "$DB_URL" -c "
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_carte_fkey;
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_depot_fkey;
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_produit_fkey;
"

# 2. Vider les tables
echo "🗑️  Vidage des tables..."
$PSQL_CMD "$DB_URL" -c "
  TRUNCATE TABLE transactions;
  TRUNCATE TABLE clients CASCADE;
  TRUNCATE TABLE produits CASCADE;
  TRUNCATE TABLE depots CASCADE;
"

# 3. Charger clients
if [ -f "$CSV_DIR/clients.csv" ]; then
  echo "📥 Chargement clients..."
  $PSQL_CMD "$DB_URL" -c "\COPY clients FROM '$CSV_DIR/clients.csv' CSV HEADER"
else
  echo "⚠️  Fichier clients.csv introuvable"
fi

# 4. Charger produits
if [ -f "$CSV_DIR/produits.csv" ]; then
  echo "📥 Chargement produits..."
  $PSQL_CMD "$DB_URL" -c "\COPY produits FROM '$CSV_DIR/produits.csv' CSV HEADER"
else
  echo "⚠️  Fichier produits.csv introuvable"
fi

# 5. Charger dépôts
if [ -f "$CSV_DIR/depots.csv" ]; then
  echo "📥 Chargement dépôts..."
  $PSQL_CMD "$DB_URL" -c "\COPY depots FROM '$CSV_DIR/depots.csv' CSV HEADER"
else
  echo "⚠️  Fichier depots.csv introuvable"
fi

# 6. Charger transactions
if [ -f "$CSV_DIR/transactions.csv" ]; then
  echo "📥 Chargement transactions..."
  $PSQL_CMD "$DB_URL" -c "\COPY transactions(facture,carte,depot,date,produit,quantite,prix,ca,is_web,ville,cp) FROM '$CSV_DIR/transactions.csv' CSV HEADER"
else
  echo "❌ Fichier transactions.csv introuvable (obligatoire)"
  exit 1
fi

# 7. Vérification
echo ""
echo "✅ Chargement terminé!"
echo ""
echo "📊 Vérification des données..."
$PSQL_CMD "$DB_URL" -c "
  SELECT 
    'transactions' as table_name, COUNT(*) as count FROM transactions
  UNION ALL
  SELECT 'clients', COUNT(*) FROM clients
  UNION ALL
  SELECT 'produits', COUNT(*) FROM produits
  UNION ALL
  SELECT 'depots', COUNT(*) FROM depots;
"

echo ""
echo "🎉 Terminé!"
