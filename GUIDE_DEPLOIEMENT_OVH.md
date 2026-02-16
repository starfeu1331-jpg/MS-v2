# 🚀 GUIDE DÉPLOIEMENT OVH - Decor Analytics

Guide complet pour déployer l'application sur VPS OVH (Ubuntu 22.04)

---

## 📋 PRÉREQUIS

Vous devez avoir :
- ✅ VPS OVH commandé et livré
- ✅ Identifiants SSH reçus par email
- ✅ Nom de domaine commandé et configuré
- ✅ Code du projet prêt (Git ou upload)

**Temps estimé : 2-3 heures**

---

## ÉTAPE 1 : PREMIÈRE CONNEXION AU VPS

### 1.1 - Récupérer vos identifiants

OVH vous a envoyé un email avec :
```
IP du serveur : 51.XX.XX.XX
Login : ubuntu (ou root)
Mot de passe : XXXXX
```

### 1.2 - Se connecter en SSH

```bash
# Depuis votre Mac
ssh ubuntu@51.XX.XX.XX
# Entrer le mot de passe quand demandé
```

### 1.3 - Changer le mot de passe root (sécurité)

```bash
sudo passwd ubuntu
# Entrer un nouveau mot de passe sécurisé
```

---

## ÉTAPE 2 : INSTALLATION DES DÉPENDANCES

### 2.1 - Mise à jour système

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 - Installation Node.js 20

```bash
# Installer Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier
node --version  # Doit afficher v20.x.x
npm --version
```

### 2.3 - Installation PostgreSQL 16

```bash
# Ajouter le repo PostgreSQL officiel
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update

# Installer PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-contrib-16

# Vérifier
sudo systemctl status postgresql
```

### 2.4 - Installation Nginx

```bash
sudo apt install -y nginx

# Démarrer et activer au boot
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2.5 - Installation PM2 (process manager)

```bash
sudo npm install -g pm2
pm2 --version
```

### 2.6 - Installation Git et outils

```bash
sudo apt install -y git curl wget unzip certbot python3-certbot-nginx
```

---

## ÉTAPE 3 : CONFIGURATION POSTGRESQL

### 3.1 - Créer la base de données et l'utilisateur

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Dans psql, exécuter :
CREATE DATABASE decor_analytics;
CREATE USER decor_user WITH PASSWORD 'VotreMotDePasseSecurise123!';
GRANT ALL PRIVILEGES ON DATABASE decor_analytics TO decor_user;
ALTER DATABASE decor_analytics OWNER TO decor_user;
\q
```

### 3.2 - Configuration pour connexion locale

```bash
# Éditer pg_hba.conf
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Ajouter cette ligne AVANT les autres règles :
# local   all             decor_user                              md5

# Redémarrer PostgreSQL
sudo systemctl restart postgresql
```

### 3.3 - Tester la connexion

```bash
psql -U decor_user -d decor_analytics -h localhost
# Entrer le mot de passe
# Si ça marche : \q pour quitter
```

### 3.4 - Noter votre DATABASE_URL

```
DATABASE_URL="postgresql://decor_user:VotreMotDePasseSecurise123!@localhost:5432/decor_analytics"
```

---

## ÉTAPE 4 : DÉPLOYER LE CODE

### 4.1 - Créer le dossier de l'application

```bash
cd /home/ubuntu
mkdir -p apps
cd apps
```

### 4.2 - Option A : Cloner depuis Git (recommandé)

```bash
# Si vous avez poussé sur GitHub/GitLab
git clone https://github.com/VotreUsername/decor-analytics.git
cd decor-analytics
```

### 4.2 - Option B : Upload depuis votre Mac

```bash
# Depuis votre Mac (nouveau terminal)
cd "/Users/marceau/Desktop/test data/decor-analytics"

# Créer une archive sans node_modules
tar --exclude='node_modules' --exclude='.git' --exclude='data' -czf decor-analytics.tar.gz .

# Envoyer sur le serveur
scp decor-analytics.tar.gz ubuntu@51.XX.XX.XX:/home/ubuntu/apps/

# Retour sur le serveur SSH
cd /home/ubuntu/apps
tar -xzf decor-analytics.tar.gz
mkdir decor-analytics
mv * decor-analytics/ 2>/dev/null || true
cd decor-analytics
```

