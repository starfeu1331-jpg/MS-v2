# 🔧 MAPPING TECHNIQUE - Correspondance BDD ↔ CSV

**Pour:** Nicolas (Responsable Informatique)  
**Objectif:** Faciliter l'export depuis votre système vers les CSV

---

## 📊 STRUCTURE BASE DE DONNÉES DE L'APPLICATION

### Table: `clients`
```sql
CREATE TABLE clients (
  carte           VARCHAR PRIMARY KEY,  -- N° Carte fidélité
  date_creation   VARCHAR,              -- Format: YYYY-MM-DD
  statut          VARCHAR,
  date_validite   VARCHAR,
  civilite        VARCHAR,              -- M. / Mme / ...
  date_naissance  VARCHAR,
  sexe            VARCHAR,              -- H / F
  nom_adresse     VARCHAR,              -- ⚠️ Actuellement mélange nom+prénom
  adresse         VARCHAR,
  adresse_2       VARCHAR,
  adresse_4       VARCHAR,
  cp              VARCHAR,
  ville           VARCHAR
)
```

### Table: `produits`
```sql
CREATE TABLE produits (
  id                       VARCHAR PRIMARY KEY,  -- N° Produit
  famille                  VARCHAR,
  sous_famille             VARCHAR,
  sous_sous_famille        VARCHAR,
  sous_sous_sous_famille   VARCHAR
)
```

### Table: `magasins`
```sql
CREATE TABLE magasins (
  code        VARCHAR PRIMARY KEY,  -- N° Dépôt
  zone        VARCHAR,              -- Zones magasin
  nom         VARCHAR,              -- Intitulé dépôt
  adresse_1   VARCHAR,
  adresse_2   VARCHAR,
  adresse_3   VARCHAR,
  cp          VARCHAR,
  ville       VARCHAR
)
```

### Table: `transactions`
```sql
CREATE TABLE transactions (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  facture     VARCHAR,              -- N° Facture client
  carte       VARCHAR,              -- N° Carte fidélité
  depot       VARCHAR,              -- Dépôt (code magasin)
  date        TIMESTAMP,            -- Date facture
  produit     VARCHAR,              -- N° Produit
  quantite    FLOAT,                -- Quantité unitaire
  prix        FLOAT,                -- Prix vente net
  ca          FLOAT,                -- Calculé: quantite * prix
  is_web      BOOLEAN,              -- ⚠️ ACTUELLEMENT TOUJOURS FALSE
  ville       VARCHAR,
  cp          VARCHAR
)
```

---

## 🎯 MAPPING CSV → BASE DE DONNÉES

### 1. FICHIER: `client.csv` → Table `clients`

| Colonne CSV actuelle | Colonne BDD | Type | ⚠️ Problème | ✅ Solution demandée |
|---------------------|-------------|------|------------|---------------------|
| N° Carte fidélité | carte | VARCHAR | OK | - |
| Date création | date_creation | VARCHAR | Format DD/MM/YYYY | Format YYYY-MM-DD |
| Statut | statut | VARCHAR | OK | - |
| Date de validité | date_validite | VARCHAR | Format DD/MM/YYYY | Format YYYY-MM-DD |
| Civilité | civilite | VARCHAR | OK | - |
| Date de naissance | date_naissance | VARCHAR | Format DD/MM/YYYY | Format YYYY-MM-DD |
| Sexe | sexe | VARCHAR | OK | - |
| Nom adresse | nom_adresse | VARCHAR | ❌ Mélange nom+prénom | **Séparer en 2 colonnes** |
| - | **nom** | VARCHAR | ❌ MANQUANT | **AJOUTER** |
| - | **prenom** | VARCHAR | ❌ MANQUANT | **AJOUTER** |
| - | **email** | VARCHAR | ❌ MANQUANT | **AJOUTER** |
| - | **telephone** | VARCHAR | ❌ MANQUANT | **AJOUTER** |
| - | **mobile** | VARCHAR | ❌ MANQUANT | **AJOUTER** |
| - | **optin_email** | CHAR(1) | ❌ MANQUANT | **AJOUTER** (O/N) |
| - | **optin_sms** | CHAR(1) | ❌ MANQUANT | **AJOUTER** (O/N) |
| Adresse | adresse | VARCHAR | OK | - |
| Adresse (ligne 2) | adresse_2 | VARCHAR | OK | - |
| Adresse (4ième ligne) | adresse_4 | VARCHAR | OK | - |
| C.P | cp | VARCHAR | OK | - |
| Ville | ville | VARCHAR | OK | - |

