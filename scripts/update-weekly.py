#!/usr/bin/env python3
"""
Script de mise à jour HEBDOMADAIRE de la base de données
-------------------------------------------------------
À exécuter chaque DIMANCHE pour écraser et recréer toute la base.
Garantit l'intégrité complète des données chaque semaine.

Fichiers attendus:
- data/nouveaux/transactions.csv (TOUTES les transactions)
- data/nouveaux/clients.csv (TOUS les clients)
- data/nouveaux/produits.csv (TOUS les produits)
- data/nouveaux/depots.csv (TOUS les magasins)

⚠️  ATTENTION: Ce script SUPPRIME et RECRÉE toutes les tables !

Usage:
  python scripts/update-weekly.py
"""

import os
import sys
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Configuration Neon PostgreSQL
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ ERREUR: DATABASE_URL non définie dans .env")
    sys.exit(1)

# Chemins des fichiers
DATA_DIR = "data/nouveaux"
TRANSACTIONS_FILE = f"{DATA_DIR}/transactions.csv"
CLIENTS_FILE = f"{DATA_DIR}/clients.csv"
PRODUITS_FILE = f"{DATA_DIR}/produits.csv"
DEPOTS_FILE = f"{DATA_DIR}/depots.csv"

def log(message):
    """Afficher un message avec timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def connect_db():
    """Se connecter à la base de données"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        log("✅ Connexion à Neon PostgreSQL établie")
        return conn
    except Exception as e:
        log(f"❌ ERREUR connexion DB: {e}")
        sys.exit(1)

def check_files():
    """Vérifier la présence de TOUS les fichiers requis"""
    required_files = [TRANSACTIONS_FILE, CLIENTS_FILE, PRODUITS_FILE]
    missing = []
    
    for filepath in required_files:
        if os.path.exists(filepath):
            lines = count_lines(filepath)
            log(f"✅ {os.path.basename(filepath)}: {lines:,} lignes")
        else:
            missing.append(filepath)
            log(f"❌ MANQUANT: {filepath}")
    
    if os.path.exists(DEPOTS_FILE):
        lines = count_lines(DEPOTS_FILE)
        log(f"✅ {os.path.basename(DEPOTS_FILE)}: {lines:,} lignes")
    else:
        log(f"ℹ️  depots.csv absent (optionnel)")
    
    if missing:
        log(f"\n❌ ERREUR: {len(missing)} fichier(s) manquant(s)")
        log(f"💡 Placez tous les fichiers CSV dans {DATA_DIR}/")
        return False
    
    return True

def count_lines(filepath):
    """Compter le nombre de lignes (hors header)"""
    with open(filepath, 'r') as f:
        return sum(1 for _ in f) - 1

def confirm_action():
    """Demander confirmation avant destruction"""
    log("\n" + "⚠️ " * 30)
    log("ATTENTION: Cette opération va SUPPRIMER TOUTES les données !")
    log("⚠️ " * 30)
    
    response = input("\nTapez 'OUI' en majuscules pour confirmer: ")
    
    if response != "OUI":
        log("❌ Opération annulée par l'utilisateur")
        sys.exit(0)
    
    log("✅ Confirmation reçue, poursuite de l'opération...")

def drop_tables(conn):
    """Supprimer toutes les tables"""
    log("\n🗑️  Suppression des tables existantes...")
    cursor = conn.cursor()
    
    try:
        # Supprimer les contraintes d'abord
        cursor.execute("""
            ALTER TABLE IF EXISTS transactions 
            DROP CONSTRAINT IF EXISTS transactions_carte_fkey,
            DROP CONSTRAINT IF EXISTS transactions_depot_fkey,
            DROP CONSTRAINT IF EXISTS transactions_produit_fkey;
        """)
        
        # Supprimer les tables
        cursor.execute("DROP TABLE IF EXISTS transactions CASCADE")
        cursor.execute("DROP TABLE IF EXISTS clients CASCADE")
        cursor.execute("DROP TABLE IF EXISTS produits CASCADE")
        cursor.execute("DROP TABLE IF EXISTS depots CASCADE")
        
        conn.commit()
        log("✅ Tables supprimées")
    except Exception as e:
        conn.rollback()
        log(f"❌ ERREUR suppression tables: {e}")
        raise
    finally:
        cursor.close()

