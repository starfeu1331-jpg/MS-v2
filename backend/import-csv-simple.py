#!/usr/bin/env python3
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os

DB_CONFIG = {
    'dbname': 'decor_analytics',
    'user': 'marceau',
    'host': 'localhost',
    'port': 5432
}

DATA_DIR = '/Users/marceau/Desktop/test data/data/nouveaux'

def log_progress(phase, current, total):
    pct = int((current / total) * 100) if total > 0 else 0
    print(f"[{phase}] {pct}% - {current:,} / {total:,}")

# Import CLIENTS
def import_clients():
    print("\n👥 Import CLIENTS...")
    df = pd.read_csv(f'{DATA_DIR}/client.csv', sep=';', encoding='utf-8', low_memory=False, on_bad_lines='skip')
    print(f"   Lignes lues: {len(df):,}")
    print(f"   Colonnes: {list(df.columns)}")
    
    # Nettoyer
    df = df.fillna('')
    cols = list(df.columns)
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Ajouter client "0"
    cur.execute("INSERT INTO clients (carte, ville) VALUES ('0', 'Anonyme') ON CONFLICT (carte) DO NOTHING")
    conn.commit()
    
    BATCH_SIZE = 5000
    total = 0
    
    for i in range(0, len(df), BATCH_SIZE):
        batch = df.iloc[i:i+BATCH_SIZE]
        values = []
        
        for _, row in batch.iterrows():
            carte = str(row[cols[0]] if len(cols) > 0 else '').strip()
            if not carte or carte == '0':
                continue
                
            values.append((
                carte,
                str(row[cols[1]] if len(cols) > 1 else ''),
                str(row[cols[3]] if len(cols) > 3 else ''),
                str(row[cols[2]] if len(cols) > 2 else ''),
                str(row[cols[4]] if len(cols) > 4 else ''),
                str(row[cols[6]] if len(cols) > 6 else ''),
                str(row[cols[5]] if len(cols) > 5 else ''),
                str(row[cols[11]] if len(cols) > 11 else ''),
                str(row[cols[12]] if len(cols) > 12 else '')
            ))
        
        if values:
            execute_values(
                cur,
                """INSERT INTO clients (carte, date_creation, date_validite, statut, civilite, sexe, date_naissance, cp, ville)
                   VALUES %s ON CONFLICT (carte) DO NOTHING""",
                values
            )
            conn.commit()
            total += len(values)
            
        if (i // BATCH_SIZE) % 20 == 0:
            log_progress('CLIENTS', min(i + BATCH_SIZE, len(df)), len(df))
    
    cur.close()
    conn.close()
    print(f"✅ {total:,} clients importés")

# Import PRODUITS
def import_produits():
    print("\n📦 Import PRODUITS...")
    df = pd.read_csv(f'{DATA_DIR}/Produits.csv', sep=';', encoding='utf-8')
    print(f"   Lignes lues: {len(df):,}")
    print(f"   Colonnes: {list(df.columns)}")
    
    df = df.fillna('')
    cols = list(df.columns)
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Ajouter produit "0"
    cur.execute("INSERT INTO produits (id, famille) VALUES ('0', 'Inconnu') ON CONFLICT (id) DO NOTHING")
    conn.commit()
    
    values = []
    for _, row in df.iterrows():
        prod_id = str(row[cols[0]] if len(cols) > 0 else '').strip()
        if not prod_id:
            continue
            
        values.append((
            prod_id,
            str(row[cols[1]] if len(cols) > 1 else 'Inconnu'),
            str(row[cols[2]] if len(cols) > 2 else ''),
            str(row[cols[3]] if len(cols) > 3 else ''),
            str(row[cols[4]] if len(cols) > 4 else '')
        ))
    
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

# Import MAGASINS
def import_magasins():
    print("\n🏪 Import MAGASINS...")
    df = pd.read_csv(f'{DATA_DIR}/Points de vente.csv', sep=';', encoding='utf-8')
    print(f"   Lignes lues: {len(df):,}")
    print(f"   Colonnes: {list(df.columns)}")
    
    df = df.fillna('')
    cols = list(df.columns)
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Ajouter magasin "0"
    cur.execute("INSERT INTO magasins (code, nom) VALUES ('0', 'Inconnu') ON CONFLICT (code) DO NOTHING")
    conn.commit()
    
    values = []
    for _, row in df.iterrows():
        code = str(row[cols[1]] if len(cols) > 1 else '').strip()  # N° Dépôt en colonne 1
        if not code:
            continue
            
        values.append((
            code,
            str(row[cols[2]] if len(cols) > 2 else f'M{code}'),  # Intitulé dépôt
            str(row[cols[0]] if len(cols) > 0 else ''),  # Zone
            str(row[cols[7]] if len(cols) > 7 else ''),  # Ville
            str(row[cols[6]] if len(cols) > 6 else '')   # CP
        ))
    
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

# Import TRANSACTIONS (streaming avec chunks)
def import_transactions():
    print("\n🎫 Import TRANSACTIONS...")
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Désactiver temporairement les contraintes FK
    print("   Désactivation contraintes FK...")
    cur.execute("ALTER TABLE transactions DISABLE TRIGGER ALL")
    conn.commit()
    
    print("   Lecture du fichier par chunks...")
    CHUNK_SIZE = 10000
    BATCH_SIZE = 2000
    total_imported = 0
    buffer = []
    
    for chunk_num, chunk in enumerate(pd.read_csv(
        f'{DATA_DIR}/détail transactions.csv',
        sep=';',
        encoding='utf-8',
        chunksize=CHUNK_SIZE,
        low_memory=False,
        on_bad_lines='skip'
    )):
        cols = list(chunk.columns)
        chunk = chunk.fillna({'carte': '0', 'ville': '', 'cp': ''})
        
        for _, row in chunk.iterrows():
            facture = str(row[cols[1]] if len(cols) > 1 else '').strip()
            if not facture:
                continue
                
            carte = str(row[cols[0]] if len(cols) > 0 else '0').strip()
            depot = str(row[cols[2]] if len(cols) > 2 else '0').strip()
            date_str = str(row[cols[3]] if len(cols) > 3 else '')
            produit = str(row[cols[4]] if len(cols) > 4 else '0').strip()
            
            try:
                date_val = pd.to_datetime(date_str).strftime('%Y-%m-%d %H:%M:%S')
            except:
                continue
                
            quantite = float(str(row[cols[5]] if len(cols) > 5 else '0').replace(',', '.')) if len(cols) > 5 else 0
            prix = float(str(row[cols[6]] if len(cols) > 6 else '0').replace(',', '.')) if len(cols) > 6 else 0
            ca = quantite * prix
            
            buffer.append((facture, carte, depot, date_val, produit, quantite, prix, ca, False, '', ''))
            
            if len(buffer) >= BATCH_SIZE:
                execute_values(
                    cur,
                    """INSERT INTO transactions (facture, carte, depot, date, produit, quantite, prix, ca, is_web, ville, cp)
                       VALUES %s ON CONFLICT DO NOTHING""",
                    buffer
                )
                conn.commit()
                total_imported += len(buffer)
                buffer = []
                
        if chunk_num % 10 == 0:
            print(f"   Traité: {total_imported:,} lignes...")
    
    # Dernier batch
    if buffer:
        execute_values(
            cur,
            """INSERT INTO transactions (facture, carte, depot, date, produit, quantite, prix, ca, is_web, ville, cp)
               VALUES %s ON CONFLICT DO NOTHING""",
            buffer
        )
        conn.commit()
        total_imported += len(buffer)
    
    # Réactiver les contraintes
    print("   Réactivation contraintes FK...")
    cur.execute("ALTER TABLE transactions ENABLE TRIGGER ALL")
    conn.commit()
    
    cur.close()
    conn.close()
    print(f"✅ {total_imported:,} transactions importées")

def main():
    print("🚀 Début import CSV → PostgreSQL\n")
    
    try:
        # Nettoyage
        print("🧹 Nettoyage tables...")
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        cur.execute("TRUNCATE TABLE transactions CASCADE")
        cur.execute("TRUNCATE TABLE clients CASCADE")
        cur.execute("TRUNCATE TABLE produits CASCADE")
        cur.execute("TRUNCATE TABLE magasins CASCADE")
        conn.commit()
        cur.close()
        conn.close()
        
        import_clients()
        import_produits()
        import_magasins()
        import_transactions()
        
        print("\n✅ Import terminé!")
        
        # Stats
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