### 4.3 - Installer les dépendances

```bash
npm install
```

### 4.4 - Créer le fichier .env

```bash
nano .env.production
```

Copier ce contenu :

```env
NODE_ENV=production
DATABASE_URL="postgresql://decor_user:VotreMotDePasseSecurise123!@localhost:5432/decor_analytics"
PORT=3000
```

Sauvegarder : `Ctrl+O`, `Enter`, `Ctrl+X`

---

## ÉTAPE 5 : SETUP DE LA BASE DE DONNÉES

### 5.1 - Générer Prisma Client

```bash
npx prisma generate
```

### 5.2 - Appliquer le schéma

```bash
npx prisma db push
```

### 5.3 - (Optionnel) Importer vos données

```bash
# Si vous avez des scripts d'import
# Option 1 : Upload les CSV depuis votre Mac
# Option 2 : Restaurer un dump PostgreSQL
```

---

## ÉTAPE 6 : BUILD DU FRONTEND

### 6.1 - Builder l'application React

```bash
npm run build
```

Cela crée le dossier `dist/` avec votre frontend compilé.

---

## ÉTAPE 7 : CRÉER LE SERVEUR NODE.JS

### 7.1 - Créer server.js

```bash
nano server.js
```

Copier ce code :

```javascript
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Charger les variables d'environnement
config({ path: '.env.production' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Servir les fichiers statiques du build Vite
app.use(express.static(join(__dirname, 'dist')));

// Routes API
import dashboardApi from './api/dashboard.js';
import rfmApi from './api/rfm.js';
import cohortesApi from './api/cohortes.js';
import storesApi from './api/stores.js';
import crossSellingApi from './api/cross-selling.js';
import abcAnalysisApi from './api/abc-analysis.js';
import subFamiliesApi from './api/sub-families.js';
import marketingApi from './api/marketing.js';
import forecastApi from './api/forecast.js';
import exportApi from './api/export.js';
import searchApi from './api/search.js';

// Monter les routes API
app.get('/api/dashboard', dashboardApi);
app.get('/api/rfm', rfmApi);
app.get('/api/cohortes', cohortesApi);
app.get('/api/stores', storesApi);
app.get('/api/cross-selling', crossSellingApi);
app.get('/api/abc-analysis', abcAnalysisApi);
app.get('/api/sub-families', subFamiliesApi);
app.get('/api/marketing', marketingApi);
app.get('/api/forecast', forecastApi);
app.get('/api/export', exportApi);
app.get('/api/search', searchApi);

// Toutes les autres routes = frontend React
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});
```

Sauvegarder : `Ctrl+O`, `Enter`, `Ctrl+X`

### 7.2 - Modifier package.json

```bash
nano package.json
```

Ajouter dans "scripts" :

```json
"start": "node server.js"
```

---

## ÉTAPE 8 : LANCER AVEC PM2

### 8.1 - Démarrer l'application

```bash
NODE_ENV=production pm2 start server.js --name decor-analytics
```

### 8.2 - Vérifier que ça tourne

```bash
pm2 status
pm2 logs decor-analytics

# Tester localement
curl http://localhost:3000
```

### 8.3 - Sauvegarder la config PM2

```bash
pm2 save
pm2 startup
# Copier-coller la commande affichée et l'exécuter
```

---

## ÉTAPE 9 : CONFIGURATION NGINX

### 9.1 - Créer la config Nginx

```bash
sudo nano /etc/nginx/sites-available/decor-analytics
```

Copier ce contenu (remplacer `votre-domaine.fr`) :

