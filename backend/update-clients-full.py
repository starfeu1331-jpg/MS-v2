#!/usr/bin/env python3
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

DB_CONFIG = {'dbname': 'decor_analytics', 'user': 'marceau', 'host': 'localhost', 'port': 5432}
DATA_DIR = '/Users/marceau/Desktop/test data/data/nouveaux'

print("📊 Mise à jour des infos clients (nom, prénom, adresse)...")
df = pd.read_csv(f'{DATA_DIR}/client.csv', sep=';', encoding='utf-8', low_memory=False, on_bad_lines='skip')
print(f"   Lignes lues: {len(df):,}")

df = df.fillna('')
cols = list(df.columns)

conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()

BATCH_SIZE = 5000
total = 0

for i in range(0, len(df), BATCH_SIZE):
    batch = df.iloc[i:i+BATCH_SIZE]
    updates = []
    
    for _, row in batch.iterrows():
        carte = str(row[cols[0]] if len(cols) > 0 else '').strip()
        if not carte or carte == '0':
            continue
        
        nom_adresse = str(row[cols[7]] if len(cols) > 7 else '')
        adresse_num = str(row[cols[8]] if len(cols) > 8 else '')
        adresse_rue = str(row[cols[9]] if len(cols) > 9 else '')
        adresse_comp = str(row[cols[10]] if len(cols) > 10 else '')
        
        cur.execute("""
            UPDATE clients 
            SET nom_adresse = %s, adresse_num = %s, adresse_rue = %s, adresse_comp = %s
            WHERE carte = %s
        """, (nom_adresse, adresse_num, adresse_rue, adresse_comp, carte))
        total += cur.rowcount
    
    conn.commit()
    
    if (i // BATCH_SIZE) % 20 == 0:
        print(f"   Traité: {min(i + BATCH_SIZE, len(df)):,} / {len(df):,}")

cur.close()
conn.close()

print(f"✅ {total:,} clients mis à jour")
print("\n📋 Exemple de client avec toutes les infos:")

conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()
cur.execute("""
    SELECT carte, nom_adresse, adresse_num, adresse_rue, adresse_comp, cp, ville 
    FROM clients 
    WHERE nom_adresse != '' 
    LIMIT 1
""")
row = cur.fetchone()
if row:
    print(f"   Carte: {row[0]}")
    print(f"   Nom: {row[1]}")
    print(f"   Adresse: {row[2]} {row[3]}")
    if row[4]:
        print(f"   Complément: {row[4]}")
    print(f"   CP/Ville: {row[5]} {row[6]}")

cur.close()
conn.close()