#### Requête SQL suggérée (Proginov/ERP)
```sql
SELECT 
  t.cod_cli AS "N° Carte fidélité",
  t.nom_cli AS "Nom",
  t.prenom_cli AS "Prénom",
  c.internet AS "Email",           -- Table contacts
  c.telephone AS "Téléphone",      -- Table contacts
  c.mobile AS "Mobile",            -- Table contacts
  t.optin_email AS "Opt-in Email",
  t.optin_sms AS "Opt-in SMS",
  TO_CHAR(t.dat_creation, 'YYYY-MM-DD') AS "Date création",
  t.civilite AS "Civilité",
  TO_CHAR(t.dat_naissance, 'YYYY-MM-DD') AS "Date de naissance",
  t.sexe AS "Sexe",
  t.adresse_1 AS "Adresse",
  t.adresse_2 AS "Adresse ligne 2",
  t.adresse_4 AS "Adresse ligne 4",
  t.code_postal AS "C.P",
  t.ville AS "Ville",
  t.statut AS "Statut",
  TO_CHAR(t.dat_validite, 'YYYY-MM-DD') AS "Date de validité"
FROM tiers t
LEFT JOIN contacts c ON t.cod_cli = c.cod_tiers AND c.principal = 1
WHERE t.type_tiers = 'CLIENT'
ORDER BY t.cod_cli
```

---

### 2. FICHIER: `Produits.csv` → Table `produits`

| Colonne CSV actuelle | Colonne BDD | Type | ⚠️ Problème | ✅ Solution demandée |
|---------------------|-------------|------|------------|---------------------|
| N° Produit | id | VARCHAR | OK | - |
| - | **nom_produit** | VARCHAR | ❌ MANQUANT | **AJOUTER** |
| - | **description** | TEXT | ❌ MANQUANT | **AJOUTER** |
| Famille | famille | VARCHAR | OK | - |
| Sous famille | sous_famille | VARCHAR | OK | - |
| Sous sous famille | sous_sous_famille | VARCHAR | OK | - |
| Sous sous sous famille | sous_sous_sous_famille | VARCHAR | OK | - |
| - | **prix_vente_ttc** | DECIMAL | ❌ MANQUANT | **AJOUTER** |
| - | **prix_achat_ht** | DECIMAL | ❌ MANQUANT | **AJOUTER** |
| - | **stock** | INT | ❌ MANQUANT | **AJOUTER** |
| - | **code_ean** | VARCHAR | ❌ MANQUANT | **AJOUTER** |
| - | **marque** | VARCHAR | ❌ MANQUANT | **AJOUTER** |
| - | **statut** | VARCHAR | ❌ MANQUANT | **AJOUTER** (Actif/Archivé) |
| - | **url_image** | VARCHAR | ❌ MANQUANT | **AJOUTER** (optionnel) |

#### Requête SQL suggérée
```sql
SELECT 
  p.cod_pro AS "N° Produit",
  p.nom_pro AS "Nom produit",
  p.nom_pr2 AS "Description",
  p.famille AS "Famille",
  p.s_famille AS "Sous famille",
  p.ss_famille AS "Sous sous famille",
  p.sss_famille AS "Sous sous sous famille",
  p.px_refv AS "Prix vente TTC",
  p.pmp AS "Prix achat HT",
  (SELECT SUM(stock) FROM stocks WHERE cod_pro = p.cod_pro) AS "Stock",
  p.refext AS "Code EAN",
  p.marque AS "Marque",
  CASE WHEN p.actif = 1 THEN 'Actif' ELSE 'Archivé' END AS "Statut",
  CONCAT('https://cdn.decor.fr/products/', p.cod_pro, '.jpg') AS "URL image"
FROM produits p
ORDER BY p.cod_pro
```

---

### 3. FICHIER: `détail transactions.csv` → Table `transactions`

