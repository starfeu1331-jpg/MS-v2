import os
import psycopg2
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
result = urlparse(DATABASE_URL)

conn = psycopg2.connect(
    database=result.path[1:],
    user=result.username,
    password=result.password,
    host=result.hostname,
    port=result.port
)

cur = conn.cursor()

print("\n" + "="*80)
print("COMPARAISON AVANT/APRÈS FILTRAGE DES DÉPÔTS 1, 41, 42".center(80))
print("="*80)

# AVANT (toutes les données)
print("\n📊 AVANT (toutes les transactions)")
print("-"*80)

cur.execute("""
    SELECT 
        COUNT(DISTINCT facture) as tickets,
        COUNT(*) as lignes,
        SUM(ca) as ca_total,
        COUNT(DISTINCT carte) as clients
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2026-01-31'
""")

avant = cur.fetchone()
print(f"  Tickets   : {avant[0]:>10,}")
print(f"  Lignes    : {avant[1]:>10,}")
print(f"  CA Total  : {avant[2]:>10,.2f} €")
print(f"  Clients   : {avant[3]:>10,}")

# APRÈS (sans dépôts 1, 41, 42)
print("\n✅ APRÈS (sans dépôts 1, 41, 42)")
print("-"*80)

cur.execute("""
    SELECT 
        COUNT(DISTINCT facture) as tickets,
        COUNT(*) as lignes,
        SUM(ca) as ca_total,
        COUNT(DISTINCT carte) as clients
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2026-01-31'
    AND depot NOT IN ('1', '41', '42')
""")

apres = cur.fetchone()
print(f"  Tickets   : {apres[0]:>10,}")
print(f"  Lignes    : {apres[1]:>10,}")
print(f"  CA Total  : {apres[2]:>10,.2f} €")
print(f"  Clients   : {apres[3]:>10,}")

# DIFFÉRENCE
print("\n📉 DIFFÉRENCE (lignes retirées)")
print("-"*80)

diff_tickets = avant[0] - apres[0]
diff_lignes = avant[1] - apres[1]
diff_ca = avant[2] - apres[2]
diff_clients = avant[3] - apres[3]

print(f"  Tickets   : {diff_tickets:>10,} (-{100*diff_tickets/avant[0]:.2f}%)")
print(f"  Lignes    : {diff_lignes:>10,} (-{100*diff_lignes/avant[1]:.2f}%)")
print(f"  CA Total  : {diff_ca:>10,.2f} € (-{100*diff_ca/avant[2]:.2f}%)")
print(f"  Clients   : {diff_clients:>10,} (-{100*diff_clients/avant[3]:.2f}%)")

# Détail des dépôts retirés
print("\n🗑️  DÉTAIL DES DÉPÔTS RETIRÉS")
print("-"*80)

for depot in ['1', '41', '42']:
    cur.execute("""
        SELECT 
            COUNT(DISTINCT facture),
            COUNT(*),
            SUM(ca)
        FROM transactions
        WHERE date >= '2025-11-01' AND date <= '2026-01-31'
        AND depot = %s
    """, (depot,))
    
    d = cur.fetchone()
    if d[0] > 0:
        print(f"  Dépôt {depot:>3} : {d[0]:>5} tickets, {d[1]:>5} lignes, {d[2]:>12,.2f} €")

print("\n" + "="*80)
print("✅ Dashboard affichera maintenant uniquement les vraies ventes magasins".center(80))
print("="*80 + "\n")

cur.close()
conn.close()
