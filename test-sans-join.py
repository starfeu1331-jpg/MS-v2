#!/usr/bin/env python3
import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("\n" + "="*80)
print("🗺️  TEST AVEC CP DEPUIS TRANSACTIONS DIRECTEMENT (SANS JOIN)")
print("="*80 + "\n")

print("M32 - TOP 20 CP avec threshold >= 10 clients:")
print("-" * 80)
cur.execute("""
    SELECT 
        t.cp,
        STRING_AGG(DISTINCT t.ville, ', ') as villes,
        COUNT(DISTINCT t.carte) as nb_clients,
        SUM(t.ca) as ca_total,
        COUNT(*) as nb_tx
    FROM transactions t
    WHERE t.depot = '32'
        AND t.ca > 0
        AND t.cp IS NOT NULL 
        AND t.cp != ''
    GROUP BY t.cp
    HAVING COUNT(DISTINCT t.carte) >= 10
    ORDER BY SUM(t.ca) DESC
    LIMIT 20
""")

results = cur.fetchall()
print(f"{'CP':<8} {'Clients':<8} {'CA (€)':<12} {'Tx':<6} Villes")
print("-" * 80)
for cp, villes, clients, ca, tx in results:
    villes_short = (villes or '')[:40]
    print(f"{cp:<8} {clients:<8} {ca:<12,.0f} {tx:<6} {villes_short}")

print(f"\n✅ TOTAL: {len(results)} zones avec >= 10 clients\n")

# Compter avec différents thresholds
print("Nombre de zones avec différents thresholds:")
print("-" * 80)
for threshold in [1, 2, 5, 10, 20]:
    cur.execute("""
        SELECT COUNT(*) FROM (
            SELECT t.cp
            FROM transactions t
            WHERE t.depot = '32'
                AND t.ca > 0
                AND t.cp IS NOT NULL 
                AND t.cp != ''
            GROUP BY t.cp
            HAVING COUNT(DISTINCT t.carte) >= %s
        ) sub
    """, (threshold,))
    count = cur.fetchone()[0]
    print(f"   >= {threshold:2d} clients: {count:3d} zones")

print("\n" + "="*80 + "\n")

cur.close()
conn.close()
