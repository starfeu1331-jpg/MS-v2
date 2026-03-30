#!/usr/bin/env python3
import psycopg2

DATABASE_URL = None
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            DATABASE_URL = line.split('=', 1)[1].strip().strip('"')
            break

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT COUNT(*), COUNT(nom), COUNT(prenom) FROM clients")
total, avec_nom, avec_prenom = cur.fetchone()
print(f"Total clients: {total:,}")
print(f"Avec nom: {avec_nom:,} ({avec_nom/total*100:.1f}%)")
print(f"Avec prénom: {avec_prenom:,} ({avec_prenom/total*100:.1f}%)")

print("\n10 exemples:")
cur.execute("SELECT carte, nom, prenom FROM clients WHERE nom IS NOT NULL OR prenom IS NOT NULL LIMIT 10")
for row in cur.fetchall():
    print(f"{row[0]:10s} | Nom: {str(row[1] or '')[:15]:15s} | Prénom: {str(row[2] or '')[:15]:15s}")

cur.close()
conn.close()
