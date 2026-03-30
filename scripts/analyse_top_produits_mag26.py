#!/usr/bin/env python3
"""
Analyse top produits Magasin 26 vs Réseau
- Rideaux (sous_famille = 'Rideau voilage')
- Papier peint / Décors muraux (sous_famille = 'Décors muraux')
Période: depuis début 2025 (janv 2025 - janv 2026)
"""
import psycopg2

DB_URL = "postgresql://decordb:OVHdecordb26@yu4496-002.eu.clouddb.ovh.net:35847/basedecordb"
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

DEPOT = "26"
DATE_DEBUT = "2025-01-01"
TOP_N = 20

def analyse_famille(cur, sous_famille, label, depot, date_debut, top_n):
    print()
    print("=" * 120)
    print(f"  {label.upper()} — Magasin {depot} vs Réseau (depuis {date_debut})")
    print("=" * 120)

    # ── CA total du rayon réseau et magasin ──
    cur.execute("""
        SELECT 
            SUM(t.ca) as ca_reseau,
            SUM(CASE WHEN t.depot = %s THEN t.ca ELSE 0 END) as ca_magasin
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE p.sous_famille = %s AND t.date >= %s
    """, (depot, sous_famille, date_debut))
    ca_reseau_total, ca_magasin_total = cur.fetchone()
    ca_reseau_total = ca_reseau_total or 0
    ca_magasin_total = ca_magasin_total or 0

    print(f"\n  CA total rayon réseau : {ca_reseau_total:>12,.2f} €")
    print(f"  CA total rayon mag {depot}  : {ca_magasin_total:>12,.2f} €")
    print(f"  Part magasin / réseau : {(ca_magasin_total/ca_reseau_total*100) if ca_reseau_total else 0:>11.1f} %")

    # ── Top produits RÉSEAU ──
    cur.execute("""
        SELECT p.id, 
               COALESCE(p.designation, p.id) as desig,
               p.sous_sous_famille,
               SUM(t.ca) as ca,
               SUM(t.quantite) as qty
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE p.sous_famille = %s AND t.date >= %s
        GROUP BY p.id, p.designation, p.sous_sous_famille
        ORDER BY ca DESC
        LIMIT %s
    """, (sous_famille, date_debut, top_n * 2))  # on prend large pour le croisement
    reseau_data = cur.fetchall()
    
    # Construire le ranking réseau complet
    cur.execute("""
        SELECT p.id, SUM(t.ca) as ca
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE p.sous_famille = %s AND t.date >= %s
        GROUP BY p.id
        ORDER BY ca DESC
    """, (sous_famille, date_debut))
    reseau_ranking = {}
    for i, row in enumerate(cur.fetchall(), 1):
        reseau_ranking[row[0]] = (i, float(row[1]))

    # ── Top produits MAGASIN ──
    cur.execute("""
        SELECT p.id,
               COALESCE(p.designation, p.id) as desig,
               p.sous_sous_famille,
               SUM(t.ca) as ca,
               SUM(t.quantite) as qty
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE p.sous_famille = %s AND t.date >= %s AND t.depot = %s
        GROUP BY p.id, p.designation, p.sous_sous_famille
        ORDER BY ca DESC
        LIMIT %s
    """, (sous_famille, date_debut, depot, top_n * 2))
    magasin_data = cur.fetchall()

    # Ranking magasin complet
    cur.execute("""
        SELECT p.id, SUM(t.ca) as ca
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE p.sous_famille = %s AND t.date >= %s AND t.depot = %s
        GROUP BY p.id
        ORDER BY ca DESC
    """, (sous_famille, date_debut, depot))
    magasin_ranking = {}
    for i, row in enumerate(cur.fetchall(), 1):
        magasin_ranking[row[0]] = (i, float(row[1]))

    # ══════════════════════════════════════════
    # TABLEAU 1 : TOP MAGASIN vs position réseau
    # ══════════════════════════════════════════
    print(f"\n{'─' * 120}")
    print(f"  TOP {top_n} PRODUITS MAGASIN {depot} (par CA) — et leur position réseau")
    print(f"{'─' * 120}")
    header = f"  {'Rang':>4}  {'Réf produit':<14} {'Désignation':<40} {'Ss-famille':<16} {'CA mag €':>10} {'Qté':>6} {'% rayon':>7}  {'Rang rés.':>9}  {'CA rés. €':>10}"
    print(header)
    print(f"  {'─'*4}  {'─'*14} {'─'*40} {'─'*16} {'─'*10} {'─'*6} {'─'*7}  {'─'*9}  {'─'*10}")

    for i, row in enumerate(magasin_data[:top_n], 1):
        prod_id, desig, ss_fam, ca_mag, qty = row
        desig_short = (desig or "")[:40]
        ss_fam_short = (ss_fam or "")[:16]
        pct_rayon = (float(ca_mag) / ca_magasin_total * 100) if ca_magasin_total else 0
        rk_res, ca_res = reseau_ranking.get(prod_id, ("—", 0))
        print(f"  {i:>4}  {prod_id:<14} {desig_short:<40} {ss_fam_short:<16} {float(ca_mag):>10,.2f} {float(qty):>6,.0f} {pct_rayon:>6.1f}%  {str(rk_res):>9}  {float(ca_res):>10,.2f}")

    # ══════════════════════════════════════════
    # TABLEAU 2 : TOP RÉSEAU vs position magasin
    # ══════════════════════════════════════════
    print(f"\n{'─' * 120}")
    print(f"  TOP {top_n} PRODUITS RÉSEAU (par CA) — et leur position magasin {depot}")
    print(f"{'─' * 120}")
    header2 = f"  {'Rang':>4}  {'Réf produit':<14} {'Désignation':<40} {'Ss-famille':<16} {'CA rés. €':>10} {'Qté':>6} {'% rayon':>7}  {'Rang mag':>8}  {'CA mag €':>10}"
    print(header2)
    print(f"  {'─'*4}  {'─'*14} {'─'*40} {'─'*16} {'─'*10} {'─'*6} {'─'*7}  {'─'*8}  {'─'*10}")

    for i, row in enumerate(reseau_data[:top_n], 1):
        prod_id, desig, ss_fam, ca_res, qty = row
        desig_short = (desig or "")[:40]
        ss_fam_short = (ss_fam or "")[:16]
        pct_rayon = (float(ca_res) / ca_reseau_total * 100) if ca_reseau_total else 0
        rk_mag, ca_mag = magasin_ranking.get(prod_id, ("—", 0))
        print(f"  {i:>4}  {prod_id:<14} {desig_short:<40} {ss_fam_short:<16} {float(ca_res):>10,.2f} {float(qty):>6,.0f} {pct_rayon:>6.1f}%  {str(rk_mag):>8}  {float(ca_mag):>10,.2f}")

    # ══════════════════════════════════════════
    # TABLEAU 3 : Écarts les plus significatifs (produits forts réseau mais faibles ou absents en magasin)
    # ══════════════════════════════════════════
    print(f"\n{'─' * 120}")
    print(f"  LEVIERS D'ACTION — Produits forts réseau mais faibles/absents en magasin {depot}")
    print(f"{'─' * 120}")
    
    # On cherche les produits dans le top 30 réseau qui sont absents ou très mal classés en magasin
    ecarts = []
    for i, row in enumerate(reseau_data[:50], 1):
        prod_id, desig, ss_fam, ca_res, qty_res = row
        rk_mag, ca_mag = magasin_ranking.get(prod_id, (999, 0))
        if isinstance(rk_mag, str) or rk_mag > i * 3:  # absent ou classé 3x plus bas
            ecarts.append((i, prod_id, desig, ss_fam, float(ca_res), float(qty_res), rk_mag, float(ca_mag)))
    
    if ecarts:
        header3 = f"  {'Rg rés':>6}  {'Réf produit':<14} {'Désignation':<40} {'CA rés. €':>10}  {'Rg mag':>6}  {'CA mag €':>10}  {'Commentaire'}"
        print(header3)
        print(f"  {'─'*6}  {'─'*14} {'─'*40} {'─'*10}  {'─'*6}  {'─'*10}  {'─'*30}")
        for rk_res, prod_id, desig, ss_fam, ca_res, qty_res, rk_mag, ca_mag in ecarts[:15]:
            desig_short = (desig or "")[:40]
            if rk_mag == 999:
                comment = "❌ ABSENT du magasin"
            else:
                comment = f"⚠️  Rang {rk_mag} vs {rk_res} réseau"
            print(f"  {rk_res:>6}  {prod_id:<14} {desig_short:<40} {ca_res:>10,.2f}  {str(rk_mag):>6}  {ca_mag:>10,.2f}  {comment}")
    else:
        print("  Pas d'écart significatif détecté.")

    return ca_magasin_total, ca_reseau_total


print("╔" + "═" * 118 + "╗")
print("║" + f"  ANALYSE TOP PRODUITS — MAGASIN {DEPOT} vs RÉSEAU".center(118) + "║")
print("║" + f"  Période: depuis {DATE_DEBUT} (13 mois de données)".center(118) + "║")
print("╚" + "═" * 118 + "╝")

# Nombre de magasins actifs
cur.execute(f"SELECT COUNT(DISTINCT depot) FROM transactions WHERE date >= '{DATE_DEBUT}'")
nb_mag = cur.fetchone()[0]
print(f"\n  📊 Nombre de magasins actifs sur la période : {nb_mag}")

# Analyse Rideaux
analyse_famille(cur, "Rideau voilage", "Rideaux / Voilages", DEPOT, DATE_DEBUT, TOP_N)

# Analyse Papier peint / Décors muraux
analyse_famille(cur, "Décors muraux", "Papier Peint / Décors Muraux", DEPOT, DATE_DEBUT, TOP_N)

print()
print("=" * 120)
print("  FIN DE L'ANALYSE")
print("=" * 120)

conn.close()
