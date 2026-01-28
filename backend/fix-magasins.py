#!/usr/bin/env python3
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

DB_CONFIG = {'dbname': 'decor_analytics', 'user': 'marceau', 'host': 'localhost', 'port': 5432}
DATA_DIR = '/Users/marceau/Desktop/test data/data/nouveaux'

df = pd.read_csv(f'{DATA_DIR}/Points de vente.csv', sep=';', encoding='utf-8')
print(f'📊 Lignes: {len(df)}')
print(f'📊 Colonnes: {list(df.columns)}')

df = df.fillna('')
cols = list(df.columns)

conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()

# Ajouter magasin WEB
cur.execute("INSERT INTO magasins (code, nom) VALUES ('WEB', 'Ventes Web') ON CONFLICT (code) DO NOTHING")
conn.commit()

values = []
for _, row in df.iterrows():
    code = str(row[cols[1]] if len(cols) > 1 else '').strip()
    if not code:
        continue
    values.append((
        code,
        str(row[cols[2]] if len(cols) > 2 else f'M{code}'),
        str(row[cols[0]] if len(cols) > 0 else ''),
        str(row[cols[7]] if len(cols) > 7 else ''),
        str(row[cols[6]] if len(cols) > 6 else '')
    ))

execute_values(cur, 'INSERT INTO magasins (code, nom, zone, ville, cp) VALUES %s ON CONFLICT (code) DO UPDATE SET nom=EXCLUDED.nom, zone=EXCLUDED.zone, ville=EXCLUDED.ville, cp=EXCLUDED.cp', values)
conn.commit()

cur.execute('SELECT COUNT(*) FROM magasins')
print(f'✅ Total magasins: {cur.fetchone()[0]}')

cur.execute('SELECT code, nom FROM magasins ORDER BY code')
for row in cur.fetchall():
    print(f'   - {row[0]}: {row[1]}')

cur.close()
conn.close()
