-- Script SQL pour importer les données dans DuckDB
-- Usage: duckdb public/duckdb.db < scripts/import-cli.sql

-- Créer les tables
CREATE TABLE IF NOT EXISTS clients_raw (
  carte VARCHAR,
  date_creation VARCHAR,
  statut VARCHAR,
  date_validite VARCHAR,
  civilite VARCHAR,
  date_naissance VARCHAR,
  sexe VARCHAR,
  nom_adresse VARCHAR,
  adresse1 VARCHAR,
  adresse2 VARCHAR,
  adresse3 VARCHAR,
  cp VARCHAR,
  ville VARCHAR
);

CREATE TABLE IF NOT EXISTS produits (
  id VARCHAR PRIMARY KEY,
  famille VARCHAR,
  sous_famille VARCHAR,
  sous_sous_famille VARCHAR,
  sous_sous_sous_famille VARCHAR
);

CREATE TABLE IF NOT EXISTS magasins_raw (
  zone VARCHAR,
  code VARCHAR,
  nom VARCHAR,
  adresse1 VARCHAR,
  adresse2 VARCHAR,
  adresse3 VARCHAR,
  cp VARCHAR,
  ville VARCHAR
);

CREATE TABLE IF NOT EXISTS transactions_raw (
  carte VARCHAR,
  facture VARCHAR,
  depot VARCHAR,
  date VARCHAR,
  produit VARCHAR,
  quantite VARCHAR,
  ca VARCHAR
);

-- Importer les données
.mode csv
.separator ";"
.header on

.print 'Import clients...'
COPY clients_raw FROM '../data/nouveaux/client.csv' (HEADER TRUE, DELIMITER ';', IGNORE_ERRORS TRUE);
SELECT 'Clients importés: ' || COUNT(*) FROM clients_raw;

.print 'Import produits...'
COPY produits FROM '../data/nouveaux/Produits.csv' (HEADER TRUE, DELIMITER ';', IGNORE_ERRORS TRUE);
SELECT 'Produits importés: ' || COUNT(*) FROM produits;

.print 'Import magasins...'
COPY magasins_raw FROM '../data/nouveaux/Points de vente.csv' (HEADER TRUE, DELIMITER ';', IGNORE_ERRORS TRUE);
SELECT 'Magasins importés: ' || COUNT(*) FROM magasins_raw;

.print 'Import transactions...'
COPY transactions_raw FROM '../data/nouveaux/détail transactions.csv' (HEADER TRUE, DELIMITER ';', IGNORE_ERRORS TRUE);
SELECT 'Transactions importées: ' || COUNT(*) FROM transactions_raw;

.print 'Import terminé!'
