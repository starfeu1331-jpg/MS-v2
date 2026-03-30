#!/usr/bin/env python3
"""
Script de mise à jour JOURNALIÈRE de la base de données
------------------------------------------------------
À exécuter chaque soir vers minuit pour ajouter les transactions du jour.
Les fichiers CSV doivent être placés dans data/nouveaux/ avant l'exécution.

Fichiers attendus:
- data/nouveaux/transactions.csv
- data/nouveaux/clients.csv (optionnel - nouveaux clients uniquement)
- data/nouveaux/produits.csv (optionnel - nouveaux produits uniquement)

Usage:
  python scripts/update-daily.py
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
    """Vérifier la présence des fichiers"""
    if not os.path.exists(TRANSACTIONS_FILE):
        log(f"❌ ERREUR: Fichier {TRANSACTIONS_FILE} introuvable")
        log(f"💡 Placez vos fichiers CSV dans {DATA_DIR}/")
        return False
    
    log(f"✅ Fichier transactions trouvé: {TRANSACTIONS_FILE}")
    
    # Optionnel : clients et produits
    if os.path.exists(CLIENTS_FILE):
        log(f"✅ Fichier clients trouvé: {CLIENTS_FILE}")
    else:
        log(f"ℹ️  Pas de nouveaux clients (optionnel)")
    
    if os.path.exists(PRODUITS_FILE):
        log(f"✅ Fichier produits trouvé: {PRODUITS_FILE}")
    else:
        log(f"ℹ️  Pas de nouveaux produits (optionnel)")
    
    return True

def count_lines(filepath):
    """Compter le nombre de lignes (hors header)"""
    with open(filepath, 'r') as f:
        return sum(1 for _ in f) - 1

def insert_clients(conn):
    """Insérer les nouveaux clients (s'il y en a)"""
    if not os.path.exists(CLIENTS_FILE):
        return 0
    
    cursor = conn.cursor()
    nb_lines = count_lines(CLIENTS_FILE)
    log(f"📥 Insertion de {nb_lines} nouveaux clients...")
    
    try:
        with open(CLIENTS_FILE, 'r') as f:
            cursor.copy_expert(
                "COPY clients (carte, ville, cp) FROM STDIN WITH CSV HEADER",
                f
            )
        conn.commit()
        inserted = cursor.rowcount
        log(f"✅ {inserted} clients insérés")
        return inserted
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        log("⚠️  Certains clients existent déjà (ignorés)")
        return 0
    except Exception as e:
        conn.rollback()
        log(f"❌ ERREUR insertion clients: {e}")
        return 0
    finally:
        cursor.close()

def insert_produits(conn):
    """Insérer les nouveaux produits (s'il y en a)"""
    if not os.path.exists(PRODUITS_FILE):
        return 0
    
    cursor = conn.cursor()
    nb_lines = count_lines(PRODUITS_FILE)
    log(f"📥 Insertion de {nb_lines} nouveaux produits...")
    
    try:
        with open(PRODUITS_FILE, 'r') as f:
            cursor.copy_expert(
                "COPY produits (id, famille, sous_famille, sous_sous_famille, sous_sous_sous_famille) FROM STDIN WITH CSV HEADER",
                f
            )
        conn.commit()
        inserted = cursor.rowcount
        log(f"✅ {inserted} produits insérés")
        return inserted
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        log("⚠️  Certains produits existent déjà (ignorés)")
        return 0
    except Exception as e:
        conn.rollback()
        log(f"❌ ERREUR insertion produits: {e}")
        return 0
    finally:
        cursor.close()

def insert_transactions(conn):
    """Insérer les nouvelles transactions"""
    cursor = conn.cursor()
    nb_lines = count_lines(TRANSACTIONS_FILE)
    log(f"📥 Insertion de {nb_lines} nouvelles transactions...")
    
    try:
        with open(TRANSACTIONS_FILE, 'r') as f:
            cursor.copy_expert(
                "COPY transactions (facture, date, carte, depot, produit, ca, quantite) FROM STDIN WITH CSV HEADER",
                f
            )
        conn.commit()
        inserted = cursor.rowcount
        log(f"✅ {inserted} transactions insérées")
        return inserted
    except Exception as e:
        conn.rollback()
        log(f"❌ ERREUR insertion transactions: {e}")
        return 0
    finally:
        cursor.close()

def get_stats(conn):
    """Récupérer les statistiques de la base"""
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM transactions")
    nb_transactions = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM clients")
    nb_clients = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM produits")
    nb_produits = cursor.fetchone()[0]
    
    cursor.close()
    return nb_transactions, nb_clients, nb_produits

def main():
    """Fonction principale"""
    log("🚀 Démarrage mise à jour JOURNALIÈRE")
    log("=" * 60)
    
    # 1. Vérifier les fichiers
    if not check_files():
        sys.exit(1)
    
    # 2. Connexion DB
    conn = connect_db()
    
    try:
        # 3. Stats avant
        nb_trans_avant, nb_clients_avant, nb_produits_avant = get_stats(conn)
        log(f"📊 État AVANT: {nb_trans_avant:,} transactions, {nb_clients_avant:,} clients, {nb_produits_avant:,} produits")
        
        # 4. Insertion dans l'ordre
        log("\n--- Phase 1: Clients ---")
        clients_added = insert_clients(conn)
        
        log("\n--- Phase 2: Produits ---")
        produits_added = insert_produits(conn)
        
        log("\n--- Phase 3: Transactions ---")
        transactions_added = insert_transactions(conn)
        
        # 5. Stats après
        nb_trans_apres, nb_clients_apres, nb_produits_apres = get_stats(conn)
        log(f"\n📊 État APRÈS: {nb_trans_apres:,} transactions, {nb_clients_apres:,} clients, {nb_produits_apres:,} produits")
        
        # 6. Résumé
        log("\n" + "=" * 60)
        log("✅ MISE À JOUR TERMINÉE")
        log(f"   • Transactions: +{transactions_added:,}")
        log(f"   • Clients: +{clients_added:,}")
        log(f"   • Produits: +{produits_added:,}")
        log("=" * 60)
        
    except Exception as e:
        log(f"❌ ERREUR CRITIQUE: {e}")
        sys.exit(1)
    finally:
        conn.close()
        log("🔌 Connexion fermée")

if __name__ == "__main__":
    main()
