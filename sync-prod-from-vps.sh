#!/bin/bash
set -e

# ═══════════════════════════════════════════
# Synchroniser PROD LOCAL ← VPS PRODUCTION
# Récupère les fichiers à jour du serveur
# ═══════════════════════════════════════════

VPS_HOST="ubuntu@91.134.141.37"
VPS_DIR="/home/ubuntu/magic-systeme-prod"

echo ""
echo "🔄 Synchronisation VPS PROD → Local"
echo "════════════════════════════════"
echo ""

echo "📥 Récupération des fichiers depuis le serveur prod..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.DS_Store' \
  --exclude '*.log' \
  --exclude '.env' \
  --exclude '.env.production' \
  --exclude '.env.*' \
  --exclude 'package-lock.json' \
  $VPS_HOST:$VPS_DIR/ ./prod/

echo ""
echo "════════════════════════════════"
echo "✅ Dossier local prod/ synchronisé avec le VPS"
echo "════════════════════════════════"