def create_tables(conn):
    """Créer toutes les tables"""
    log("\n🏗️  Création des tables...")
    cursor = conn.cursor()
    
    try:
        # Table clients
        cursor.execute("""
            CREATE TABLE clients (
                carte VARCHAR(50) PRIMARY KEY,
                ville VARCHAR(100),
                cp VARCHAR(10)
            )
        """)
        log("  ✅ Table clients créée")
        
        # Table produits
        cursor.execute("""
            CREATE TABLE produits (
                id VARCHAR(50) PRIMARY KEY,
                famille VARCHAR(100),
                sous_famille VARCHAR(100),
                sous_sous_famille VARCHAR(100),
                sous_sous_sous_famille VARCHAR(100)
            )
        """)
        log("  ✅ Table produits créée")
        
        # Table depots (optionnel)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS depots (
                code VARCHAR(50) PRIMARY KEY,
                nom VARCHAR(100)
            )
        """)
        log("  ✅ Table depots créée")
        
        # Table transactions
        cursor.execute("""
            CREATE TABLE transactions (
                facture VARCHAR(50),
                date DATE,
                carte VARCHAR(50),
                depot VARCHAR(50),
                produit VARCHAR(50),
                ca NUMERIC(10, 2),
                quantite INTEGER
            )
        """)
        log("  ✅ Table transactions créée")
        
        conn.commit()
        log("✅ Toutes les tables créées")
    except Exception as e:
        conn.rollback()
        log(f"❌ ERREUR création tables: {e}")
        raise
    finally:
        cursor.close()

def load_clients(conn):
    """Charger les clients"""
    log("\n📥 Chargement des clients...")
    cursor = conn.cursor()
    
    try:
        with open(CLIENTS_FILE, 'r') as f:
            cursor.copy_expert(
                "COPY clients (carte, ville, cp) FROM STDIN WITH CSV HEADER",
                f
            )
        conn.commit()
        inserted = cursor.rowcount
        log(f"✅ {inserted:,} clients chargés")
        return inserted
    except Exception as e:
        conn.rollback()
        log(f"❌ ERREUR chargement clients: {e}")
        raise
    finally:
        cursor.close()

def load_produits(conn):
    """Charger les produits"""
    log("\n📥 Chargement des produits...")
    cursor = conn.cursor()
    
    try:
        with open(PRODUITS_FILE, 'r') as f:
            cursor.copy_expert(
                "COPY produits (id, famille, sous_famille, sous_sous_famille, sous_sous_sous_famille) FROM STDIN WITH CSV HEADER",
                f
            )
        conn.commit()
        inserted = cursor.rowcount
        log(f"✅ {inserted:,} produits chargés")
        return inserted
    except Exception as e:
        conn.rollback()
        log(f"❌ ERREUR chargement produits: {e}")
        raise
    finally:
        cursor.close()

def load_depots(conn):
    """Charger les dépôts/magasins (optionnel)"""
    if not os.path.exists(DEPOTS_FILE):
        log("\nℹ️  Pas de fichier depots.csv (ignoré)")
        return 0
    
    log("\n📥 Chargement des dépôts...")
    cursor = conn.cursor()
    
    try:
        with open(DEPOTS_FILE, 'r') as f:
            cursor.copy_expert(
                "COPY depots (code, nom) FROM STDIN WITH CSV HEADER",
                f
            )
        conn.commit()
        inserted = cursor.rowcount
        log(f"✅ {inserted:,} dépôts chargés")
        return inserted
    except Exception as e:
        conn.rollback()
        log(f"⚠️  ERREUR chargement dépôts: {e}")
        return 0
    finally:
        cursor.close()

def load_transactions(conn):
    """Charger les transactions"""
    log("\n📥 Chargement des transactions...")
    nb_lines = count_lines(TRANSACTIONS_FILE)
    log(f"   Lignes à charger: {nb_lines:,}")
    
    cursor = conn.cursor()
    
    try:
        with open(TRANSACTIONS_FILE, 'r') as f:
            cursor.copy_expert(
                "COPY transactions (facture, date, carte, depot, produit, ca, quantite) FROM STDIN WITH CSV HEADER",
                f
            )
        conn.commit()
        inserted = cursor.rowcount
        log(f"✅ {inserted:,} transactions chargées")
        return inserted
    except Exception as e:
        conn.rollback()
        log(f"❌ ERREUR chargement transactions: {e}")
        raise
    finally:
        cursor.close()

def create_indexes(conn):
    """Créer les index pour optimiser les performances"""
    log("\n⚡ Création des index...")
    cursor = conn.cursor()
    
    try:
        # Index sur transactions
        cursor.execute("CREATE INDEX idx_trans_date ON transactions(date)")
        cursor.execute("CREATE INDEX idx_trans_carte ON transactions(carte)")
        cursor.execute("CREATE INDEX idx_trans_depot ON transactions(depot)")
        cursor.execute("CREATE INDEX idx_trans_produit ON transactions(produit)")
        
        # Index sur clients
        cursor.execute("CREATE INDEX idx_clients_cp ON clients(cp)")
        
        # Index sur produits
        cursor.execute("CREATE INDEX idx_produits_famille ON produits(famille)")
        
        conn.commit()
        log("✅ Index créés")
    except Exception as e:
        conn.rollback()
        log(f"⚠️  ERREUR création index: {e}")
    finally:
        cursor.close()

def vacuum_analyze(conn):
    """Optimiser la base de données"""
    log("\n🧹 Optimisation de la base...")
    
    # VACUUM doit être exécuté hors transaction
    old_isolation_level = conn.isolation_level
    conn.set_isolation_level(0)
    
    cursor = conn.cursor()
    try:
        cursor.execute("VACUUM ANALYZE")
        log("✅ Base optimisée")
    except Exception as e:
        log(f"⚠️  ERREUR optimisation: {e}")
    finally:
        cursor.close()
        conn.set_isolation_level(old_isolation_level)

def main():
    """Fonction principale"""
    log("🚀 Démarrage mise à jour HEBDOMADAIRE (COMPLÈTE)")
    log("=" * 60)
    
    # 1. Vérifier les fichiers
    if not check_files():
        sys.exit(1)
    
    # 2. Demander confirmation
    confirm_action()
    
    # 3. Connexion DB
    conn = connect_db()
    
    try:
        start_time = datetime.now()
        
        # 4. Supprimer les tables
        drop_tables(conn)
        
        # 5. Créer les tables
        create_tables(conn)
        
        # 6. Charger les données
        clients_count = load_clients(conn)
        produits_count = load_produits(conn)
        depots_count = load_depots(conn)
        transactions_count = load_transactions(conn)
        
        # 7. Créer les index
        create_indexes(conn)
        
        # 8. Optimiser
        vacuum_analyze(conn)
        
        # 9. Résumé
        duration = (datetime.now() - start_time).total_seconds()
        log("\n" + "=" * 60)
        log("✅ RECRÉATION COMPLÈTE TERMINÉE")
        log(f"   • Clients: {clients_count:,}")
        log(f"   • Produits: {produits_count:,}")
        log(f"   • Dépôts: {depots_count:,}")
        log(f"   • Transactions: {transactions_count:,}")
        log(f"   • Durée: {duration:.1f}s")
        log("=" * 60)
        
    except Exception as e:
        log(f"\n❌ ERREUR CRITIQUE: {e}")
        sys.exit(1)
    finally:
        conn.close()
        log("🔌 Connexion fermée")

if __name__ == "__main__":
    main()
