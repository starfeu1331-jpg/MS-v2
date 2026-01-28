#!/usr/bin/env python3
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
from datetime import datetime

# Configuration
DB_CONFIG = {
    'dbname': 'decor_analytics',
    'user': 'marceau',
    'host': 'localhost',
    'port': 5432
}

DATA_DIR = '../public/data'

def log_progress(phase, current, total):
    pct = int((current / total) * 100) if total > 0 else 0
    print(f"[{phase}] {pct}% - {current:,} / {total:,}")

def import_clients():
    print("\n👥 Import CLIENTS...")
    df = pd.read_parquet(f'{DATA_DIR}/clients.parquet')
    print(f"   Lignes lues: {len(df):,}")
    
    # Nettoyer et préparer les données
    df = df.fillna('')
    df['carte'] = df['carte'].astype(str).str.strip()
    df = df[df['carte'] != '0']
    
    # Ajouter un client "0" pour les transactions sans carte
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO clients (carte, ville) 
        VALUES ('0', 'Anonyme') 
        ON CONFLICT (carte) DO NOTHING
    """)
    conn.commit()
    cur.close()
    conn.close()
    
    # Connexion DB
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Insertion par batch
    BATCH_SIZE = 5000
    total = len(df)
    
    for i in range(0, total, BATCH_SIZE):
        batch = df.iloc[i:i+BATCH_SIZE]
        values = [(
            row['carte'],
            str(row.get('dateCreation', '')),
            str(row.get('dateValidite', '')),
            str(row.get('statut', '')),
            str(row.get('civilite', '')),
            str(row.get('sexe', '')),
            str(row.get('dateNaissance', '')),
            str(row.get('cp', '')),
            str(row.get('ville', ''))
        ) for _, row in batch.iterrows()]
        
        execute_values(
            cur,
            """INSERT INTO clients (carte, date_creation, date_validite, statut, civilite, sexe, date_naissance, cp, ville)
               VALUES %s ON CONFLICT (carte) DO NOTHING""",
            values
        )
        conn.commit()
        log_progress('CLIENTS', min(i + BATCH_SIZE, total), total)
    
    cur.close()
    conn.close()
    print(f"✅ {total:,} clients importés")

def import_produits():
    print("\n📦 Import PRODUITS...")
    df = pd.read_parquet(f'{DATA_DIR}/produits.parquet')
    print(f"   Lignes lues: {len(df):,}")
    
    df = df.fillna('')
    df['id'] = df['id'].astype(str).str.strip()
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Ajouter produit "0" pour transactions invalides
    cur.execute("""
        INSERT INTO produits (id, famille) 
        VALUES ('0', 'Inconnu') 
        ON CONFLICT (id) DO NOTHING
    """)
    conn.commit()
    
    values = [(
        row['id'],
        str(row.get('famille', 'Inconnu')),
        str(row.get('sousFamille', '')),
        str(row.get('sousSousFamille', '')),
        str(row.get('sousSousSousFamille', ''))
    ) for _, row in df.iterrows() if row['id']]
    
    execute_values(
        cur,
        """INSERT INTO produits (id, famille, sous_famille, sous_sous_famille, sous_sous_sous_famille)
           VALUES %s ON CONFLICT (id) DO NOTHING""",
        values
    )
    conn.commit()
    
    cur.close()
    conn.close()
    print(f"✅ {len(values):,} produits importés")

def import_magasins():
    print("\n🏪 Import MAGASINS...")
    df = pd.read_parquet(f'{DATA_DIR}/magasins.parquet')
    print(f"   Lignes lues: {len(df):,}")
    
    df = df.fillna('')
    df['code'] = df['code'].astype(str).str.strip()
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Ajouter magasin "0" pour transactions invalides
    cur.execute("""
        INSERT INTO magasins (code, nom) 
        VALUES ('0', 'Inconnu') 
        ON CONFLICT (code) DO NOTHING
    """)
    conn.commit()
    
    values = [(
        row['code'],
        str(row.get('nom', f"M{row['code']}")),
        str(row.get('zone', '')),
        str(row.get('ville', '')),
        str(row.get('cp', ''))
    ) for _, row in df.iterrows() if row['code']]
    
    execute_values(
        cur,
        """INSERT INTO magasins (code, nom, zone, ville, cp)
           VALUES %s ON CONFLICT (code) DO NOTHING""",
        values
    )
    conn.commit()
    
    cur.close()
    conn.close()
    print(f"✅ {len(values):,} magasins importés")

def import_transactions():
    print("\n🎫 Import TRANSACTIONS...")
    df = pd.read_parquet(f'{DATA_DIR}/transactions.parquet')
    print(f"   Lignes lues: {len(df):,}")
    
    # Préparer les données
    df = df.fillna({'carte': '0', 'ville': '', 'cp': ''})
    df['facture'] = df['facture'].astype(str).str.strip()
    df['carte'] = df['carte'].astype(str).str.strip()
    df['depot'] = df['depot'].astype(str).str.strip()
    df['produit'] = df['produit'].astype(str).str.strip()
    
    # Gérer isWeb (peut ne pas exister)
    if 'isWeb' in df.columns:
        df['isWeb'] = df['isWeb'].fillna(False).astype(bool)
    else:
        df['isWeb'] = False
    
    # Convertir dates si nécessaire
    if df['date'].dtype != 'datetime64[ns]':
        df['date'] = pd.to_datetime(df['date'])
    
    # Filtrer les lignes invalides
    df = df[df['facture'] != '']
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Insertion par batch (plus petit car beaucoup de données)
    BATCH_SIZE = 2000
    total = len(df)
    
    for i in range(0, total, BATCH_SIZE):
        batch = df.iloc[i:i+BATCH_SIZE]
        values = [(
            row['facture'],
            row['carte'],
            row['depot'],
            row['date'],
            row['produit'],
            float(row.get('quantite', 0)),
            float(row.get('prix', 0)),
            float(row.get('ca', 0)),
            bool(row.get('isWeb', False)),
            str(row.get('ville', '')),
            str(row.get('cp', ''))
        ) for _, row in batch.iterrows()]
        
        execute_values(
            cur,
            """INSERT INTO transactions (facture, carte, depot, date, produit, quantite, prix, ca, is_web, ville, cp)
               VALUES %s ON CONFLICT DO NOTHING""",
            values
        )
        conn.commit()
        
        if (i // BATCH_SIZE) % 10 == 0:  # Log tous les 10 batchs
            log_progress('TRANSACTIONS', min(i + BATCH_SIZE, total), total)
    
    cur.close()
    conn.close()
    print(f"✅ {total:,} transactions importées")

def main():
    print("🚀 Début import Parquet → PostgreSQL\n")
    
    os.chdir('/Users/marceau/Desktop/test data/decor-analytics/backend')
    
    try:
        # Ordre important (relations)
        import_clients()
        import_produits()
        import_magasins()
        import_transactions()
        
        print("\n✅ Import terminé!")
        
        # Stats finales
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        cur.execute('SELECT COUNT(*) FROM clients')
        print(f"\n📊 Clients: {cur.fetchone()[0]:,}")
        
        cur.execute('SELECT COUNT(*) FROM produits')
        print(f"📊 Produits: {cur.fetchone()[0]:,}")
        
        cur.execute('SELECT COUNT(*) FROM magasins')
        print(f"📊 Magasins: {cur.fetchone()[0]:,}")
        
        cur.execute('SELECT COUNT(*) FROM transactions')
        print(f"📊 Transactions: {cur.fetchone()[0]:,}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"\n❌ Erreur: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
