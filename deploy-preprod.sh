#!/bin/bash
set -e

# ═══════════════════════════════════════════
# Déploiement vers PRÉ-PRODUCTION
# Serveur: 91.134.137.123
# ═══════════════════════════════════════════

VPS_HOST="ubuntu@91.134.137.123"
VPS_DIR="/home/ubuntu/magic-systeme-preprod"

echo ""
echo "🚀 Déploiement PRÉ-PRODUCTION"
echo "════════════════════════════════"
echo ""

echo "📦 1/4 — Synchronisation des fichiers..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.DS_Store' \
  --exclude '*.log' \
  --exclude '.env' \
  --exclude '.env.production' \
  --exclude '.env.*' \
  ./preprod/ $VPS_HOST:$VPS_DIR/
echo "✅ Fichiers synchronisés"
echo ""

echo "📦 2/4 — Installation des dépendances..."
ssh $VPS_HOST "cd $VPS_DIR && npm install && npx prisma generate"
echo "✅ Dépendances installées"
echo ""

echo "🏗️  3/4 — Build du frontend..."
ssh $VPS_HOST "cd $VPS_DIR && npm run build"
echo "✅ Frontend compilé"
echo ""

echo "🔄 4/4 — Redémarrage du serveur..."
ssh $VPS_HOST "cd $VPS_DIR && pm2 restart magic-systeme-preprod 2>/dev/null || pm2 start server.js --name magic-systeme-preprod"
ssh $VPS_HOST "pm2 save"
echo "✅ Serveur redémarré"
echo ""

echo "════════════════════════════════"
echo "✅ DÉPLOIEMENT PRÉ-PROD TERMINÉ"
echo "🌐 http://91.134.137.123 ou http://preprod.decordb.fr"
echo "════════════════════════════════"
