#!/usr/bin/env python3
"""Vérifier les valeurs des colonnes civilite et sexe"""

import psycopg2
from pathlib import Path

env_path = Path(__file__).parent.parent / '.env'
DATABASE_URL = None
with open(env_path, 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            DATABASE_URL = line.split('=', 1)[1].strip().strip('"')
            break

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Vérifier les valeurs distinctes de civilite
cur.execute("""
    SELECT 
        civilite, 
        COUNT(*) as nb
    FROM clients
    WHERE civilite IS NOT NULL AND civilite != ''
    GROUP BY civilite
    ORDER BY nb DESC
    LIMIT 10
""")
print('📊 Valeurs CIVILITE:')
for row in cur.fetchall():
    print(f'   "{row[0]}" : {row[1]:>6,} clients')

# Vérifier les valeurs distinctes de sexe
cur.execute("""
    SELECT 
        sexe, 
        COUNT(*) as nb
    FROM clients
    WHERE sexe IS NOT NULL AND sexe != ''
    GROUP BY sexe
    ORDER BY nb DESC
    LIMIT 10
""")
print('\n📊 Valeurs SEXE:')
for row in cur.fetchall():
    print(f'   "{row[0]}" : {row[1]:>6,} clients')

# Total clients
cur.execute("SELECT COUNT(*) FROM clients")
total = cur.fetchone()[0]
print(f'\n📊 Total clients: {total:,}')

cur.close()
conn.close()
