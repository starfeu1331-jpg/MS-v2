# 📋 DEMANDES D'AMÉLIORATION DES FICHIERS CSV
## Analyse et Recommandations pour Nicolas (Responsable Informatique)

**Date:** 30 janvier 2026  
**Contexte:** Amélioration des données pour l'application d'analytics Décor Discount

---

## 🔴 PROBLÈMES CRITIQUES IDENTIFIÉS

### 1. **Impossible de distinguer les ventes WEB des ventes MAGASIN**
**Impact:** L'application ne peut pas calculer les statistiques Web/Magasin correctement

**Problème actuel:**
- Le fichier `détail transactions.csv` n'a **AUCUNE colonne** indiquant si une transaction vient du site web ou d'un magasin physique
- La colonne "Dépôt" contient uniquement des codes numériques (12, 13, 14, etc.)
- Aucun pattern dans les numéros de facture pour identifier le web

**Solution demandée:**
```
AJOUTER une colonne "Canal" ou "Origine" dans détail transactions.csv
Valeurs possibles: "WEB" ou "MAGASIN"
OU
Ajouter un dépôt spécial avec code "WEB" pour toutes les commandes web
```

**Exemple attendu:**
```csv
N° Carte fidélité;N° Facture client;Dépôt;Canal;Date facture;N° Produit;...
1918523;191452141;19;MAGASIN;08/01/2022;58564;...
2045678;WEB123456;WEB;WEB;15/01/2022;45789;...
```

---

### 2. **Absence totale d'informations de CONTACT client**
**Impact:** Impossible de créer des campagnes marketing, d'exporter des listes clients, ou de personnaliser l'expérience

**Problème actuel:**
Le fichier `client.csv` contient **UNIQUEMENT**:
- N° Carte fidélité
- Date création
- Statut
- Date de validité
- Civilité
- Date de naissance
- Sexe
- **Nom adresse** (mais pas séparé nom/prénom!)
- Adresse postale
- CP, Ville

**Ce qui MANQUE complètement:**
- ❌ **Nom** (séparé)
- ❌ **Prénom** (séparé)
- ❌ **Email**
- ❌ **Téléphone fixe**
- ❌ **Téléphone mobile**
- ❌ **Opt-in marketing** (accepte les communications)
- ❌ **Date dernière modification**

**Solution demandée:**
```csv
AJOUTER ces colonnes dans client.csv:
- Nom
- Prénom
- Email
- Téléphone
- Mobile
- Opt-in Email (O/N)
- Opt-in SMS (O/N)
- Date dernière modification
```

**Exemple attendu:**
```csv
N° Carte;Civilité;Nom;Prénom;Email;Téléphone;Mobile;Opt-in Email;Opt-in SMS;Date naissance;...
123456;Mme;MARTIN;Sophie;sophie.martin@email.fr;0478123456;0612345678;O;N;15/03/1985;...
```

---

### 3. **Informations PRODUITS insuffisantes pour le catalogue web**
**Impact:** Impossible d'afficher des détails produits riches dans l'interface

**Problème actuel:**
Le fichier `Produits.csv` contient **UNIQUEMENT**:
- N° Produit (code technique)
- Famille
- Sous famille
- Sous sous famille
- Sous sous sous famille

**Ce qui MANQUE:**
- ❌ **Nom du produit** (libellé descriptif)
- ❌ **Description**
- ❌ **Prix de vente TTC**
- ❌ **Prix d'achat** (pour calcul marge)
- ❌ **Stock disponible**
- ❌ **Code EAN / Code-barres**
- ❌ **Référence fournisseur**
- ❌ **Statut** (actif/archivé)
- ❌ **URL image produit**
- ❌ **Poids / Dimensions**
- ❌ **Marque**

**Solution demandée:**
```csv
AJOUTER ces colonnes dans Produits.csv:
- Nom produit (libellé commercial)
- Description
- Prix vente TTC
- Prix achat HT
- Stock total
- Code EAN
- Référence fournisseur
- Marque
- Statut (Actif/Archivé)
- URL image
```

**Exemple attendu:**
```csv
N° Produit;Nom produit;Famille;Sous famille;Prix vente TTC;Stock;Code EAN;Marque;Statut;...
58564;Rouleau PVC imitation parquet chêne 4m;Sol;PVC;89.90;145;3254123456789;QuickStep;Actif;...
```

---

### 4. **Fichier TRANSACTIONS incomplet pour l'analyse**
**Impact:** Calculs de CA et statistiques potentiellement faussés

**Problème actuel:**
Le fichier `détail transactions.csv` contient:
- N° Carte fidélité
- N° Facture client
- Dépôt
- Date facture
- N° Produit
- Quantité unitaire
- Prix vente net

