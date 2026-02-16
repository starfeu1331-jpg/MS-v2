#!/bin/bash

# 🔧 Script de configuration initiale du serveur OVH
# À exécuter UNE SEULE FOIS sur le serveur OVH

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🔧 Configuration Serveur OVH - Decor Analytics  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Vérifier que nous sommes sur le serveur OVH
if [ ! -f "/etc/lsb-release" ]; then
    echo -e "${RED}❌ Ce script doit être exécuté sur le serveur Ubuntu${NC}"
    exit 1
fi

echo -e "${YELLOW}Ce script va:${NC}"
echo "  1. Installer Node.js 20"
echo "  2. Installer PostgreSQL 16"
echo "  3. Installer Nginx"
echo "  4. Installer PM2"
echo "  5. Configurer la base de données"
echo "  6. Cloner le projet"
echo "  7. Configurer Nginx"
echo "  8. Configurer le SSL"
echo ""
read -p "Continuer ? (o/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "Annulé."
    exit 0
fi

# Mise à jour système
echo -e "${BLUE}📦 Mise à jour du système...${NC}"
sudo apt update && sudo apt upgrade -y

# Installation Node.js 20
echo ""
echo -e "${BLUE}📥 Installation Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
echo -e "${GREEN}✓ Node.js $(node --version) installé${NC}"

# Installation PostgreSQL 16
echo ""
echo -e "${BLUE}🐘 Installation PostgreSQL 16...${NC}"
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16
echo -e "${GREEN}✓ PostgreSQL installé${NC}"

# Installation Nginx
echo ""
echo -e "${BLUE}🌐 Installation Nginx...${NC}"
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
echo -e "${GREEN}✓ Nginx installé${NC}"

# Installation PM2
echo ""
echo -e "${BLUE}⚙️  Installation PM2...${NC}"
sudo npm install -g pm2
echo -e "${GREEN}✓ PM2 installé${NC}"

# Installation outils
echo ""
echo -e "${BLUE}🔧 Installation des outils...${NC}"
sudo apt install -y git curl wget unzip certbot python3-certbot-nginx
echo -e "${GREEN}✓ Outils installés${NC}"

# Configuration PostgreSQL
echo ""
echo -e "${BLUE}🛢️  Configuration PostgreSQL...${NC}"
read -p "Mot de passe pour la base de données (min 12 caractères): " DB_PASSWORD
if [ ${#DB_PASSWORD} -lt 12 ]; then
    echo -e "${RED}❌ Le mot de passe doit contenir au moins 12 caractères${NC}"
    exit 1
fi

sudo -u postgres psql << EOF
CREATE DATABASE decor_analytics;
CREATE USER decor_user WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE decor_analytics TO decor_user;
ALTER DATABASE decor_analytics OWNER TO decor_user;
\q
EOF

echo -e "${GREEN}✓ Base de données configurée${NC}"
echo -e "${YELLOW}📝 DATABASE_URL: postgresql://decor_user:$DB_PASSWORD@localhost:5432/decor_analytics${NC}"

# Cloner le projet
echo ""
echo -e "${BLUE}📂 Création des dossiers...${NC}"
mkdir -p /home/ubuntu/apps
cd /home/ubuntu/apps

if [ -d "decor-analytics" ]; then
    echo -e "${YELLOW}⚠️  Le dossier decor-analytics existe déjà${NC}"
else
    echo -e "${BLUE}📥 Clonage du projet depuis GitHub...${NC}"
    git clone https://github.com/starfeu1331-jpg/MS-v2.git decor-analytics
    cd decor-analytics
    echo -e "${GREEN}✓ Projet cloné${NC}"
fi

cd /home/ubuntu/apps/decor-analytics

# Créer le fichier .env.production
echo ""
echo -e "${BLUE}📝 Création du fichier .env.production...${NC}"
cat > .env.production << EOF
NODE_ENV=production
DATABASE_URL="postgresql://decor_user:$DB_PASSWORD@localhost:5432/decor_analytics"
PORT=3000
EOF
echo -e "${GREEN}✓ Fichier .env.production créé${NC}"

# Installer les dépendances
echo ""
echo -e "${BLUE}📦 Installation des dépendances npm...${NC}"
npm install
echo -e "${GREEN}✓ Dépendances installées${NC}"

# Générer Prisma Client
echo ""
echo -e "${BLUE}🔧 Génération du client Prisma...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma client généré${NC}"

# Appliquer le schéma de base de données
echo ""
echo -e "${BLUE}🛢️  Application du schéma de base de données...${NC}"
npx prisma db push
echo -e "${GREEN}✓ Schéma appliqué${NC}"

# Build de l'application
echo ""
echo -e "${BLUE}🏗️  Build de l'application...${NC}"
npm run build
echo -e "${GREEN}✓ Application buildée${NC}"

# Démarrage avec PM2
echo ""
echo -e "${BLUE}🚀 Démarrage de l'application avec PM2...${NC}"
NODE_ENV=production pm2 start server.js --name decor-analytics
pm2 save
pm2 startup
echo -e "${GREEN}✓ Application démarrée${NC}"

# Configuration Nginx
echo ""
echo -e "${BLUE}🌐 Configuration Nginx...${NC}"
sudo tee /etc/nginx/sites-available/decor-analytics > /dev/null << 'EOF'
server {
    listen 80;
    server_name decordb.fr www.decordb.fr;

    access_log /var/log/nginx/decor-analytics-access.log;
    error_log /var/log/nginx/decor-analytics-error.log;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/decor-analytics /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
echo -e "${GREEN}✓ Nginx configuré${NC}"

# Configuration SSL
echo ""
echo -e "${BLUE}🔒 Configuration SSL avec Let's Encrypt...${NC}"
echo -e "${YELLOW}Assurez-vous que decordb.fr pointe vers ce serveur (91.134.137.123)${NC}"
read -p "Le domaine est-il configuré ? (o/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    read -p "Votre email pour Let's Encrypt: " EMAIL
    sudo certbot --nginx -d decordb.fr -d www.decordb.fr --non-interactive --agree-tos -m $EMAIL
    echo -e "${GREEN}✓ SSL configuré${NC}"
else
    echo -e "${YELLOW}⚠️  Configuration SSL à faire manuellement plus tard:${NC}"
    echo -e "   sudo certbot --nginx -d decordb.fr -d www.decordb.fr"
fi

# Configuration du firewall
echo ""
echo -e "${BLUE}🔥 Configuration du firewall...${NC}"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
echo "y" | sudo ufw enable
echo -e "${GREEN}✓ Firewall configuré${NC}"

# Récapitulatif
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ Configuration terminée ! 🎉          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📊 Informations importantes:${NC}"
echo -e "   Database URL: postgresql://decor_user:$DB_PASSWORD@localhost:5432/decor_analytics"
echo -e "   Application: http://decordb.fr (ou https si SSL configuré)"
echo ""
echo -e "${BLUE}📋 Commandes utiles:${NC}"
echo -e "   ${YELLOW}pm2 status${NC}                  - État de l'application"
echo -e "   ${YELLOW}pm2 logs decor-analytics${NC}   - Voir les logs"
echo -e "   ${YELLOW}pm2 restart decor-analytics${NC} - Redémarrer"
echo ""
echo -e "${YELLOW}⚠️  Sauvegardez le mot de passe de la base de données !${NC}"
echo ""
