#!/bin/bash
set -e

# ═══════════════════════════════════════════
# Synchroniser PREPROD LOCAL ← VPS PRÉ-PRODUCTION
# Récupère les fichiers à jour du serveur
# ═══════════════════════════════════════════

VPS_HOST="ubuntu@91.134.137.123"
VPS_DIR="/home/ubuntu/magic-systeme-preprod"

echo ""
echo "🔄 Synchronisation VPS PREPROD → Local"
echo "════════════════════════════════"
echo ""

echo "📥 Récupération des fichiers depuis le serveur preprod..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.DS_Store' \
  --exclude '*.log' \
  --exclude '.env' \
  --exclude '.env.production' \
  --exclude '.env.*' \
  --exclude 'package-lock.json' \
  $VPS_HOST:$VPS_DIR/ ./preprod/

echo ""
echo "════════════════════════════════"
echo "✅ Dossier local preprod/ synchronisé avec le VPS"
echo "════════════════════════════════"
