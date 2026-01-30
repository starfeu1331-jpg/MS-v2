#!/usr/bin/env python3
"""
Test pour voir combien de zones chaque magasin aura avec threshold de 1 client
"""
import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("\n" + "="*90)
    print("🗺️  NOMBRE DE ZONES PAR MAGASIN AVEC DIFFÉRENTS THRESHOLDS")
    print("="*90 + "\n")
    
    cur.execute("""
        SELECT 
            t.depot,
            m.nom,
            SUM(t.ca) as ca_total
        FROM transactions t
        LEFT JOIN magasins m ON t.depot = m.code
        WHERE t.ca > 0
        GROUP BY t.depot, m.nom
        ORDER BY ca_total DESC
    """)
    
    magasins = cur.fetchall()
    
    print(f"{'Code':<6} {'Nom':<30} {'CA (€)':>12}  {'≥1':>5} {'≥2':>5} {'≥5':>5} {'≥10':>5}")
    print("-" * 90)
    
    for depot, nom, ca_total in magasins:
        if depot == '1':  # Skip Inconnu
            continue
            
        # Threshold >= 1
        cur.execute("""
            SELECT COUNT(*) FROM (
                SELECT c.cp FROM transactions t
                INNER JOIN clients c ON t.carte = c.carte
                WHERE t.depot = %s AND t.ca > 0 AND c.cp IS NOT NULL AND c.cp != ''
                GROUP BY c.cp
                HAVING COUNT(DISTINCT t.carte) >= 1
            ) sub
        """, (depot,))
        z1 = cur.fetchone()[0]
        
        # Threshold >= 2
        cur.execute("""
            SELECT COUNT(*) FROM (
                SELECT c.cp FROM transactions t
                INNER JOIN clients c ON t.carte = c.carte
                WHERE t.depot = %s AND t.ca > 0 AND c.cp IS NOT NULL AND c.cp != ''
                GROUP BY c.cp
                HAVING COUNT(DISTINCT t.carte) >= 2
            ) sub
        """, (depot,))
        z2 = cur.fetchone()[0]
        
        # Threshold >= 5
        cur.execute("""
            SELECT COUNT(*) FROM (
                SELECT c.cp FROM transactions t
                INNER JOIN clients c ON t.carte = c.carte
                WHERE t.depot = %s AND t.ca > 0 AND c.cp IS NOT NULL AND c.cp != ''
                GROUP BY c.cp
                HAVING COUNT(DISTINCT t.carte) >= 5
            ) sub
        """, (depot,))
        z5 = cur.fetchone()[0]
        
        # Threshold >= 10
        cur.execute("""
            SELECT COUNT(*) FROM (
                SELECT c.cp FROM transactions t
                INNER JOIN clients c ON t.carte = c.carte
                WHERE t.depot = %s AND t.ca > 0 AND c.cp IS NOT NULL AND c.cp != ''
                GROUP BY c.cp
                HAVING COUNT(DISTINCT t.carte) >= 10
            ) sub
        """, (depot,))
        z10 = cur.fetchone()[0]
        
        nom_display = (nom or "Inconnu")[:28]
        print(f"{depot:<6} {nom_display:<30} {ca_total:>12,.0f}  {z1:>5} {z2:>5} {z5:>5} {z10:>5}")
    
    print("\n" + "="*90 + "\n")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
