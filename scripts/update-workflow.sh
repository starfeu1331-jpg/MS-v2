#!/bin/bash
# Workflow complet de mise à jour des données

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  📊 MISE À JOUR DES DONNÉES DECOR ANALYTICS"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. Demander le dossier source
echo "📁 Où sont tes fichiers CSV Sage ?"
echo "   (ex: /Users/marceau/Desktop/Data update/Data avant)"
read -p "Chemin: " SOURCE_DIR

if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Dossier introuvable: $SOURCE_DIR"
  exit 1
fi

# 2. Demander le type de mise à jour
echo ""
echo "📝 Type de mise à jour :"
echo "   1) Hebdomadaire (EFFACE tout et recharge)"
echo "   2) Quotidienne (AJOUTE seulement les nouveaux jours)"
read -p "Choix (1 ou 2): " UPDATE_TYPE

# 3. Conversion des CSV
CONVERTED_DIR="/tmp/decor-converted-$(date +%s)"
mkdir -p "$CONVERTED_DIR"

echo ""
echo "🔄 Conversion des fichiers CSV..."
python3 scripts/convert-csv-format.py "$SOURCE_DIR" "$CONVERTED_DIR"

if [ $? -ne 0 ]; then
  echo "❌ Erreur lors de la conversion"
  exit 1
fi

echo ""
echo "✅ Conversion terminée: $CONVERTED_DIR"
echo ""

# 4. Mise à jour selon le type
if [ "$UPDATE_TYPE" == "1" ]; then
  echo "🗓️  MISE À JOUR HEBDOMADAIRE"
  echo "⚠️  ATTENTION: Va SUPPRIMER toutes les données existantes"
  echo ""
  
  ./scripts/load-to-postgres.sh "$CONVERTED_DIR"
  
elif [ "$UPDATE_TYPE" == "2" ]; then
  echo "📅 MISE À JOUR QUOTIDIENNE"
  echo "   (Ajout des transactions > date max)"
  echo ""
  
  python3 scripts/test-daily-update.py "$CONVERTED_DIR/transactions.csv"
  
  # Charger aussi les nouveaux clients/produits
  echo ""
  echo "📥 Chargement des nouveaux clients/produits..."
  
  PSQL_CMD="/opt/homebrew/opt/postgresql@16/bin/psql"
  DB_URL="postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
  
  if [ -f "$CONVERTED_DIR/clients.csv" ]; then
    echo "  → Clients..."
    $PSQL_CMD "$DB_URL" -c "\COPY clients FROM '$CONVERTED_DIR/clients.csv' CSV HEADER" 2>&1 | grep -v "duplicate key" || true
  fi
  
  if [ -f "$CONVERTED_DIR/produits.csv" ]; then
    echo "  → Produits..."
    $PSQL_CMD "$DB_URL" -c "\COPY produits FROM '$CONVERTED_DIR/produits.csv' CSV HEADER" 2>&1 | grep -v "duplicate key" || true
  fi
  
else
  echo "❌ Choix invalide"
  exit 1
fi

# 5. Nettoyage
echo ""
echo "🧹 Nettoyage des fichiers temporaires..."
rm -rf "$CONVERTED_DIR"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ MISE À JOUR TERMINÉE !"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Vérifie le dashboard: https://ms-v2.vercel.app"
echo ""
