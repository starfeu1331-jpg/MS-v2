#!/bin/bash

# 🚀 Script de déploiement OVH - Decor Analytics
# Ce script pousse les changements sur GitHub et déclenche le déploiement sur OVH

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Déploiement Decor Analytics - OVH     ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo ""

# Configuration
VPS_IP="91.134.137.123"
VPS_USER="ubuntu"
VPS_PATH="/home/ubuntu/apps/decor-analytics"
DOMAIN="decordb.fr"

# Vérifier que nous sommes dans le bon dossier
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: package.json introuvable. Êtes-vous dans le bon dossier ?${NC}"
    exit 1
fi

# Étape 1: Vérifier l'état Git
echo -e "${BLUE}📋 Étape 1: Vérification Git...${NC}"
if git diff-index --quiet HEAD --; then
    echo -e "${GREEN}✓ Pas de modifications non commitées${NC}"
else
    echo -e "${YELLOW}⚠️  Modifications détectées${NC}"
    git status --short
    echo ""
    read -p "Voulez-vous commiter ces changements ? (o/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        read -p "Message de commit: " COMMIT_MSG
        git add .
        git commit -m "$COMMIT_MSG"
        echo -e "${GREEN}✓ Changements commités${NC}"
    else
        echo -e "${YELLOW}⚠️  Certains fichiers ne seront pas déployés${NC}"
    fi
fi

# Étape 2: Pousser sur GitHub
echo ""
echo -e "${BLUE}📤 Étape 2: Push vers GitHub...${NC}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push origin $BRANCH
echo -e "${GREEN}✓ Code poussé sur GitHub ($BRANCH)${NC}"

# Étape 3: Connexion et déploiement sur OVH
echo ""
echo -e "${BLUE}🌐 Étape 3: Déploiement sur OVH ($VPS_IP)...${NC}"
echo -e "${YELLOW}Connexion au serveur...${NC}"

ssh -t ${VPS_USER}@${VPS_IP} << 'ENDSSH'
set -e

# Couleurs dans SSH
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd /home/ubuntu/apps/decor-analytics

echo -e "${BLUE}📥 Pull du code depuis GitHub...${NC}"
git pull origin main || git pull origin master

echo -e "${BLUE}📦 Installation des dépendances...${NC}"
npm install

echo -e "${BLUE}🏗️  Build de l'application...${NC}"
npm run build

echo -e "${BLUE}🔄 Redémarrage de l'application...${NC}"
pm2 restart decor-analytics || {
    echo -e "${YELLOW}PM2 process non trouvé, démarrage...${NC}"
    NODE_ENV=production pm2 start server.js --name decor-analytics
    pm2 save
}

echo -e "${GREEN}✅ Déploiement terminé !${NC}"
pm2 status

ENDSSH

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        ✅ Déploiement réussi ! 🎉          ║${NC}"
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo ""
echo -e "🌐 Votre application est accessible sur:"
echo -e "   ${BLUE}https://${DOMAIN}${NC}"
echo ""
echo -e "📊 Pour voir les logs:"
echo -e "   ${YELLOW}ssh ${VPS_USER}@${VPS_IP} 'pm2 logs decor-analytics'${NC}"
echo ""
