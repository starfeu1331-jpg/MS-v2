#!/usr/bin/env python3
import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("\n=== ANALYSE COUVERTURE CLIENTS PAR MAGASIN ===\n")
cur.execute("""
    SELECT 
        t.depot,
        m.nom,
        COUNT(DISTINCT t.carte) as clients_dans_tx,
        COUNT(DISTINCT c.carte) as clients_dans_table,
        (COUNT(DISTINCT c.carte) * 100.0 / COUNT(DISTINCT t.carte))::numeric(5,1) as pct_couverture
    FROM transactions t
    LEFT JOIN clients c ON t.carte = c.carte
    LEFT JOIN magasins m ON t.depot = m.code
    WHERE t.ca > 0 AND t.depot != '1'
    GROUP BY t.depot, m.nom
    ORDER BY pct_couverture ASC
""")

print(f"{'Code':<6} {'Nom':<30} {'TX Clients':<12} {'Table Clients':<15} {'%'}")
print("-" * 80)
for depot, nom, tx_clients, table_clients, pct in cur.fetchall():
    nom_short = (nom or "Inconnu")[:28]
    print(f"{depot:<6} {nom_short:<30} {tx_clients:>12,} {table_clients:>15,} {float(pct):>6.1f}%")

cur.close()
conn.close()
