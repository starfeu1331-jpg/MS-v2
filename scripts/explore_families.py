#!/usr/bin/env python3
"""
Exploration: sous-familles rideaux/papier peint + liste magasins
"""
import psycopg2

DB_URL = "postgresql://decordb:OVHdecordb26@yu4496-002.eu.clouddb.ovh.net:35847/basedecordb"
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

print("=== SOUS-FAMILLES contenant rideau/voilage/papier peint ===")
cur.execute("""
    SELECT DISTINCT famille, sous_famille, sous_sous_famille, COUNT(*) as nb
    FROM produits
    WHERE LOWER(sous_famille) LIKE '%%rideau%%'
       OR LOWER(sous_famille) LIKE '%%voilage%%'
       OR LOWER(sous_famille) LIKE '%%papier%%'
       OR LOWER(sous_famille) LIKE '%%decor%%'
       OR LOWER(sous_famille) LIKE '%%décor%%'
       OR LOWER(sous_sous_famille) LIKE '%%rideau%%'
       OR LOWER(sous_sous_famille) LIKE '%%voilage%%'
       OR LOWER(sous_sous_famille) LIKE '%%papier%%'
    GROUP BY famille, sous_famille, sous_sous_famille
    ORDER BY famille, sous_famille, sous_sous_famille
""")
for row in cur.fetchall():
    print(f"  {row[0]} > {row[1]} > {row[2]}: {row[3]} produits")

print()
print("=== MAGASINS ===")
cur.execute("SELECT code, nom, ville FROM magasins ORDER BY code")
for row in cur.fetchall():
    print(f"  {row[0]} - {row[1]} ({row[2]})")

print()
cur.execute("SELECT MIN(date), MAX(date) FROM transactions WHERE date >= '2026-01-01'")
row = cur.fetchone()
print(f"Transactions 2026: du {row[0]} au {row[1]}")

# Toutes les sous-familles de Ameublement (rideaux probablement là)
print()
print("=== SOUS-FAMILLES DE AMEUBLEMENT ===")
cur.execute("""
    SELECT sous_famille, COUNT(*) FROM produits
    WHERE famille = 'Ameublement'
    GROUP BY sous_famille ORDER BY sous_famille
""")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} produits")

# Sous-sous-familles intéressantes
print()
print("=== SOUS-SOUS-FAMILLES DE 'Décors muraux' ===")
cur.execute("""
    SELECT sous_sous_famille, COUNT(*) FROM produits
    WHERE sous_famille = 'Décors muraux'
    GROUP BY sous_sous_famille ORDER BY sous_sous_famille
""")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} produits")

conn.close()