| Colonne CSV actuelle | Colonne BDD | Type | ⚠️ Problème | ✅ Solution demandée |
|---------------------|-------------|------|------------|---------------------|
| N° Facture client | facture | VARCHAR | OK | - |
| N° Carte fidélité | carte | VARCHAR | OK | - |
| Dépôt | depot | VARCHAR | OK | - |
| - | **canal** | VARCHAR | ❌ MANQUANT | **AJOUTER** (WEB/MAGASIN) |
| Date facture | date | TIMESTAMP | Format DD/MM/YYYY | Format YYYY-MM-DD HH:MM:SS |
| - | **heure** | TIME | ❌ MANQUANT | **AJOUTER** (HH:MM:SS) |
| N° Produit | produit | VARCHAR | OK | - |
| Quantité unitaire | quantite | FLOAT | OK | - |
| Prix vente net | prix | FLOAT | OK | - |
| - | **montant_ttc** | DECIMAL | ❌ Calculé côté appli | **AJOUTER** (qté * prix) |
| - | **remise** | DECIMAL | ❌ MANQUANT | **AJOUTER** |
| - | **mode_paiement** | VARCHAR | ❌ MANQUANT | **AJOUTER** (CB/Espèces/Chèque) |
| - | **statut** | VARCHAR | ❌ MANQUANT | **AJOUTER** (Validée/Annulée) |
| - | is_web | BOOLEAN | Toujours FALSE | Calculer depuis "canal" |

#### Requête SQL suggérée
```sql
SELECT 
  t.num_facture AS "N° Facture client",
  t.cod_cli AS "N° Carte fidélité",
  t.cod_depot AS "Dépôt",
  CASE 
    WHEN t.cod_depot = 'WEB' OR t.canal_vente = 'WEB' THEN 'WEB'
    ELSE 'MAGASIN'
  END AS "Canal",
  TO_CHAR(t.dat_facture, 'YYYY-MM-DD') AS "Date facture",
  TO_CHAR(t.dat_facture, 'HH24:MI:SS') AS "Heure",
  l.cod_produit AS "N° Produit",
  l.quantite AS "Quantité unitaire",
  l.prix_unit_net AS "Prix vente net",
  l.montant_ttc AS "Montant ligne TTC",
  l.remise AS "Remise",
  t.mode_reglement AS "Mode paiement",
  t.statut AS "Statut"
FROM factures t
JOIN lignes_facture l ON t.num_facture = l.num_facture
WHERE t.type_doc = 'FACTURE'
  AND t.statut = 'VALIDEE'
ORDER BY t.dat_facture DESC, t.num_facture
```

**⚠️ POINT CRUCIAL:** Comment identifier les ventes web?
```
Option 1: cod_depot = 'WEB' (dépôt spécial pour le web)
Option 2: Colonne canal_vente dans votre ERP
Option 3: Préfixe facture (ex: WEB123456 vs MAG123456)
Option 4: Table séparée commandes_web

→ Merci de préciser votre méthode actuelle
```

---

### 4. FICHIER: `Points de vente.csv` → Table `magasins`

| Colonne CSV actuelle | Colonne BDD | Type | ⚠️ Problème | ✅ Solution demandée |
|---------------------|-------------|------|------------|---------------------|
| N° Dépôt | code | VARCHAR | OK | - |
| Zones magasin | zone | VARCHAR | OK | - |
| Intitulé dépôt | nom | VARCHAR | OK | - |
| Adresse 1 | adresse_1 | VARCHAR | OK | - |
| Adresse 2 | adresse_2 | VARCHAR | OK | - |
| Adresse 3 | adresse_3 | VARCHAR | OK | - |
| CP | cp | VARCHAR | OK | - |
| Ville | ville | VARCHAR | OK | - |
| - | **telephone** | VARCHAR | ❌ MANQUANT | **AJOUTER** |
| - | **email** | VARCHAR | ❌ MANQUANT | **AJOUTER** |
| - | **horaires** | TEXT | ❌ MANQUANT | **AJOUTER** |
| - | **latitude** | DECIMAL | ❌ MANQUANT | **AJOUTER** (ex: 45.7640) |
| - | **longitude** | DECIMAL | ❌ MANQUANT | **AJOUTER** (ex: 4.8357) |
| - | **surface_m2** | INT | ❌ MANQUANT | **AJOUTER** (optionnel) |
| - | **manager** | VARCHAR | ❌ MANQUANT | **AJOUTER** (optionnel) |