**Ce qui MANQUE:**
- ❌ **Montant TTC de la ligne** (CA calculé)
- ❌ **Remise appliquée** (montant ou %)
- ❌ **Mode de paiement** (CB, espèces, chèque)
- ❌ **Statut de la commande** (validée, annulée, retournée)
- ❌ **Heure de la transaction** (pour analyse par heure)
- ❌ **Code vendeur** (pour analyse par vendeur)

**Solution demandée:**
```csv
AJOUTER ces colonnes dans détail transactions.csv:
- Montant ligne TTC
- Remise montant
- Mode paiement
- Statut commande
- Heure transaction
- Code vendeur (optionnel)
```

**Exemple attendu:**
```csv
N° Carte;N° Facture;Dépôt;Canal;Date;Heure;N° Produit;Qté;Prix unit;Montant TTC;Remise;Mode paiement;Statut;...
1918523;191452141;19;MAGASIN;08/01/2022;14:35;58564;1;7.55;7.55;0;CB;Validée;...
```

---

### 5. **Fichier MAGASINS (Points de vente) - Informations de contact manquantes**
**Impact:** Impossible de créer des pages détaillées par magasin ou d'afficher les horaires

**Problème actuel:**
Le fichier `Points de vente.csv` contient:
- Zones magasin
- N° Dépôt
- Intitulé dépôt
- Adresse 1, 2, 3
- CP, Ville

**Ce qui MANQUE:**
- ❌ **Téléphone du magasin**
- ❌ **Email du magasin**
- ❌ **Horaires d'ouverture**
- ❌ **Coordonnées GPS** (latitude/longitude)
- ❌ **Surface du magasin** (m²)
- ❌ **Nombre d'employés**
- ❌ **Date d'ouverture**
- ❌ **Manager/Responsable**

**Solution demandée:**
```csv
AJOUTER ces colonnes dans Points de vente.csv:
- Téléphone
- Email
- Horaires (format libre ou JSON)
- Latitude
- Longitude
- Surface m²
- Manager
```

**Exemple attendu:**
```csv
N° Dépôt;Nom;Adresse;CP;Ville;Téléphone;Email;Latitude;Longitude;Horaires;Manager;...
12;M12 - ALES;10 Lotissement de Larnac;30100;ALES;0466123456;ales@decor.fr;44.125;4.081;Lun-Sam 9h-19h;Jean DUPONT;...
```

---

## 📊 PROBLÈMES DE QUALITÉ DES DONNÉES

### 6. **Données manquantes ou incohérentes**

**Observations:**
- Beaucoup de clients avec carte "0" (client sans carte?)
- Champ "Nom adresse" souvent vide
- Adresses incomplètes (colonnes multiples pas toujours remplies)
- Dates au format texte (problèmes de parsing)

**Solutions demandées:**

#### a) Carte fidélité "0"
```
Clarifier la signification de carte = "0"
Est-ce un client anonyme (passage)?
Si oui, ajouter une colonne "Type client" = "Fidélité" ou "Passage"
```

#### b) Standardisation des dates
```
UNIFORMISER le format des dates:
Format recommandé: YYYY-MM-DD (ISO 8601)
Exemple: 2022-01-08 au lieu de 08/01/2022
Avantage: tri et parsing automatique plus fiables
```

#### c) Nettoyage des adresses
```
Séparer clairement:
- Nom de rue (Adresse ligne 1)
- Complément (Adresse ligne 2)
- Code postal (format normalisé 5 chiffres)
- Ville (en MAJUSCULES)
```

---

## 🎯 NOUVELLES COLONNES POUR ANALYSES AVANCÉES

### 7. **Enrichissement pour le marketing automation**

**Pour le fichier CLIENT:**
```csv
Ajouter:
- Date premier achat
- Date dernier achat
- Nombre total d'achats
- Chiffre d'affaires total
- Panier moyen
- Segment RFM (sera calculé par l'appli mais peut être pré-calculé)
- Canal préféré (Web/Magasin basé sur historique)
- Magasin préféré (code dépôt le plus fréquent)
- Catégorie produit préférée
- Langue préférée (FR/EN/autre)
```

### 8. **Pour la détection des ventes croisées**

**Dans les TRANSACTIONS:**
```csv
Ajouter:
- Montant total facture (somme des lignes)
- Nombre d'articles différents dans la facture
- Flag "Achat multiple" (O/N si plusieurs familles de produits)
```

---

## 📈 DONNÉES POUR LE PILOTAGE BUSINESS

### 9. **Objectifs et budgets**

**Nouveau fichier à créer: `Objectifs.csv`**
```csv
Colonnes suggérées:
- Année
- Mois
- Code dépôt (ou "TOTAL" pour global)
- Objectif CA
- Objectif volume transactions
- Objectif nouveaux clients
- Budget marketing
```

### 10. **Données de coûts**

**Nouveau fichier à créer: `Couts_magasins.csv`**
```csv
Colonnes suggérées:
- Année
- Mois
- Code dépôt
- Loyer
- Charges
- Masse salariale
- Autres frais fixes
```

