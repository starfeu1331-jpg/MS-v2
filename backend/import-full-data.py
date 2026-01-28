#!/usr/bin/env python3
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

DB_CONFIG = {'dbname': 'decor_analytics', 'user': 'marceau', 'host': 'localhost', 'port': 5432}
DATA_DIR = '/Users/marceau/Desktop/test data/data/nouveaux'

def log_progress(phase, current, total):
    pct = int((current / total) * 100) if total > 0 else 0
    print(f"[{phase}] {pct}% - {current:,} / {total:,}")

# Import CLIENTS - TOUTES LES COLONNES
def import_clients():
    print("\n👥 Import CLIENTS (toutes colonnes)...")
    df = pd.read_csv(f'{DATA_DIR}/client.csv', sep=';', encoding='utf-8', low_memory=False, on_bad_lines='skip')
    print(f"   Lignes: {len(df):,}")
    
    df = df.fillna('')
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Vider d'abord
    cur.execute("TRUNCATE TABLE clients CASCADE")
    conn.commit()
    
    # Client "0"
    cur.execute("INSERT INTO clients (carte, ville) VALUES ('0', 'Anonyme')")
    conn.commit()
    
    BATCH_SIZE = 5000
    total = 0
    
    for i in range(0, len(df), BATCH_SIZE):
        batch = df.iloc[i:i+BATCH_SIZE]
        values = []
        
        for _, row in batch.iterrows():
            carte = str(row.iloc[0]).strip()
            if not carte or carte == '0':
                continue
            
            values.append((
                carte,                      # carte
                str(row.iloc[1]),          # date_creation
                str(row.iloc[2]),          # statut
                str(row.iloc[3]),          # date_validite
                str(row.iloc[4]),          # civilite
                str(row.iloc[5]),          # date_naissance
                str(row.iloc[6]),          # sexe
                str(row.iloc[7]),          # nom_adresse
                str(row.iloc[8]),          # adresse
                str(row.iloc[9]),          # adresse_2
                str(row.iloc[10]),         # adresse_4
                str(row.iloc[11]),         # cp
                str(row.iloc[12])          # ville
            ))
        
        if values:
            execute_values(
                cur,
                """INSERT INTO clients (carte, date_creation, statut, date_validite, civilite, date_naissance, sexe, nom_adresse, adresse, adresse_2, adresse_4, cp, ville)
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

# Import PRODUITS - TOUTES LES COLONNES (déjà complet)
def import_produits():
    print("\n📦 Import PRODUITS...")
    df = pd.read_csv(f'{DATA_DIR}/Produits.csv', sep=';', encoding='utf-8')
    print(f"   Lignes: {len(df):,}")
    
    df = df.fillna('')
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    cur.execute("TRUNCATE TABLE produits CASCADE")
    cur.execute("INSERT INTO produits (id, famille) VALUES ('0', 'Inconnu')")
    conn.commit()
    
    values = []
    for _, row in df.iterrows():
        prod_id = str(row.iloc[0]).strip()
        if not prod_id:
            continue
        values.append((
            prod_id,
            str(row.iloc[1]),
            str(row.iloc[2]),
            str(row.iloc[3]),
            str(row.iloc[4])
        ))
    
    execute_values(cur, 'INSERT INTO produits (id, famille, sous_famille, sous_sous_famille, sous_sous_sous_famille) VALUES %s ON CONFLICT (id) DO NOTHING', values)
    conn.commit()
    
    cur.close()
    conn.close()
    print(f"✅ {len(values):,} produits importés")

# Import MAGASINS - TOUTES LES COLONNES
def import_magasins():
    print("\n🏪 Import MAGASINS (toutes colonnes)...")
    df = pd.read_csv(f'{DATA_DIR}/Points de vente.csv', sep=';', encoding='utf-8')
    print(f"   Lignes: {len(df):,}")
    
    df = df.fillna('')
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    cur.execute("TRUNCATE TABLE magasins CASCADE")
    cur.execute("INSERT INTO magasins (code, nom, zone) VALUES ('0', 'Inconnu', ''), ('WEB', 'Ventes Web', 'WEB')")
    conn.commit()
    
    values = []
    for _, row in df.iterrows():
        code = str(row.iloc[1]).strip()
        if not code:
            continue
        values.append((
            code,                   # code
            str(row.iloc[0]),      # zone
            str(row.iloc[2]),      # nom
            str(row.iloc[3]),      # adresse_1
            str(row.iloc[4]),      # adresse_2
            str(row.iloc[5]),      # adresse_3
            str(row.iloc[6]),      # cp
            str(row.iloc[7])       # ville
        ))
    
    execute_values(cur, 'INSERT INTO magasins (code, zone, nom, adresse_1, adresse_2, adresse_3, cp, ville) VALUES %s ON CONFLICT (code) DO NOTHING', values)
    conn.commit()
    
    cur.close()
    conn.close()
    print(f"✅ {len(values):,} magasins importés")

# Import TRANSACTIONS
def import_transactions():
    print("\n🎫 Import TRANSACTIONS...")
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    cur.execute("TRUNCATE TABLE transactions")
    cur.execute("ALTER TABLE transactions DISABLE TRIGGER ALL")
    conn.commit()
    
    print("   Lecture par chunks...")
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
        chunk = chunk.fillna({'N° Carte fidélité': '0'})
        
        for _, row in chunk.iterrows():
            facture = str(row.iloc[1]).strip()
            if not facture:
                continue
            
            carte = str(row.iloc[0]).strip() or '0'
            depot = str(row.iloc[2]).strip() or '0'
            date_str = str(row.iloc[3])
            produit = str(row.iloc[4]).strip() or '0'
            
            try:
                date_val = pd.to_datetime(date_str).strftime('%Y-%m-%d %H:%M:%S')
            except:
                continue
            
            quantite = float(str(row.iloc[5]).replace(',', '.')) if len(row) > 5 else 0
            prix = float(str(row.iloc[6]).replace(',', '.')) if len(row) > 6 else 0
            ca = quantite * prix
            
            buffer.append((facture, carte, depot, date_val, produit, quantite, prix, ca, False, '', ''))
            
            if len(buffer) >= BATCH_SIZE:
                execute_values(
                    cur,
                    """INSERT INTO transactions (facture, carte, depot, date, produit, quantite, prix, ca, is_web, ville, cp)
                       VALUES %s""",
                    buffer
                )
                conn.commit()
                total_imported += len(buffer)
                buffer = []
        
        if chunk_num % 10 == 0:
            print(f"   Traité: {total_imported:,} lignes...")
    
    if buffer:
        execute_values(
            cur,
            """INSERT INTO transactions (facture, carte, depot, date, produit, quantite, prix, ca, is_web, ville, cp)
               VALUES %s""",
            buffer
        )
        conn.commit()
        total_imported += len(buffer)
    
    cur.execute("ALTER TABLE transactions ENABLE TRIGGER ALL")
    conn.commit()
    
    cur.close()
    conn.close()
    print(f"✅ {total_imported:,} transactions importées")

def main():
    print("🚀 Import COMPLET avec TOUTES les colonnes\n")
    
    try:
        import_clients()
        import_produits()
        import_magasins()
        import_transactions()
        
        print("\n✅ Import terminé!")
        
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
        
        print("\n📋 Exemple client avec toutes les colonnes:")
        cur.execute("SELECT carte, nom_adresse, adresse, adresse_2, cp, ville FROM clients WHERE nom_adresse != '' LIMIT 1")
        row = cur.fetchone()
        if row:
            print(f"   Carte: {row[0]}")
            print(f"   Nom: {row[1]}")
            print(f"   Adresse: {row[2]} {row[3]}")
            print(f"   CP/Ville: {row[4]} {row[5]}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"\n❌ Erreur: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
