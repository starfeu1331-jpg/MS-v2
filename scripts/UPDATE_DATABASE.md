# 🔄 Scripts de Mise à Jour de la Base de Données

## 📋 Vue d'ensemble

Deux scripts pour maintenir la base de données à jour :

1. **`update-daily.py`** : Mise à jour **incrémentale** quotidienne (vers minuit)
2. **`update-weekly.py`** : Mise à jour **complète** hebdomadaire (dimanche)

---

## 📁 Préparation des fichiers

### Placer les fichiers CSV dans `data/nouveaux/`

Les 4 fichiers CSV doivent être au format suivant :

#### **transactions.csv**
```csv
facture,date,carte,depot,produit,ca,quantite
FAC001,2025-01-28,CL123,MAG01,PROD456,150.50,2
```

#### **clients.csv**
```csv
carte,ville,cp
CL123,PARIS,75001
```

#### **produits.csv**
```csv
id,famille,sous_famille,sous_sous_famille,sous_sous_sous_famille
PROD456,Décoration,Vases,Vases grands,Vases modernes
```

#### **depots.csv** (optionnel)
```csv
code,nom
MAG01,Magasin Paris Centre
WEB,Boutique en ligne
```

---

## 🌅 Mise à jour quotidienne (Incrémentale)

**Quand ?** Chaque soir vers minuit, pour avoir les données du jour disponibles le matin.

### Étapes :

1. **Placer les nouveaux fichiers CSV dans `data/nouveaux/`**
   - `transactions.csv` : **OBLIGATOIRE** (transactions du jour)
   - `clients.csv` : Optionnel (nouveaux clients seulement)
   - `produits.csv` : Optionnel (nouveaux produits seulement)

2. **Exécuter le script**
   ```bash
   python scripts/update-daily.py
   ```

3. **Vérifier les logs**
   ```
   [2025-01-28 23:55:00] 🚀 Démarrage mise à jour JOURNALIÈRE
   [2025-01-28 23:55:01] ✅ Connexion à Neon PostgreSQL établie
   [2025-01-28 23:55:02] 📥 Insertion de 1,234 nouvelles transactions...
   [2025-01-28 23:55:05] ✅ 1,234 transactions insérées
   [2025-01-28 23:55:06] ✅ MISE À JOUR TERMINÉE
   ```

### Comportement :
- ✅ **Ajoute** les nouvelles données sans supprimer l'existant
- ⚡ **Rapide** (quelques secondes)
- 🔄 **Sans risque** (pas de suppression)

---

## 🗓️ Mise à jour hebdomadaire (Complète)

**Quand ?** Chaque **dimanche** pour garantir l'intégrité des données.

### Étapes :

1. **Placer TOUS les fichiers CSV à jour dans `data/nouveaux/`**
   - `transactions.csv` : **TOUTES** les transactions (pas juste du jour)
   - `clients.csv` : **TOUS** les clients
   - `produits.csv` : **TOUS** les produits
   - `depots.csv` : Optionnel (tous les magasins)

2. **Exécuter le script**
   ```bash
   python scripts/update-weekly.py
   ```

3. **Confirmer l'opération**
   ```
   ⚠️  ATTENTION: Cette opération va SUPPRIMER TOUTES les données !
   
   Tapez 'OUI' en majuscules pour confirmer: OUI
   ```

4. **Vérifier les logs**
   ```
   [2025-01-26 02:00:00] 🚀 Démarrage mise à jour HEBDOMADAIRE
   [2025-01-26 02:00:05] 🗑️  Suppression des tables existantes...
   [2025-01-26 02:00:06] 🏗️  Création des tables...
   [2025-01-26 02:00:10] 📥 Chargement de 144,806 clients...
   [2025-01-26 02:00:15] 📥 Chargement de 15,234 produits...
   [2025-01-26 02:00:20] 📥 Chargement de 709,121 transactions...
   [2025-01-26 02:05:30] ⚡ Création des index...
   [2025-01-26 02:06:00] ✅ RECRÉATION COMPLÈTE TERMINÉE
   ```

### Comportement :
- 🗑️ **Supprime** toutes les tables existantes
- 🏗️ **Recrée** les tables from scratch
- 📥 **Recharge** toutes les données
- ⚡ **Optimise** avec index et VACUUM
- ⏱️ **Plus long** (quelques minutes selon volume)
- ✅ **Garantit** l'intégrité complète

---

## 🚨 Sécurité

### Variables d'environnement requises

Le fichier `.env` doit contenir :
```bash
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

### Fichier .gitignore

Les CSV contenant des données ne doivent **JAMAIS** être committés :
```gitignore
data/nouveaux/*.csv
*.csv
```

---

## 📊 Monitoring

### Vérifier l'état de la base

Après chaque mise à jour, vérifier dans l'interface :
- **Paramètres** > **Base de Données**
- Voir le nombre de transactions, clients, produits

### Logs à surveiller

✅ **Succès** : Tous les messages avec ✅
⚠️  **Avertissements** : Messages avec ⚠️ (non bloquants)
❌ **Erreurs** : Messages avec ❌ (opération échouée)

---

## 🔧 Dépannage

### Erreur : "DATABASE_URL non définie"
```bash
# Vérifier le fichier .env
cat .env | grep DATABASE_URL

# Si absent, ajouter :
echo "DATABASE_URL=postgresql://..." >> .env
```

### Erreur : "Fichier CSV introuvable"
```bash
# Vérifier la présence des fichiers
ls -lh data/nouveaux/

# S'assurer que les fichiers sont au bon endroit
# et ont les bons noms (transactions.csv, clients.csv, etc.)
```

### Erreur : "Permission denied"
```bash
# Rendre les scripts exécutables
chmod +x scripts/update-daily.py
chmod +x scripts/update-weekly.py
```

### Erreur de connexion PostgreSQL
```bash
# Tester la connexion manuellement
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM transactions"
```

---

## 📅 Planning recommandé

| Jour | Heure | Script | Fichiers requis |
|------|-------|--------|-----------------|
| Lundi - Samedi | 23:55 | `update-daily.py` | transactions.csv du jour |
| Dimanche | 02:00 | `update-weekly.py` | TOUS les CSV complets |

---

## 🔮 Automatisation future

Une fois les scripts testés et validés manuellement, ils pourront être automatisés via :

- **Cron** (Linux/Mac) :
  ```bash
  # Quotidien à 23:55
  55 23 * * 1-6 cd /path/to/project && python scripts/update-daily.py
  
  # Hebdomadaire dimanche à 02:00
  0 2 * * 0 cd /path/to/project && python scripts/update-weekly.py
  ```

- **GitHub Actions** :
  - Workflow déclenché par upload de CSV
  - Exécution automatique dans le cloud

- **Vercel Cron Jobs** :
  - Jobs serverless programmés
  - Intégration native avec le deployment

---

## ✅ Checklist avant production

- [ ] Variables d'environnement configurées
- [ ] Fichiers CSV au bon format
- [ ] Test du script daily avec données fictives
- [ ] Test du script weekly avec backup
- [ ] Vérification des logs
- [ ] Monitoring des stats dans l'interface
- [ ] Documentation à jour
- [ ] Procédure de rollback définie

---

## 📞 Support

En cas de problème, vérifier :
1. Les logs de l'exécution
2. La connexion à la base de données
3. Le format des fichiers CSV
4. Les permissions d'accès aux fichiers
