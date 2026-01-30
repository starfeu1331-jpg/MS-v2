#!/usr/bin/env python3
import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("\n" + "="*80)
print("🔍 ANALYSE COMPLÈTE M32 - VÉRIFICATION DES DONNÉES")
print("="*80 + "\n")

# 1. Stats brutes dans transactions
print("1️⃣  STATS BRUTES DANS TRANSACTIONS POUR M32:")
print("-" * 80)
cur.execute("""
    SELECT 
        COUNT(*) as nb_tx,
        COUNT(DISTINCT carte) as nb_clients_uniques,
        SUM(ca) as ca_total
    FROM transactions
    WHERE depot = '32' AND ca > 0
""")
tx_brut = cur.fetchone()
print(f"   Transactions: {tx_brut[0]:,}")
print(f"   Clients uniques (carte): {tx_brut[1]:,}")
print(f"   CA total: {tx_brut[2]:,.0f}€\n")

# 2. Vérifier combien de ces cartes existent dans la table clients
print("2️⃣  VÉRIFICATION DES CARTES DANS TABLE CLIENTS:")
print("-" * 80)
cur.execute("""
    SELECT 
        COUNT(DISTINCT t.carte) as nb_cartes_tx,
        COUNT(DISTINCT c.carte) as nb_cartes_in_clients,
        COUNT(DISTINCT t.carte) - COUNT(DISTINCT c.carte) as nb_cartes_manquantes
    FROM transactions t
    LEFT JOIN clients c ON t.carte = c.carte
    WHERE t.depot = '32' AND t.ca > 0
""")
match_result = cur.fetchone()
print(f"   Cartes dans transactions: {match_result[0]:,}")
print(f"   Cartes trouvées dans table clients: {match_result[1]:,}")
print(f"   Cartes MANQUANTES dans table clients: {match_result[2]:,}\n")

# 3. Pour les cartes qui existent, combien ont un CP ?
print("3️⃣  POUR LES CARTES QUI EXISTENT, COMBIEN ONT UN CP ?")
print("-" * 80)
cur.execute("""
    SELECT 
        COUNT(DISTINCT t.carte) as total_cartes,
        COUNT(DISTINCT CASE WHEN c.cp IS NOT NULL AND c.cp != '' THEN t.carte END) as avec_cp,
        COUNT(DISTINCT CASE WHEN c.cp IS NULL OR c.cp = '' THEN t.carte END) as sans_cp
    FROM transactions t
    INNER JOIN clients c ON t.carte = c.carte
    WHERE t.depot = '32' AND t.ca > 0
""")
cp_result = cur.fetchone()
print(f"   Total cartes avec match: {cp_result[0]:,}")
print(f"   Avec CP renseigné: {cp_result[1]:,}")
print(f"   Sans CP renseigné: {cp_result[2]:,}\n")

# 4. Distribution par CP avec INNER JOIN (ce que fait l'API)
print("4️⃣  TOP 20 CP AVEC INNER JOIN (comme l'API):")
print("-" * 80)
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
    LIMIT 20
""")

print(f"{'CP':<8} {'Clients':<8} {'CA (€)':<12} {'Tx':<6} Villes")
print("-" * 80)
for cp, villes, clients, ca, tx in cur.fetchall():
    villes_short = (villes or '')[:40]
    print(f"{cp:<8} {clients:<8} {ca:<12,.0f} {tx:<6} {villes_short}")

# 5. Compter zones avec différents thresholds
print("\n5️⃣  NOMBRE DE ZONES AVEC DIFFÉRENTS THRESHOLDS:")
print("-" * 80)
for threshold in [1, 2, 5, 10]:
    cur.execute("""
        SELECT COUNT(*) FROM (
            SELECT c.cp
            FROM transactions t
            INNER JOIN clients c ON t.carte = c.carte
            WHERE t.depot = '32'
                AND t.ca > 0
                AND c.cp IS NOT NULL 
                AND c.cp != ''
            GROUP BY c.cp
            HAVING COUNT(DISTINCT t.carte) >= %s
        ) sub
    """, (threshold,))
    count = cur.fetchone()[0]
    print(f"   >= {threshold:2d} clients par CP: {count:3d} zones")

print("\n" + "="*80 + "\n")

cur.close()
conn.close()