```nginx
server {
    listen 80;
    server_name votre-domaine.fr www.votre-domaine.fr;

    # Logs
    access_log /var/log/nginx/decor-analytics-access.log;
    error_log /var/log/nginx/decor-analytics-error.log;

    # Proxy vers Node.js
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
        
        # Timeouts pour les grosses requêtes
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Sauvegarder : `Ctrl+O`, `Enter`, `Ctrl+X`

### 9.2 - Activer le site

```bash
sudo ln -s /etc/nginx/sites-available/decor-analytics /etc/nginx/sites-enabled/
sudo nginx -t  # Vérifier la config
sudo systemctl reload nginx
```

---

## ÉTAPE 10 : CONFIGURER LE DOMAINE

### 10.1 - Dans l'interface OVH

1. Aller sur ovh.com > Domaines > Votre domaine
2. Onglet "Zone DNS"
3. Ajouter/modifier :
   - Type `A` : `@` → `51.XX.XX.XX` (IP de votre VPS)
   - Type `A` : `www` → `51.XX.XX.XX`

### 10.2 - Attendre la propagation DNS (5-30 minutes)

```bash
# Tester depuis votre Mac
ping votre-domaine.fr
```

---

## ÉTAPE 11 : ACTIVER HTTPS (SSL)

### 11.1 - Obtenir un certificat Let's Encrypt

```bash
sudo certbot --nginx -d votre-domaine.fr -d www.votre-domaine.fr
```

Suivre les instructions :
- Entrer votre email
- Accepter les CGU
- Accepter la redirection HTTPS

### 11.2 - Auto-renouvellement

```bash
# Tester le renouvellement
sudo certbot renew --dry-run

# C'est automatique, rien à faire !
```

---

## ÉTAPE 12 : IMPORT DES DONNÉES

### 12.1 - Upload des CSV depuis votre Mac

```bash
# Depuis votre Mac
cd "/Users/marceau/Desktop/test data/decor-analytics"
scp -r data/nouveaux ubuntu@51.XX.XX.XX:/home/ubuntu/apps/decor-analytics/data/
```

### 12.2 - Lancer l'import sur le serveur

```bash
# Sur le serveur
cd /home/ubuntu/apps/decor-analytics
python3 scripts/import-new-data-feb2026.py
```

---

## ÉTAPE 13 : VÉRIFICATION FINALE

### 13.1 - Checklist

```bash
# Sur le serveur
pm2 status               # ✅ App running
sudo systemctl status postgresql  # ✅ DB running
sudo systemctl status nginx       # ✅ Nginx running
```

### 13.2 - Tests

1. **Test local** : `curl http://localhost:3000`
2. **Test domaine** : Ouvrir `http://votre-domaine.fr` dans le navigateur
3. **Test HTTPS** : `https://votre-domaine.fr`
4. **Test API** : `https://votre-domaine.fr/api/dashboard?year=all`

---

## 🎉 TERMINÉ !

Votre application est maintenant en ligne sur :
- 🌐 **https://votre-domaine.fr**

---

## 📝 COMMANDES UTILES

### PM2 (gestion app)

```bash
pm2 status                    # État
pm2 restart decor-analytics   # Redémarrer
pm2 logs decor-analytics      # Voir les logs
pm2 stop decor-analytics      # Arrêter
pm2 delete decor-analytics    # Supprimer
```

### Nginx

```bash
sudo nginx -t                 # Tester la config
sudo systemctl reload nginx   # Recharger
sudo systemctl restart nginx  # Redémarrer
sudo tail -f /var/log/nginx/decor-analytics-error.log  # Logs
```

### PostgreSQL

```bash
sudo -u postgres psql         # Console PostgreSQL
sudo systemctl status postgresql  # État
```

### Mise à jour du code

```bash
cd /home/ubuntu/apps/decor-analytics
git pull                      # Si Git
npm install                   # Nouvelles dépendances
npm run build                 # Rebuild frontend
pm2 restart decor-analytics   # Redémarrer
```

---

## ⚠️ EN CAS DE PROBLÈME

### L'app ne démarre pas

```bash
pm2 logs decor-analytics --lines 100
# Regarder l'erreur
```

### Erreur de connexion BDD

```bash
# Vérifier les credentials
cat .env.production

# Tester la connexion
psql -U decor_user -d decor_analytics -h localhost
```

### Site inaccessible

```bash
# Vérifier Nginx
sudo nginx -t
sudo systemctl status nginx

# Vérifier les logs
sudo tail -f /var/log/nginx/decor-analytics-error.log
```

### Certificat SSL expiré

```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## 🔒 SÉCURITÉ

### Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Fail2ban (protection brute force)

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

---

**Bon déploiement ! 🚀**