#### Requête SQL suggérée
```sql
SELECT 
  d.cod_depot AS "N° Dépôt",
  d.zone AS "Zones magasin",
  d.nom_depot AS "Intitulé dépôt",
  d.adresse_1 AS "Adresse 1",
  d.adresse_2 AS "Adresse 2",
  d.adresse_3 AS "Adresse 3",
  d.code_postal AS "CP",
  d.ville AS "Ville",
  d.telephone AS "Téléphone",
  d.email AS "Email",
  d.horaires AS "Horaires",
  d.latitude AS "Latitude",
  d.longitude AS "Longitude",
  d.surface AS "Surface m²",
  d.responsable AS "Manager"
FROM depots d
WHERE d.type = 'MAGASIN'
ORDER BY d.cod_depot
```

---

## 🔄 PROCESSUS D'EXPORT RECOMMANDÉ

### Étape 1: Export initial (complet)
```sql
-- Script PostgreSQL/MySQL à adapter selon votre ERP
\COPY (SELECT ... FROM clients ...) TO 'clients.csv' CSV HEADER ENCODING 'UTF8' DELIMITER ';'
\COPY (SELECT ... FROM produits ...) TO 'produits.csv' CSV HEADER ENCODING 'UTF8' DELIMITER ';'
\COPY (SELECT ... FROM magasins ...) TO 'magasins.csv' CSV HEADER ENCODING 'UTF8' DELIMITER ';'
\COPY (SELECT ... FROM transactions ...) TO 'transactions.csv' CSV HEADER ENCODING 'UTF8' DELIMITER ';'
```

### Étape 2: Export incrémental (quotidien)
```sql
-- Uniquement les transactions des dernières 24h
SELECT ... FROM transactions 
WHERE dat_facture >= CURRENT_DATE - INTERVAL '1 day'
```

### Étape 3: Automatisation
```bash
#!/bin/bash
# Script cron à exécuter chaque nuit à 2h00
# 0 2 * * * /usr/local/bin/export-decor-analytics.sh

DATE=$(date +%Y-%m-%d)
EXPORT_DIR="/exports/decor-analytics/$DATE"

mkdir -p "$EXPORT_DIR"

# Export depuis Proginov/ERP
psql -U user -d database -c "\COPY (...) TO '$EXPORT_DIR/clients.csv' ..."
psql -U user -d database -c "\COPY (...) TO '$EXPORT_DIR/produits.csv' ..."
# etc.

# Compression optionnelle
tar -czf "$EXPORT_DIR.tar.gz" "$EXPORT_DIR"

echo "Export terminé: $EXPORT_DIR"
```

---

## 📝 CHECKLIST DE VALIDATION

Avant de livrer un nouveau fichier CSV, vérifier:

- [ ] **Encodage UTF-8** avec BOM
- [ ] **Séparateur** `;` (point-virgule)
- [ ] **Guillemets** autour de tous les champs texte
- [ ] **Header** présent en ligne 1
- [ ] **Dates** au format `YYYY-MM-DD`
- [ ] **Heures** au format `HH:MM:SS`
- [ ] **Pas de lignes vides**
- [ ] **Pas de caractères spéciaux** non échappés
- [ ] **Colonnes demandées** toutes présentes
- [ ] **Valeurs nulles** = champ vide (pas "NULL" en texte)
- [ ] **Test import** sur un échantillon de 100 lignes

---

## 🧪 FICHIERS DE TEST À FOURNIR

Merci de fournir des échantillons de test:

```
test_samples/
├── clients_sample_100.csv          (100 clients avec TOUTES les nouvelles colonnes)
├── produits_sample_100.csv         (100 produits)
├── transactions_sample_1000.csv    (1000 transactions dont 200 web)
└── magasins_complet.csv            (tous les magasins)
```

---

## 📞 QUESTIONS TECHNIQUES À CLARIFIER

1. **Identification ventes WEB:**
   - Comment distinguez-vous actuellement une commande web d'une vente magasin?
   - Y a-t-il un dépôt spécial "WEB" ou une colonne dédiée?

2. **Contacts clients:**
   - Les emails sont-ils dans une table séparée (contacts)?
   - Y a-t-il un flag "contact principal"?

3. **Stock produits:**
   - Stock agrégé tous magasins ou par magasin?
   - Stock réel ou stock disponible (réel - réservé)?

4. **Fréquence d'export:**
   - Export complet acceptable (taille)
   - Ou préférence pour delta/incrémental?

5. **Coordonnées GPS magasins:**
   - Déjà présentes en base?
   - Ou besoin de géocodage externe?

---

**Merci de répondre à ces questions pour finaliser l'implémentation** 🙏

*Document technique créé le 30 janvier 2026*
