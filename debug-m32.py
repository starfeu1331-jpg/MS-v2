#!/usr/bin/env python3
import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("\n=== M32: DISTRIBUTION DES CLIENTS PAR CP (TOP 30) ===\n")
cur.execute("""
    SELECT 
        c.cp,
        STRING_AGG(DISTINCT c.ville, ', ') as villes,
        COUNT(DISTINCT t.carte) as nb_clients,
        SUM(t.ca) as ca_total,
        COUNT(*) as nb_tx
    FROM transactions t
    INNER JOIN clients c ON t.carte = c.carte
    WHERE t.depot = '32'
        AND t.ca > 0
        AND c.cp IS NOT NULL 
        AND c.cp != ''
    GROUP BY c.cp
    ORDER BY nb_clients DESC, ca_total DESC
    LIMIT 30
""")

print(f"{'CP':<8} {'Clients':<8} {'CA (€)':<12} {'Tx':<6} Villes")
print("-" * 80)
for cp, villes, clients, ca, tx in cur.fetchall():
    villes_short = villes[:40] if villes else ''
    print(f"{cp:<8} {clients:<8} {ca:<12,.0f} {tx:<6} {villes_short}")

print("\n=== M12 (ALES): DISTRIBUTION (TOP 10 pour comparaison) ===\n")
cur.execute("""
    SELECT 
        c.cp,
        STRING_AGG(DISTINCT c.ville, ', ') as villes,
        COUNT(DISTINCT t.carte) as nb_clients,
        SUM(t.ca) as ca_total,
        COUNT(*) as nb_tx
    FROM transactions t
    INNER JOIN clients c ON t.carte = c.carte
    WHERE t.depot = '12'
        AND t.ca > 0
        AND c.cp IS NOT NULL 
        AND c.cp != ''
    GROUP BY c.cp
    ORDER BY nb_clients DESC
    LIMIT 10
""")

print(f"{'CP':<8} {'Clients':<8} {'CA (€)':<12} {'Tx':<6} Villes")
print("-" * 80)
for cp, villes, clients, ca, tx in cur.fetchall():
    villes_short = villes[:40] if villes else ''
    print(f"{cp:<8} {clients:<8} {ca:<12,.0f} {tx:<6} {villes_short}")

# Vérifier si le problème vient des NULL dans clients.cp
print("\n=== VÉRIF: Transactions M32 avec clients SANS CP ===\n")
cur.execute("""
    SELECT 
        COUNT(*) as nb_tx,
        COUNT(DISTINCT t.carte) as nb_clients,
        SUM(t.ca) as ca_total
    FROM transactions t
    INNER JOIN clients c ON t.carte = c.carte
    WHERE t.depot = '32'
        AND t.ca > 0
        AND (c.cp IS NULL OR c.cp = '')
""")
result = cur.fetchone()
print(f"Transactions avec clients SANS CP: {result[0]:,} tx, {result[1]:,} clients, {result[2]:,.0f}€ CA")

cur.close()
conn.close()
