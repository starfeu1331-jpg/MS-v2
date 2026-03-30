#!/usr/bin/env node

/**
 * Script d'import automatique des données CSV vers DuckDB
 * Usage: node scripts/import-data.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemins des fichiers - tous dans "data/nouveaux/"
const DATA_DIR = path.resolve(__dirname, '../../data/nouveaux');

const FILES = {
  clients: path.join(DATA_DIR, 'client.csv'),
  produits: path.join(DATA_DIR, 'Produits.csv'),
  magasins: path.join(DATA_DIR, 'Points de vente.csv'),
  tickets: path.join(DATA_DIR, 'détail transactions.csv')
};

const DB_FILE = path.join(__dirname, '../public/duckdb.db');

// Vérifier que DuckDB Node est installé
let duckdb;
try {
  duckdb = (await import('duckdb')).default;
  console.log('✅ DuckDB Node détecté');
} catch (e) {
  console.error('❌ DuckDB Node non installé. Installation...');
  execSync('npm install duckdb', { stdio: 'inherit' });
  duckdb = (await import('duckdb')).default;
}

// Statistiques
const stats = {
  startTime: Date.now(),
  clients: 0,
  produits: 0,
  magasins: 0,
  transactions: 0,
  errors: []
};

async function main() {
  console.log('🚀 Démarrage import automatique...\n');

  // Vérifier les fichiers
  console.log('📁 Vérification des fichiers...');
  for (const [name, filePath] of Object.entries(FILES)) {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Fichier manquant: ${filePath}`);
      process.exit(1);
    }
    const size = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
    console.log(`   ✓ ${path.basename(filePath)} (${size} MB)`);
  }

  // Créer la base de données
  console.log('\n🗄️  Création base de données...');
  const db = new duckdb.Database(DB_FILE);
  const conn = db.connect();

  try {
    // Créer le schéma
    await createSchema(conn);
    
    // Importer les données
    await importClients(conn);
    await importProduits(conn);
    await importMagasins(conn);
    await importTransactions(conn);
    
    // Générer le snapshot
    await generateSnapshot(conn);
    
    // Afficher les résultats
    printResults();
    
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error.message);
    stats.errors.push(error.message);
    process.exit(1);
  } finally {
    conn.close();
    db.close();
  }
}

function createSchema(conn) {
  return new Promise((resolve, reject) => {
    console.log('   Création tables...');
    
    const sql = `
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
      
      CREATE TABLE IF NOT EXISTS dashboard_snapshot (
        year INTEGER PRIMARY KEY,
        payload TEXT
      );
      
      CREATE TABLE IF NOT EXISTS metadata (
        key VARCHAR PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    conn.exec(sql, (err) => {
      if (err) reject(err);
      else {
        console.log('   ✅ Tables créées');
        resolve();
      }
    });
  });
}

async function importClients(conn) {
  return new Promise((resolve, reject) => {
    const file = FILES.clients;
    console.log('\n👥 Import clients...');
    
    conn.exec(`
      COPY clients_raw FROM '${file}' (HEADER TRUE, DELIMITER ';', IGNORE_ERRORS TRUE);
      SELECT COUNT(*) as count FROM clients_raw;
    `, (err, result) => {
      if (err) {
        stats.errors.push(`Clients: ${err.message}`);
        reject(err);
      } else {
        // exec retourne un tableau de résultats, prendre le dernier (SELECT COUNT)
        const countResult = result[result.length - 1];
        stats.clients = countResult.count;
        console.log(`   ✅ ${stats.clients.toLocaleString()} clients importés`);
        resolve();
      }
    });
  });
}

async function importProduits(conn) {
  return new Promise((resolve, reject) => {
    const file = FILES.produits;
    console.log('\n📦 Import produits...');
    
    conn.exec(`
      COPY produits FROM '${file}' (HEADER TRUE, DELIMITER ';', IGNORE_ERRORS TRUE);
      SELECT COUNT(*) as count FROM produits;
    `, (err, result) => {
      if (err) {
        stats.errors.push(`Produits: ${err.message}`);
        reject(err);
      } else {
        const countResult = result[result.length - 1];
        stats.produits = countResult.count;
        console.log(`   ✅ ${stats.produits.toLocaleString()} produits importés`);
        resolve();
      }
    });
  });
}

async function importMagasins(conn) {
  return new Promise((resolve, reject) => {
    const file = FILES.magasins;
    console.log('\n🏪 Import magasins...');
    
    conn.exec(`
      COPY magasins_raw FROM '${file}' (HEADER TRUE, DELIMITER ';', IGNORE_ERRORS TRUE);
      SELECT COUNT(*) as count FROM magasins_raw;
    `, (err, result) => {
      if (err) {
        stats.errors.push(`Magasins: ${err.message}`);
        reject(err);
      } else {
        const countResult = result[result.length - 1];
        stats.magasins = countResult.count;
        console.log(`   ✅ ${stats.magasins.toLocaleString()} magasins importés`);
        resolve();
      }
    });
  });
}

async function importTransactions(conn) {
  return new Promise((resolve, reject) => {
    const file = FILES.tickets;
    console.log('\n🧾 Import transactions...');
    console.log('   (Cela peut prendre plusieurs minutes pour 6M lignes...)');
    
    const startTime = Date.now();
    
    conn.exec(`
      COPY transactions_raw FROM '${file}' (HEADER TRUE, DELIMITER ';', IGNORE_ERRORS TRUE);
      SELECT COUNT(*) as count FROM transactions_raw;
    `, (err, result) => {
      if (err) {
        stats.errors.push(`Transactions: ${err.message}`);
        reject(err);
      } else {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const countResult = result[result.length - 1];
        stats.transactions = countResult.count;
        console.log(`   ✅ ${stats.transactions.toLocaleString()} transactions importées (${duration}s)`);
        resolve();
      }
    });
  });
}

async function generateSnapshot(conn) {
  return new Promise((resolve, reject) => {
    console.log('\n📸 Génération snapshot 2025...');
    
    conn.all(`
      WITH year_data AS (
        SELECT 
          t.*,
          p.famille,
          p.sous_famille,
          m.nom as magasin_nom,
          m.zone as magasin_zone,
          c.sexe,
          c.cp as client_cp,
          c.ville as client_ville
        FROM transactions t
        LEFT JOIN produits p ON t.produit = p.id
        LEFT JOIN magasins m ON t.depot = m.code
        LEFT JOIN clients c ON t.carte = c.carte
        WHERE t.date >= '2025-01-01' AND t.date <= '2025-12-31'
      )
      SELECT
        COUNT(*) as total_transactions,
        COUNT(DISTINCT carte) as total_clients,
        COUNT(DISTINCT facture) as total_tickets,
        SUM(ca) as ca_total,
        SUM(CASE WHEN is_web = false THEN ca ELSE 0 END) as ca_mag,
        SUM(CASE WHEN is_web = true THEN ca ELSE 0 END) as ca_web,
        COUNT(CASE WHEN is_web = false THEN 1 END) as trans_mag,
        COUNT(CASE WHEN is_web = true THEN 1 END) as trans_web
      FROM year_data
    `, (err, result) => {
      if (err) {
        stats.errors.push(`Snapshot: ${err.message}`);
        reject(err);
      } else {
        const row = result[0];
        const payload = JSON.stringify({
          year: 2025,
          stats: {
            total_transactions: Number(row.total_transactions),
            total_clients: Number(row.total_clients),
            total_tickets: Number(row.total_tickets),
            ca_total: Number(row.ca_total),
            ca_mag: Number(row.ca_mag),
            ca_web: Number(row.ca_web),
            trans_mag: Number(row.trans_mag),
            trans_web: Number(row.trans_web)
          },
          generated_at: new Date().toISOString()
        });
        
        const escapedPayload = payload.replace(/'/g, "''");
        
        conn.exec(`
          INSERT OR REPLACE INTO dashboard_snapshot (year, payload)
          VALUES (2025, '${escapedPayload}')
        `, (err) => {
          if (err) {
            stats.errors.push(`Save snapshot: ${err.message}`);
            reject(err);
          } else {
            console.log('   ✅ Snapshot généré');
            resolve();
          }
        });
      }
    });
  });
}

function printResults() {
  const duration = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 IMPORT TERMINÉ AVEC SUCCÈS');
  console.log('='.repeat(60));
  console.log(`\n📊 Statistiques:`);
  console.log(`   • Clients:       ${stats.clients.toLocaleString()}`);
  console.log(`   • Produits:      ${stats.produits.toLocaleString()}`);
  console.log(`   • Magasins:      ${stats.magasins.toLocaleString()}`);
  console.log(`   • Transactions:  ${stats.transactions.toLocaleString()}`);
  console.log(`\n⏱️  Temps total: ${duration}s`);
  console.log(`\n💾 Base de données: ${DB_FILE}`);
  console.log(`\n✨ Prêt à utiliser! Rafraîchis ton navigateur.\n`);
}

// Lancer le script
main().catch(err => {
  console.error('\n💥 Erreur:', err);
  process.exit(1);
});
