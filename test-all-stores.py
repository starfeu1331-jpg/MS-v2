#!/usr/bin/env python3
"""
Analyse des VRAIS gros magasins dans la base
"""
import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("\n" + "="*80)
    print("🏪 ANALYSE DE TOUS LES MAGASINS PAR CA TOTAL")
    print("="*80 + "\n")
    
    cur.execute("""
        SELECT 
            t.depot,
            m.nom,
            COUNT(*) as nb_tx,
            COUNT(DISTINCT t.carte) as nb_clients,
            SUM(t.ca) as ca_total,
            COUNT(DISTINCT t.facture) as nb_factures
        FROM transactions t
        LEFT JOIN magasins m ON t.depot = m.code
        WHERE t.ca > 0
        GROUP BY t.depot, m.nom
        ORDER BY ca_total DESC
    """)
    
    magasins = cur.fetchall()
    
    print(f"{'Code':<6} {'Nom':<30} {'Tx':>8} {'Clients':>8} {'CA (€)':>15} {'Factures':>10}")
    print("-" * 95)
    
    for depot, nom, nb_tx, nb_clients, ca_total, nb_factures in magasins:
        nom_display = (nom or "Inconnu")[:28]
        print(f"{depot:<6} {nom_display:<30} {nb_tx:>8,} {nb_clients:>8,} {ca_total:>15,.0f} {nb_factures:>10,}")
    
    print("\n" + "="*80)
    
    # Pour chaque gros magasin (>1M CA), compter les zones
    print("\n🗺️  ZONES DE CHALANDISE POUR LES GROS MAGASINS (threshold 5 clients):")
    print("="*80 + "\n")
    
    cur.execute("""
        SELECT 
            t.depot,
            m.nom,
            SUM(t.ca) as ca_total
        FROM transactions t
        LEFT JOIN magasins m ON t.depot = m.code
        WHERE t.ca > 0
        GROUP BY t.depot, m.nom
        HAVING SUM(t.ca) > 1000000
        ORDER BY ca_total DESC
    """)
    
    gros_magasins = cur.fetchall()
    
    for depot, nom, ca_total in gros_magasins:
        # Compter les zones avec >= 5 clients
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
        """, (depot,))
        
        nb_zones = cur.fetchone()[0]
        nom_display = (nom or "Inconnu")[:35]
        print(f"   {depot:<6} {nom_display:<35} {ca_total:>12,.0f}€  →  {nb_zones:>3} zones")
    
    print("\n" + "="*80 + "\n")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