---

## ⚡ OPTIMISATIONS TECHNIQUES

### 11. **Format et encodage**

**Problèmes actuels:**
- Séparateur `;` (acceptable)
- Encodage parfois problématique avec accents
- Pas de guillemets pour protéger les champs

**Recommandations:**
```
1. Encodage: UTF-8 avec BOM (pour Excel)
2. Séparateur: ; (OK actuel)
3. Guillemets: Entourer tous les champs texte de guillemets doubles
4. Échappement: Doubler les guillemets internes ("Société ""Décor""")
5. Header: Toujours présent en ligne 1
6. Pas de lignes vides
```

### 12. **Nommage des fichiers**

**Actuel:** Noms en français avec espaces
```
Points de vente.csv
Produits.csv
client.csv
détail transactions.csv
```

**Recommandé:** Noms standardisés sans espaces ni accents
```
magasins.csv
produits.csv
clients.csv
transactions.csv
```

Ou avec date de version:
```
clients_2026-01-30.csv
transactions_2026-01-30.csv
```

---

## 🚀 PRIORISATION DES DEMANDES

### 🔴 URGENT (Impact immédiat sur l'application)

1. **Canal Web/Magasin dans transactions** → Sans ça, 50% des statistiques sont fausses
2. **Email + Nom + Prénom dans clients** → Impossible de faire du marketing sinon
3. **Nom du produit dans Produits** → Actuellement on affiche juste des codes

### 🟡 IMPORTANT (Améliore significativement l'application)

4. Prix de vente dans Produits
5. Téléphone dans Clients
6. Montant TTC ligne dans Transactions
7. Horaires et contact dans Magasins

### 🟢 SOUHAITABLE (Pour analyses avancées)

8. Stock produits
9. Mode de paiement dans transactions
10. Objectifs business (nouveau fichier)
11. Coordonnées GPS magasins

---

## 📝 FORMAT DE LIVRAISON IDÉAL

### Structure de dossier recommandée:
```
Data export YYYY-MM-DD/
├── clients.csv
├── produits.csv
├── magasins.csv
├── transactions.csv
├── objectifs.csv (optionnel)
└── README.txt (description des changements)
```

### Fréquence de livraison:
- **Idéal:** Export automatique quotidien (delta ou complet)
- **Minimum:** Export hebdomadaire
- **Format:** CSV UTF-8 avec BOM

---

## 🔧 EXEMPLES CONCRETS DE FICHIERS AMÉLIORÉS

### CLIENT.CSV (version améliorée)
```csv
"N° Carte";"Nom";"Prénom";"Email";"Téléphone";"Mobile";"Opt-in Email";"Opt-in SMS";"Civilité";"Date naissance";"Sexe";"Adresse ligne 1";"Adresse ligne 2";"CP";"Ville";"Date création";"Date dernier achat";"CA total";"Nb achats";"Statut"
"123456";"MARTIN";"Sophie";"sophie.martin@email.fr";"0478123456";"0612345678";"O";"O";"Mme";"1985-03-15";"F";"45 rue de la République";"Bâtiment B";"69001";"LYON";"2020-06-15";"2026-01-25";"2458.90";"12";"Actif"
```

### TRANSACTIONS.CSV (version améliorée)
```csv
"N° Facture";"N° Ligne";"Date";"Heure";"N° Carte";"Canal";"Dépôt";"N° Produit";"Quantité";"Prix unitaire HT";"Montant ligne TTC";"Remise";"Mode paiement";"Statut"
"191452141";"1";"2022-01-08";"14:35";"1918523";"MAGASIN";"19";"58564";"1";"6.29";"7.55";"0";"CB";"Validée"
```

### PRODUITS.CSV (version améliorée)
```csv
"N° Produit";"Nom produit";"Description";"Famille";"Sous famille";"Prix vente TTC";"Prix achat HT";"Stock";"Code EAN";"Marque";"Statut";"URL image"
"58564";"Rouleau PVC imitation parquet chêne naturel 4m";"Revêtement sol vinyle haute résistance";"Sol";"PVC";"89.90";"52.30";"145";"3254123456789";"QuickStep";"Actif";"https://cdn.decor.fr/products/58564.jpg"
```

---

## 📧 CONTACT ET SUIVI

**Pour toute question sur ces demandes:**
- Contacter: [Votre nom/équipe]
- Email: [votre-email]
- Priorité: URGENTE pour les points 1, 2, 3

**Planning suggéré:**
- **J+7:** Retour sur la faisabilité technique de chaque demande
- **J+14:** Livraison des colonnes critiques (Canal, Email, Nom produit)
- **J+30:** Livraison complète avec toutes les améliorations

---

**Document créé le 30 janvier 2026**  
**Version 1.0**
