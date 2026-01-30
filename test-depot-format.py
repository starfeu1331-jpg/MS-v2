#!/usr/bin/env python3
"""
Test direct de la base de données pour comprendre le format des codes depot
et vérifier les données réelles pour M32
"""
import psycopg2
import os

DATABASE_URL = "postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("\n" + "="*80)
    print("🔍 ANALYSE DU FORMAT DES CODES DEPOT DANS LA BASE")
    print("="*80 + "\n")
    
    # 1. Voir tous les formats de codes depot uniques
    print("1️⃣  LISTE DE TOUS LES CODES DEPOT UNIQUES:")
    print("-" * 80)
    cur.execute("""
        SELECT DISTINCT depot, COUNT(*) as nb_tx
        FROM transactions
        WHERE depot IS NOT NULL AND depot != ''
        GROUP BY depot
        ORDER BY depot
    """)
    
    all_depots = cur.fetchall()
    for depot, count in all_depots:
        print(f"   Code: '{depot}' → {count:,} transactions")
    
    print(f"\n   📊 Total: {len(all_depots)} codes depot différents\n")
    
    # 2. Chercher spécifiquement les variations de "32"
    print("\n2️⃣  RECHERCHE DE TOUTES LES VARIATIONS DU CODE '32':")
    print("-" * 80)
    
    variations = ['32', 'M32', 'm32', '032', ' 32', '32 ', 'Mag32', 'MAG32']
    for var in variations:
        cur.execute("""
            SELECT COUNT(*) as nb_tx, COUNT(DISTINCT carte) as nb_clients, SUM(ca) as ca_total
            FROM transactions
            WHERE depot = %s AND ca > 0
        """, (var,))
        result = cur.fetchone()
        if result and result[0] > 0:
            print(f"   ✅ Code '{var}': {result[0]:,} tx, {result[1]:,} clients, {result[2]:,.0f}€ CA")
        else:
            print(f"   ❌ Code '{var}': 0 transactions")
    
    # 3. Analyse détaillée pour le code trouvé
    print("\n3️⃣  ANALYSE DÉTAILLÉE DU CODE AVEC LE PLUS DE TRANSACTIONS POUR '32':")
    print("-" * 80)
    
    # Trouver quel code a le plus de transactions
    cur.execute("""
        SELECT depot, COUNT(*) as nb_tx
        FROM transactions
        WHERE (depot = '32' OR depot = 'M32' OR depot = 'm32' OR depot LIKE '%32%')
        AND ca > 0
        GROUP BY depot
        ORDER BY nb_tx DESC
        LIMIT 1
    """)
    
    best_match = cur.fetchone()
    if best_match:
        depot_code = best_match[0]
        print(f"\n   🎯 CODE TROUVÉ: '{depot_code}' avec {best_match[1]:,} transactions\n")
        
        # Stats globales
        cur.execute("""
            SELECT 
                COUNT(*) as nb_tx,
                COUNT(DISTINCT carte) as nb_clients,
                SUM(ca) as ca_total,
                COUNT(DISTINCT facture) as nb_factures
            FROM transactions
            WHERE depot = %s AND ca > 0
        """, (depot_code,))
        
        stats = cur.fetchone()
        print(f"   📊 STATS GLOBALES:")
        print(f"      • Transactions: {stats[0]:,}")
        print(f"      • Clients uniques: {stats[1]:,}")
        print(f"      • CA total: {stats[2]:,.0f}€")
        print(f"      • Factures: {stats[3]:,}")
        
        # Top 10 CP par CA
        print(f"\n   🗺️  TOP 10 DES CP PAR CA (sans filtre de seuil):")
        cur.execute("""
            SELECT 
                c.cp,
                STRING_AGG(DISTINCT c.ville, ', ') as villes,
                COUNT(DISTINCT t.carte) as nb_clients,
                SUM(t.ca) as ca_total,
                COUNT(*) as nb_tx
            FROM transactions t
            INNER JOIN clients c ON t.carte = c.carte
            WHERE t.depot = %s 
                AND t.ca > 0
                AND c.cp IS NOT NULL 
                AND c.cp != ''
            GROUP BY c.cp
            ORDER BY ca_total DESC
            LIMIT 10
        """, (depot_code,))
        
        top_cps = cur.fetchall()
        for i, (cp, villes, nb_clients, ca, nb_tx) in enumerate(top_cps, 1):
            print(f"      {i:2d}. CP {cp} ({villes[:30]}...): {nb_clients} clients, {ca:,.0f}€ CA, {nb_tx} tx")
        
        # Compter combien de CP ont >= 5 clients
        cur.execute("""
            SELECT COUNT(*) as nb_zones
            FROM (
                SELECT c.cp
                FROM transactions t
                INNER JOIN clients c ON t.carte = c.carte
                WHERE t.depot = %s 
                    AND t.ca > 0
                    AND c.cp IS NOT NULL 
                    AND c.cp != ''
                GROUP BY c.cp
                HAVING COUNT(DISTINCT t.carte) >= 5
            ) sub
        """, (depot_code,))
        
        nb_zones_5plus = cur.fetchone()[0]
        print(f"\n   ✅ Nombre de CP avec >= 5 clients: {nb_zones_5plus}")
        
        # Compter combien avec >= 10 clients
        cur.execute("""
            SELECT COUNT(*) as nb_zones
            FROM (
                SELECT c.cp
                FROM transactions t
                INNER JOIN clients c ON t.carte = c.carte
                WHERE t.depot = %s 
                    AND t.ca > 0
                    AND c.cp IS NOT NULL 
                    AND c.cp != ''
                GROUP BY c.cp
                HAVING COUNT(DISTINCT t.carte) >= 10
            ) sub
        """, (depot_code,))
        
        nb_zones_10plus = cur.fetchone()[0]
        print(f"   ✅ Nombre de CP avec >= 10 clients: {nb_zones_10plus}")
    
    else:
        print("   ❌ AUCUN CODE TROUVÉ pour les variations de '32'")
    
    print("\n" + "="*80)
    print("✅ ANALYSE TERMINÉE")
    print("="*80 + "\n")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
