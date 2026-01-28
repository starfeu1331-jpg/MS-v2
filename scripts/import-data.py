#!/usr/bin/env python3
"""
Script d'import automatique des données CSV vers DuckDB
Usage: python3 scripts/import-data.py
"""

import duckdb
import os
from pathlib import Path
import sys
from datetime import datetime

# Chemins
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = Path("/Users/marceau/Desktop/test data/data/nouveaux")
DB_FILE = SCRIPT_DIR.parent / "public" / "duckdb.db"

FILES = {
    "clients": DATA_DIR / "client.csv",
    "produits": DATA_DIR / "Produits.csv",
    "magasins": DATA_DIR / "Points de vente.csv",
    "transactions": DATA_DIR / "détail transactions.csv"
}

def print_progress(msg):
    """Affiche un message avec timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {msg}")

def verify_files():
    """Vérifie que tous les fichiers existent"""
    print_progress("📁 Vérification des fichiers...")
    for name, path in FILES.items():
        if not path.exists():
            print(f"❌ Fichier manquant: {path}")
            sys.exit(1)
        size = path.stat().st_size / 1024 / 1024
        print(f"   ✓ {path.name} ({size:.2f} MB)")
    print()

def create_database():
    """Crée la base de données et se connecte"""
    print_progress("🗄️  Création de la base de données...")
    
    # Supprimer l'ancienne base si elle existe
    if DB_FILE.exists():
        DB_FILE.unlink()
        print_progress("   Base existante supprimée")
    
    conn = duckdb.connect(str(DB_FILE))
    print_progress("   ✅ Base créée")
    return conn

def import_clients(conn):
    """Importe les clients"""
    print_progress("👥 Import des clients...")
    
    try:
        # Créer la table en normalisant les noms de colonnes
        conn.execute(f"""
            CREATE TABLE clients AS 
            SELECT 
                "N° Carte fidélité" as carte,
                "Nom adresse" as nom,
                "Nom adresse" as prenom,
                "Sexe" as sexe,
                "Date de naissance" as date_naissance,
                "C.P" as cp,
                "Ville" as ville
            FROM read_csv_auto('{FILES["clients"]}', 
                delim=';', 
                header=true,
                ignore_errors=true,
                sample_size=-1
            )
        """)
        
        count = conn.execute("SELECT COUNT(*) FROM clients").fetchone()[0]
        print_progress(f"   ✅ {count:,} clients importés")
        return count
        
    except Exception as e:
        print_progress(f"   ❌ Erreur: {e}")
        raise

def import_produits(conn):
    """Importe les produits"""
    print_progress("📦 Import des produits...")
    
    try:
        conn.execute(f"""
            CREATE TABLE produits AS 
            SELECT 
                "N° Produit" as id,
                "Famille" as label,
                "Famille" as famille,
                "Sous famille" as sous_famille,
                "Sous sous famille" as sous_sous_famille,
                "Sous sous sous famille" as sous_sous_sous_famille
            FROM read_csv_auto('{FILES["produits"]}', 
                delim=';', 
                header=true,
                ignore_errors=true
            )
        """)
        
        count = conn.execute("SELECT COUNT(*) FROM produits").fetchone()[0]
        print_progress(f"   ✅ {count:,} produits importés")
        return count
        
    except Exception as e:
        print_progress(f"   ❌ Erreur: {e}")
        raise

def import_magasins(conn):
    """Importe les magasins"""
    print_progress("🏪 Import des magasins...")
    
    try:
        conn.execute(f"""
            CREATE TABLE magasins AS 
            SELECT 
                "N° Dépôt" as code,
                "Intitulé dépôt" as nom,
                "Zones magasin" as zone,
                "Adresse 1" as ville
            FROM read_csv_auto('{FILES["magasins"]}', 
                delim=';', 
                header=true,
                ignore_errors=true
            )
        """)
        
        count = conn.execute("SELECT COUNT(*) FROM magasins").fetchone()[0]
        print_progress(f"   ✅ {count:,} magasins importés")
        return count
        
    except Exception as e:
        print_progress(f"   ❌ Erreur: {e}")
        raise

def import_transactions(conn):
    """Importe les transactions avec progression"""
    print_progress("🛒 Import des transactions (ceci peut prendre plusieurs minutes)...")
    
    try:
        start = datetime.now()
        
        conn.execute(f"""
            CREATE TABLE transactions AS 
            SELECT 
                "N° Facture client" as facture,
                "Date facture" as date,
                "N° Carte fidélité" as carte,
                "N° Produit" as produit,
                CAST(REPLACE("Quantité unitaire", ',', '.') as DOUBLE) as quantite,
                CAST(REPLACE("Quantité unitaire", ',', '.') as DOUBLE) * 
                CAST(REPLACE("Prix vente net en devise société", ',', '.') as DOUBLE) as ca,
                "Dépôt" as depot,
                false as is_web
            FROM read_csv_auto('{FILES["transactions"]}', 
                delim=';', 
                header=true,
                ignore_errors=true,
                sample_size=-1
            )
        """)
        
        count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        duration = (datetime.now() - start).total_seconds()
        print_progress(f"   ✅ {count:,} transactions importées en {duration:.0f}s")
        return count
        
    except Exception as e:
        print_progress(f"   ❌ Erreur: {e}")
        raise

def create_indexes(conn):
    """Crée les indexes pour améliorer les performances"""
    print_progress("📊 Création des indexes...")
    
    try:
        # Déterminer les noms de colonnes réels
        cols = [row[0] for row in conn.execute("PRAGMA table_info(transactions)").fetchall()]
        
        # Créer les indexes sur les colonnes qui existent
        if any('date' in c.lower() for c in cols):
            date_col = next(c for c in cols if 'date' in c.lower())
            conn.execute(f'CREATE INDEX idx_transactions_date ON transactions("{date_col}")')
        
        print_progress("   ✅ Indexes créés")
        
    except Exception as e:
        print_progress(f"   ⚠️  Erreur indexes (non bloquant): {e}")

def show_summary(conn, stats):
    """Affiche un résumé des données importées"""
    print_progress("\n" + "="*60)
    print_progress("🎉 IMPORT TERMINÉ AVEC SUCCÈS!")
    print_progress("="*60)
    print(f"\n📊 Résumé:")
    print(f"   • Clients:      {stats['clients']:>10,}")
    print(f"   • Produits:     {stats['produits']:>10,}")
    print(f"   • Magasins:     {stats['magasins']:>10,}")
    print(f"   • Transactions: {stats['transactions']:>10,}")
    print(f"\n💾 Base de données: {DB_FILE}")
    print(f"   Taille: {DB_FILE.stat().st_size / 1024 / 1024:.2f} MB")
    
    # Vérifier le CA total
    ca_result = conn.execute("SELECT SUM(ca) as ca_total FROM transactions").fetchone()
    ca_total = ca_result[0]
    print(f"\n💰 CA Total: {ca_total:,.2f} €")
    
    # Afficher les colonnes des tables
    print("\n📋 Structure des tables:")
    for table in ['clients', 'produits', 'magasins', 'transactions']:
        cols = conn.execute(f"PRAGMA table_info({table})").fetchall()
        print(f"\n   {table.upper()}:")
        for col in cols[:5]:  # Premières 5 colonnes
            print(f"      - {col[1]} ({col[2]})")
        if len(cols) > 5:
            print(f"      ... et {len(cols)-5} autres colonnes")
    
    print("\n✅ Vous pouvez maintenant rafraîchir le navigateur!")
    print()

def main():
    """Fonction principale"""
    print()
    print("="*60)
    print("🚀 IMPORT AUTOMATIQUE DES DONNÉES CSV VERS DUCKDB")
    print("="*60)
    print()
    
    start_time = datetime.now()
    stats = {}
    
    try:
        # 1. Vérifier les fichiers
        verify_files()
        
        # 2. Créer la base
        conn = create_database()
        
        # 3. Importer les données
        stats['clients'] = import_clients(conn)
        stats['produits'] = import_produits(conn)
        stats['magasins'] = import_magasins(conn)
        stats['transactions'] = import_transactions(conn)
        
        # 4. Créer les indexes
        create_indexes(conn)
        
        # 5. Afficher le résumé
        duration = (datetime.now() - start_time).total_seconds()
        print_progress(f"\n⏱️  Durée totale: {duration:.0f}s ({duration/60:.1f}min)")
        show_summary(conn, stats)
        
        conn.close()
        sys.exit(0)
        
    except Exception as e:
        print()
        print_progress(f"❌ ERREUR FATALE: {e}")
        print()
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
