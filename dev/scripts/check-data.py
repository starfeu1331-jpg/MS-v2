#!/usr/bin/env python3
"""Vérification rapide des données dans la base"""

import duckdb
from pathlib import Path

DB_FILE = Path(__file__).parent.parent / "public" / "duckdb.db"

conn = duckdb.connect(str(DB_FILE), read_only=True)

print("📊 Vérification des données\n")
print("="*60)

# Compter les lignes
print("\n📈 Nombre de lignes:")
for table in ['clients', 'produits', 'magasins', 'transactions']:
    count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"   {table:15s}: {count:>12,}")

# Vérifier les transactions
print("\n💰 Statistiques transactions:")
result = conn.execute("""
    SELECT 
        COUNT(*) as nb_trans,
        SUM(ca) as ca_total,
        AVG(ca) as ca_moyen,
        MIN(date) as date_min,
        MAX(date) as date_max
    FROM transactions
""").fetchone()

print(f"   Transactions:  {result[0]:>12,}")
print(f"   CA Total:      {result[1]:>12,.2f} €")
print(f"   CA Moyen:      {result[2]:>12,.2f} €")
print(f"   Date min:      {result[3]}")
print(f"   Date max:      {result[4]}")

# Vérifier un échantillon
print("\n📋 Échantillon de 5 transactions:")
sample = conn.execute("""
    SELECT facture, date, carte, produit, quantite, ca
    FROM transactions
    LIMIT 5
""").fetchall()

for row in sample:
    print(f"   Facture {row[0]} | {row[1]} | Carte {row[2]} | Produit {row[3]} | Qté {row[4]} | CA {row[5]:.2f}€")

# Vérifier les colonnes
print("\n📋 Colonnes de la table transactions:")
cols = conn.execute("PRAGMA table_info(transactions)").fetchall()
for col in cols:
    print(f"   {col[1]:20s} {col[2]}")

conn.close()
print("\n" + "="*60)
