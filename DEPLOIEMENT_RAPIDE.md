# 🚀 Déploiement Rapide OVH - Decor Analytics

Guide simplifié pour déployer l'application sur votre serveur OVH.

---

## 📋 Informations Serveur

- **IP VPS**: `91.134.137.123`
- **Domaine**: `decordb.fr`
- **Utilisateur SSH**: `ubuntu`

---

## 🎯 DÉPLOIEMENT EN 3 ÉTAPES

### ÉTAPE 1: Configuration Initiale du Serveur (UNE SEULE FOIS)

1. **Copier le script de configuration sur le serveur**

```bash
# Depuis votre Mac
cd "/Users/marceau/Desktop/test data/decor-analytics"
scp setup-ovh.sh ubuntu@91.134.137.123:/home/ubuntu/
```

2. **Se connecter au serveur et exécuter le script**

```bash
# Connexion SSH
ssh ubuntu@91.134.137.123

# Rendre le script exécutable et le lancer
chmod +x setup-ovh.sh
./setup-ovh.sh
```

Le script va automatiquement:
- ✅ Installer Node.js, PostgreSQL, Nginx, PM2
- ✅ Configurer la base de données
- ✅ Cloner le projet depuis GitHub
- ✅ Builder l'application
- ✅ Configurer Nginx et SSL
- ✅ Démarrer l'application avec PM2

⏱️ **Durée**: 15-20 minutes

---

### ÉTAPE 2: Configurer le DNS OVH

1. Aller sur [ovh.com](https://ovh.com) > Domaines > decordb.fr
2. Onglet **"Zone DNS"**
3. Ajouter/modifier ces enregistrements:

| Type | Nom | Cible |
|------|-----|-------|
| A | @ | 91.134.137.123 |
| A | www | 91.134.137.123 |

4. Attendre 5-30 minutes pour la propagation DNS

5. **Vérifier** depuis votre Mac:
```bash
ping decordb.fr
# Doit répondre avec 91.134.137.123
```

---

### ÉTAPE 3: Déploiements Futurs (À CHAQUE MISE À JOUR)

**Depuis votre Mac, simplement:**

```bash
cd "/Users/marceau/Desktop/test data/decor-analytics"
chmod +x deploy.sh
./deploy.sh
```

Ce script va automatiquement:
1. ✅ Commiter et pousser sur GitHub
2. ✅ Se connecter au serveur OVH
3. ✅ Récupérer le code
4. ✅ Installer les dépendances
5. ✅ Builder l'application
6. ✅ Redémarrer l'app

⏱️ **Durée**: 2-3 minutes

---

## 🌐 Accès à l'Application

Une fois déployé, votre application sera accessible sur:

- **HTTP**: http://decordb.fr
- **HTTPS**: https://decordb.fr (si SSL configuré)

---

## 📊 Commandes Utiles

### Voir les logs de l'application

```bash
ssh ubuntu@91.134.137.123 "pm2 logs decor-analytics"
```

### Redémarrer l'application

```bash
ssh ubuntu@91.134.137.123 "pm2 restart decor-analytics"
```

### État de l'application

```bash
ssh ubuntu@91.134.137.123 "pm2 status"
```

### Se connecter au serveur

```bash
ssh ubuntu@91.134.137.123
```

---

## ⚠️ En cas de problème

### 1. L'application ne démarre pas

```bash
ssh ubuntu@91.134.137.123
cd /home/ubuntu/apps/decor-analytics
pm2 logs decor-analytics --lines 100
```

### 2. Erreur de connexion base de données

```bash
ssh ubuntu@91.134.137.123
cd /home/ubuntu/apps/decor-analytics
cat .env.production
# Vérifier le DATABASE_URL
```

### 3. Site inaccessible

```bash
ssh ubuntu@91.134.137.123
sudo systemctl status nginx
sudo nginx -t
```

### 4. Reconfigurer SSL manuellement

```bash
ssh ubuntu@91.134.137.123
sudo certbot --nginx -d decordb.fr -d www.decordb.fr
```

---

## 🔄 Import des Données

Pour importer vos données CSV sur le serveur:

```bash
# Depuis votre Mac
cd "/Users/marceau/Desktop/test data/decor-analytics"
scp -r data/nouveaux ubuntu@91.134.137.123:/home/ubuntu/apps/decor-analytics/data/

# Sur le serveur
ssh ubuntu@91.134.137.123
cd /home/ubuntu/apps/decor-analytics
python3 scripts/import-new-data-feb2026.py
```

---

## ✅ Checklist de Déploiement

- [ ] Configuration initiale du serveur (ÉTAPE 1) ✨
- [ ] DNS configuré et propagé (ÉTAPE 2) 🌐
- [ ] SSL configuré (Let's Encrypt) 🔒
- [ ] Application accessible sur https://decordb.fr ✅
- [ ] Import des données effectué 📊
- [ ] Tests des APIs (/api/dashboard, etc.) 🧪

---

## 📞 Support

Si vous rencontrez un problème:

1. Vérifier les logs: `pm2 logs decor-analytics`
2. Vérifier l'état: `pm2 status`
3. Vérifier Nginx: `sudo systemctl status nginx`
4. Consulter le guide complet: `GUIDE_DEPLOIEMENT_OVH.md`

---

**Bon déploiement ! 🚀**
