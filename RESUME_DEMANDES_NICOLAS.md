# 📋 RÉSUMÉ EXÉCUTIF - Améliorations CSV urgentes

**Destinataire:** Nicolas (Responsable Informatique)  
**Date:** 30 janvier 2026  
**Sujet:** Colonnes manquantes bloquantes pour l'application analytics

---

## 🔴 3 PROBLÈMES CRITIQUES À CORRIGER EN PRIORITÉ

### 1️⃣ **IMPOSSIBLE DE DISTINGUER WEB vs MAGASIN**
```
Fichier: détail transactions.csv
Action: AJOUTER colonne "Canal" avec valeurs "WEB" ou "MAGASIN"
Impact si pas corrigé: 50% des statistiques de l'appli sont fausses
```

### 2️⃣ **AUCUNE INFO DE CONTACT CLIENT**
```
Fichier: client.csv
Action: AJOUTER colonnes "Nom", "Prénom", "Email", "Téléphone", "Mobile"
Impact si pas corrigé: Impossible de faire du marketing ou exporter des listes
```

### 3️⃣ **AUCUN NOM DE PRODUIT**
```
Fichier: Produits.csv
Action: AJOUTER colonnes "Nom produit", "Prix vente TTC", "Stock"
Impact si pas corrigé: L'appli affiche juste des codes produits (58564 au lieu de "Rouleau PVC chêne")
```

---

## 📊 COMPARATIF AVANT/APRÈS

### FICHIER CLIENTS - AVANT (actuel)
```csv
N° Carte;Date création;Civilité;Sexe;Nom adresse;CP;Ville
123456;15/06/2020;Mme;F;;69001;LYON
```
❌ Impossible de contacter ce client  
❌ Pas de nom/prénom séparés  
❌ Pas d'email ni téléphone

### FICHIER CLIENTS - APRÈS (demandé)
```csv
N° Carte;Nom;Prénom;Email;Téléphone;Mobile;Civilité;CP;Ville
123456;MARTIN;Sophie;sophie.martin@email.fr;0478123456;0612345678;Mme;69001;LYON
```
✅ Contact complet  
✅ Marketing possible  
✅ Export pour campagnes

---

### FICHIER TRANSACTIONS - AVANT (actuel)
```csv
N° Carte;N° Facture;Dépôt;Date;N° Produit;Quantité;Prix
1918523;191452141;19;08/01/2022;58564;1;7.55
```
❌ Impossible de savoir si c'est une vente web ou magasin  
❌ Le dépôt "19" peut être web ou physique

### FICHIER TRANSACTIONS - APRÈS (demandé)
```csv
N° Carte;N° Facture;Canal;Dépôt;Date;N° Produit;Quantité;Prix
1918523;191452141;MAGASIN;19;08/01/2022;58564;1;7.55
2045678;WEB123456;WEB;WEB;15/01/2022;45789;2;125.90
```
✅ Distinction claire Web/Magasin  
✅ Statistiques précises par canal

---

### FICHIER PRODUITS - AVANT (actuel)
```csv
N° Produit;Famille;Sous famille
58564;Sol;PVC
```
❌ Aucun nom descriptif  
❌ Pas de prix  
❌ Interface utilisateur pauvre

### FICHIER PRODUITS - APRÈS (demandé)
```csv
N° Produit;Nom produit;Famille;Prix vente TTC;Stock;Marque
58564;Rouleau PVC imitation parquet chêne 4m;Sol;89.90;145;QuickStep
```
✅ Nom lisible dans l'interface  
✅ Prix pour calculer marges  
✅ Stock pour disponibilité

---

## ⚡ ACTIONS CONCRÈTES DEMANDÉES

### Pour le fichier **CLIENT.CSV**
```
Colonnes à ajouter:
✓ Nom
✓ Prénom  
✓ Email
✓ Téléphone
✓ Mobile
✓ Opt-in Email (O/N)
✓ Opt-in SMS (O/N)
```

### Pour le fichier **TRANSACTIONS.CSV** (détail transactions.csv)
```
Colonnes à ajouter:
✓ Canal (valeurs: "WEB" ou "MAGASIN")
✓ Montant ligne TTC
✓ Mode paiement
✓ Heure transaction (format HH:MM)
```

### Pour le fichier **PRODUITS.CSV**
```
Colonnes à ajouter:
✓ Nom produit (libellé commercial)
✓ Prix vente TTC
✓ Prix achat HT
✓ Stock disponible
✓ Code EAN
✓ Marque
✓ Statut (Actif/Archivé)
```

### Pour le fichier **POINTS DE VENTE.CSV** (magasins)
```
Colonnes à ajouter:
✓ Téléphone magasin
✓ Email magasin
✓ Horaires
✓ Latitude/Longitude (pour cartographie)
```

---

## 🎯 PLANNING PROPOSÉ

| Délai | Livrable | Impact |
|-------|----------|--------|
| **J+7** | Retour faisabilité technique | Validation approche |
| **J+14** | Livraison urgente: Canal + Email + Nom produit | Déblocage fonctionnalités critiques |
| **J+21** | Livraison complète avec toutes colonnes | Application 100% fonctionnelle |
| **J+30** | Automatisation export quotidien | Données toujours à jour |

---

## 📋 FORMAT TECHNIQUE RECOMMANDÉ

### Encodage et structure
- **Encodage:** UTF-8 avec BOM
- **Séparateur:** `;` (OK actuel)
- **Protection champs:** Guillemets doubles `"` autour de tous les textes
- **Format dates:** `YYYY-MM-DD` (ISO 8601) au lieu de `DD/MM/YYYY`
- **Nommage fichiers:** Sans espaces ni accents (ex: `clients.csv` au lieu de `client.csv`)

### Exemple de ligne bien formatée
```csv
"123456";"MARTIN";"Sophie";"sophie.martin@email.fr";"2020-06-15";"Actif"
```

---

## 💡 BÉNÉFICES BUSINESS

### Avec les corrections demandées:
- ✅ **Marketing:** Envoi campagnes email ciblées
- ✅ **Analytics:** Statistiques Web vs Magasin précises
- ✅ **UX:** Interface riche avec noms produits lisibles
- ✅ **Export:** Listes clients exploitables
- ✅ **Cross-selling:** Recommandations produits intelligentes
- ✅ **Géolocalisation:** Carte des magasins interactive
- ✅ **Pilotage:** KPIs fiables par canal et par magasin

---

## 📞 CONTACT

**Questions / Clarifications:**
- Voir document détaillé: `DEMANDES_CSV_NICOLAS.md`
- [Votre contact]

**Merci de confirmer réception et planning de mise en œuvre** 🙏

---

*Document créé le 30 janvier 2026*
