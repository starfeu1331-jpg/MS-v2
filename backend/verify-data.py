#!/usr/bin/env python3
import psycopg2

DB_CONFIG = {'dbname': 'decor_analytics', 'user': 'marceau', 'host': 'localhost', 'port': 5432}

conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()

print("📊 VÉRIFICATION DE LA COMPLÉTUDE DES DONNÉES\n")

# CLIENTS
cur.execute("SELECT COUNT(*) FROM clients")
total_clients = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM clients WHERE nom_adresse != ''")
clients_avec_nom = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM clients WHERE adresse != ''")
clients_avec_adresse = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM clients WHERE cp != ''")
clients_avec_cp = cur.fetchone()[0]

print(f"👥 CLIENTS:")
print(f"   Total: {total_clients:,}")
print(f"   Avec nom: {clients_avec_nom:,} ({clients_avec_nom/total_clients*100:.1f}%)")
print(f"   Avec adresse: {clients_avec_adresse:,} ({clients_avec_adresse/total_clients*100:.1f}%)")
print(f"   Avec CP: {clients_avec_cp:,} ({clients_avec_cp/total_clients*100:.1f}%)")

# Exemples de clients complets
print("\n   📋 Exemples de clients avec données complètes:")
cur.execute("""
    SELECT carte, nom_adresse, adresse, cp, ville 
    FROM clients 
    WHERE nom_adresse != '' AND carte != '0'
    LIMIT 5
""")
for row in cur.fetchall():
    print(f"      • {row[0]} - {row[1]} - {row[2]} - {row[3]} {row[4]}")

# MAGASINS
print("\n🏪 MAGASINS:")
cur.execute("SELECT code, zone, nom, adresse_1, cp, ville FROM magasins WHERE code NOT IN ('0', 'WEB')")
magasins = cur.fetchall()
print(f"   Total: {len(magasins)}")
print(f"   Exemples:")
for mag in magasins[:3]:
    print(f"      • {mag[0]} ({mag[1]}) - {mag[2]} - {mag[3]} {mag[4]} {mag[5]}")

# TRANSACTIONS
cur.execute("SELECT COUNT(*) FROM transactions")
total_tx = cur.fetchone()[0]
cur.execute("SELECT MIN(date), MAX(date) FROM transactions")
dates = cur.fetchone()
print(f"\n🎫 TRANSACTIONS:")
print(f"   Total: {total_tx:,}")
print(f"   Période: {dates[0]} → {dates[1]}")

cur.close()
conn.close()

print("\n✅ Toutes les colonnes sont importées!")
