#!/usr/bin/env python3
"""Vérification des données 2025"""

import duckdb
from pathlib import Path

DB_FILE = Path(__file__).parent.parent / "public" / "duckdb.db"
conn = duckdb.connect(str(DB_FILE), read_only=True)

print("📊 Analyse des données 2025\n")
print("="*60)

# Transactions 2025
result = conn.execute("""
    SELECT 
        COUNT(*) as nb_trans,
        SUM(ca) as ca_total,
        COUNT(DISTINCT carte) as nb_clients,
        MIN(date) as date_min,
        MAX(date) as date_max
    FROM transactions
    WHERE date >= '2025-01-01' AND date <= '2025-12-31'
""").fetchone()

print(f"\n💰 ANNÉE 2025:")
print(f"   Transactions:  {result[0]:>12,}")
print(f"   CA Total:      {result[1]:>12,.2f} €")
print(f"   Clients:       {result[2]:>12,}")
print(f"   Date min:      {result[3]}")
print(f"   Date max:      {result[4]}")

# Échantillon
print(f"\n📋 Échantillon 2025:")
sample = conn.execute("""
    SELECT facture, date, carte, produit, quantite, ca, depot
    FROM transactions
    WHERE date >= '2025-01-01' AND date <= '2025-12-31'
    LIMIT 5
""").fetchall()

for row in sample:
    print(f"   {row[1]} | Facture {row[0]} | Carte {row[2]} | Produit {row[3]} | CA {row[5]:.2f}€")

# Vérifier les types
print(f"\n📋 Types des colonnes:")
print(f"\nTRANSACTIONS:")
for col in conn.execute("PRAGMA table_info(transactions)").fetchall():
    print(f"   {col[1]:20s} {col[2]}")

print(f"\nCLIENTS:")
for col in conn.execute("PRAGMA table_info(clients)").fetchall():
    print(f"   {col[1]:20s} {col[2]}")

print(f"\nPRODUITS:")
for col in conn.execute("PRAGMA table_info(produits)").fetchall():
    print(f"   {col[1]:20s} {col[2]}")

print("\n" + "="*60)
conn.close()
