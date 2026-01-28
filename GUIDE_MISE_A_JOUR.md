# 📊 Guide de Mise à Jour des Données

## 🎯 Résumé

Tu as maintenant un workflow complet pour mettre à jour la base de données PostgreSQL avec tes exports Sage.

## 🛠️ Scripts Disponibles

### 1. **Workflow Automatique** (Recommandé) ⭐
```bash
./scripts/update-workflow.sh
```

Ce script fait TOUT automatiquement :
- ✅ Convertit tes CSV Sage au bon format
- ✅ Te demande quel type de mise à jour (hebdomadaire ou quotidienne)
- ✅ Charge les données dans PostgreSQL
- ✅ Nettoie les fichiers temporaires

**Usage :**
```bash
cd /Users/marceau/Desktop/test\ data/decor-analytics
./scripts/update-workflow.sh

# Il te demandera :
# 1. Où sont tes fichiers CSV Sage ?
#    → /Users/marceau/Desktop/Data update/Data avant
# 
# 2. Type de mise à jour ?
#    → 1 = Hebdomadaire (EFFACE tout)
#    → 2 = Quotidienne (AJOUTE seulement les nouveaux)
```

---

### 2. **Scripts Individuels** (Pour utilisateurs avancés)

#### a) Conversion CSV
```bash
python3 scripts/convert-csv-format.py <dossier_source> <dossier_sortie>
```

Convertit les exports Sage (`;` séparateur, dates DD/MM/YYYY) au format PostgreSQL.

**Fichiers attendus :**
- `détail transactions.csv` → `transactions.csv`
- `client.csv` → `clients.csv`
- `Produits.csv` → `produits.csv`
- `Points de vente.csv` → `depots.csv`

#### b) Chargement Complet (Hebdomadaire)
```bash
./scripts/load-to-postgres.sh <dossier_csv>
```

⚠️ **ATTENTION : SUPPRIME TOUTES LES DONNÉES EXISTANTES**

#### c) Mise à Jour Incrémentale (Quotidienne)
```bash
python3 scripts/test-daily-update.py <fichier_transactions.csv>
```

Ajoute seulement les transactions avec des dates > date max dans la BDD.

---

## 📁 Format des Fichiers Source (Sage)

### Transactions (`détail transactions.csv`)
```
N° Carte fidélité;N° Facture client;Dépôt;Date facture;N° Produit;Quantité unitaire;Prix vente net en devise société
1918523;191452141;19;08/01/2022;58564;1;7,55
```

### Clients (`client.csv`)
```
N° Carte fidélité;Date création;Statut;Date de validité;Civilité;Date de naissance;Sexe;C.P;Ville;...
0;;22/09/2012;;;;;;
```

### Produits (`Produits.csv`)
```
N° Produit;Famille;Sous famille;Sous sous famille;Sous sous sous famille
5003;Sol;Moquette;;
```

---

## ✅ Tests Effectués

### Test 1 : Chargement Initial (Hebdomadaire)
```bash
./scripts/load-to-postgres.sh converted-data-avant

Résultat :
✅ 407,210 transactions
✅ 591,734 clients
✅ 55,730 produits
✅ 23 dépôts
```

### Test 2 : Mise à Jour Incrémentale (Quotidienne)
```bash
python3 scripts/test-daily-update.py converted-data-apres/transactions.csv

Résultat :
✅ 17,578 nouvelles transactions ajoutées
📅 Date max avant: 2022-04-07
📅 Date max après: 2022-04-11
📊 Total: 424,788 transactions
```

---

## 🔧 Dépannage

### Problème : "No such file or directory"
→ Vérifie que tu es dans le bon dossier : `cd /Users/marceau/Desktop/test\ data/decor-analytics`

### Problème : "Permission denied"
→ Rends les scripts exécutables : `chmod +x scripts/*.sh scripts/*.py`

### Problème : Encodage des caractères
→ Le script `convert-csv-format.py` détecte automatiquement l'encodage avec `chardet`

### Problème : Colonnes manquantes
→ Les scripts gèrent automatiquement les colonnes manquantes (cp, ville, etc.)

---

## 🎨 Interface Web (Settings)

L'interface drag & drop dans Settings fonctionne **seulement pour les petits fichiers** (<4.5 MB).

Pour les gros exports Sage, **utilise les scripts** ci-dessus.

---

## 📅 Workflow Recommandé

### Mise à Jour Hebdomadaire (Dimanche)
```bash
./scripts/update-workflow.sh
# Choix 1 = Hebdomadaire
# → Dossier : /Users/marceau/Desktop/Data update/Data semaine
```

### Mise à Jour Quotidienne (Lundi-Samedi)
```bash
./scripts/update-workflow.sh
# Choix 2 = Quotidienne
# → Dossier : /Users/marceau/Desktop/Data update/Data jour
```

---

## 🚀 Performances

| Opération | Temps | Transactions |
|-----------|-------|--------------|
| Conversion CSV | ~10s | 400k |
| Chargement PostgreSQL | ~5s | 400k |
| Mise à jour incrémentale | ~2s | 17k |

**Total : ~15 secondes** pour un chargement complet de 400k transactions 🚀

---

## 📊 Vérification

Après chaque mise à jour, vérifie que tout fonctionne :

1. **Dashboard** : https://ms-v2.vercel.app
2. **API Test** :
   ```bash
   curl "https://ms-v2.vercel.app/api/dashboard?year=2022"
   ```

---

## 🎯 Prochaines Améliorations

- [ ] Interface web pour upload de gros fichiers (streaming)
- [ ] Automatisation via cron job
- [ ] Notifications email après mise à jour
- [ ] Validation des données avant chargement
- [ ] Rollback en cas d'erreur

---

**Dernière mise à jour : 28 janvier 2026**
