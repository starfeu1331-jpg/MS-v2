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

cur.execute("SELECT COUNT(*), COUNT(nom), COUNT(prenom), COUNT(email), COUNT(telephone) FROM clients")
total, noms, prenoms, emails, tels = cur.fetchone()
print(f"📊 Statistiques clients:")
print(f"   Total: {total:,}")
print(f"   Avec nom: {noms:,} ({noms/total*100:.1f}%)")
print(f"   Avec prénom: {prenoms:,} ({prenoms/total*100:.1f}%)")
print(f"   Avec email: {emails:,} ({emails/total*100:.1f}%)")
print(f"   Avec téléphone: {tels:,} ({tels/total*100:.1f}%)")

print("\n📋 10 premiers clients avec nom:")
cur.execute("SELECT carte, nom, prenom, email, telephone FROM clients WHERE nom IS NOT NULL LIMIT 10")
for row in cur.fetchall():
    print(f"  Carte {row[0]:8s} | Nom: {str(row[1] or '')[:15]:15s} | Prénom: {str(row[2] or '')[:15]:15s}")

cur.close()
conn.close()
