import psycopg2

conn = psycopg2.connect('postgresql://decordb:OVHdecordb26@yu4496-002.eu.clouddb.ovh.net:35847/basedecordb?sslmode=require')
cur = conn.cursor()

# 1. Mois par mois - CA et tickets par depot
cur.execute("""
    SELECT depot, 
           TO_CHAR(date, 'YYYY-MM') as mois,
           ROUND(SUM(ca)::numeric, 2) as ca,
           COUNT(DISTINCT facture)::int as nb_tickets,
           COUNT(*)::int as nb_lignes
    FROM transactions 
    WHERE date >= '2025-01-01' AND date < '2026-01-01'
      AND depot NOT IN ('41', '1', '42', '320')
      AND depot IS NOT NULL
    GROUP BY depot, TO_CHAR(date, 'YYYY-MM')
    ORDER BY depot, mois
""")
monthly = {}
for r in cur.fetchall():
    depot, mois, ca, tkt, lignes = r[0], r[1], float(r[2]), r[3], r[4]
    if depot not in monthly:
        monthly[depot] = {}
    monthly[depot][mois] = (ca, tkt, lignes)

# 2. Semaine par semaine - CA et tickets par depot
cur.execute("""
    SELECT depot,
           TO_CHAR(date_trunc('week', date), 'YYYY-"W"IW') as semaine,
           MIN(date)::date::text as debut,
           MAX(date)::date::text as fin,
           ROUND(SUM(ca)::numeric, 2) as ca,
           COUNT(DISTINCT facture)::int as nb_tickets,
           COUNT(*)::int as nb_lignes
    FROM transactions 
    WHERE date >= '2025-01-01' AND date < '2026-01-01'
      AND depot NOT IN ('41', '1', '42', '320')
      AND depot IS NOT NULL
    GROUP BY depot, TO_CHAR(date_trunc('week', date), 'YYYY-"W"IW')
    ORDER BY depot, semaine
""")
weekly = {}
for r in cur.fetchall():
    depot, sem, debut, fin, ca, tkt, lignes = r[0], r[1], r[2], r[3], float(r[4]), r[5], r[6]
    if depot not in weekly:
        weekly[depot] = {}
    weekly[depot][sem] = (ca, tkt, lignes, debut, fin)

# 3. Checker les trous (semaines vides par depot)
cur.execute("""
    SELECT TO_CHAR(date_trunc('week', d), 'YYYY-"W"IW') as semaine
    FROM generate_series('2025-01-01'::date, '2025-12-31'::date, '1 week') d
    ORDER BY semaine
""")
all_weeks = [r[0] for r in cur.fetchall()]

# 4. Transactions avec facture='0' ou carte='0' par depot (anomalies)
cur.execute("""
    SELECT depot,
           TO_CHAR(date, 'YYYY-MM') as mois,
           COUNT(*)::int as nb_lignes,
           ROUND(SUM(ca)::numeric, 2) as ca,
           SUM(CASE WHEN facture = '0' THEN 1 ELSE 0 END)::int as facture_zero,
           SUM(CASE WHEN carte = '0' THEN 1 ELSE 0 END)::int as carte_zero,
           SUM(CASE WHEN ca < 0 THEN 1 ELSE 0 END)::int as ca_negatif,
           ROUND(SUM(CASE WHEN ca < 0 THEN ca ELSE 0 END)::numeric, 2) as total_ca_negatif
    FROM transactions 
    WHERE date >= '2025-01-01' AND date < '2026-01-01'
      AND depot NOT IN ('41', '1', '42', '320')
      AND depot IS NOT NULL
    GROUP BY depot, TO_CHAR(date, 'YYYY-MM')
    ORDER BY depot, mois
""")
anomalies = {}
for r in cur.fetchall():
    depot = r[0]
    if depot not in anomalies:
        anomalies[depot] = {}
    anomalies[depot][r[1]] = {
        'lignes': r[2], 'ca': float(r[3]),
        'facture_zero': r[4], 'carte_zero': r[5],
        'ca_negatif': r[6], 'total_ca_neg': float(r[7])
    }

# 5. Verifier s'il y a des données en décembre après le 01/12 - premier et dernier jour par depot/mois
cur.execute("""
    SELECT depot,
           TO_CHAR(date, 'YYYY-MM') as mois,
           MIN(date)::date::text as premier_jour,
           MAX(date)::date::text as dernier_jour,
           COUNT(DISTINCT date::date)::int as nb_jours
    FROM transactions 
    WHERE date >= '2025-01-01' AND date < '2026-01-01'
      AND depot NOT IN ('41', '1', '42', '320')
      AND depot IS NOT NULL
    GROUP BY depot, TO_CHAR(date, 'YYYY-MM')
    ORDER BY depot, mois
""")
coverage = {}
for r in cur.fetchall():
    depot = r[0]
    if depot not in coverage:
        coverage[depot] = {}
    coverage[depot][r[1]] = (r[2], r[3], r[4])

conn.close()

# === AFFICHAGE ===

mois_list = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
             '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12']

# Click&Sense totaux annuels par magasin
cs_annual = {
    '12': (1928744.67, 29986), '13': (1440319.52, 24457),
    '14': (1606542.61, 36038), '16': (1652245.11, 24654),
    '17': (1271086.34, 23707), '19': (1449441.79, 28520),
    '22': (1673568.61, 20844), '23': (1401888.82, 21510),
    '24': (1287235.79, 20752), '25': (2216138.73, 36816),
    '26': (950771.26, 20417),  '27': (1427386.12, 26418),
    '28': (1569554.45, 31006), '29': (1085013.06, 15852),
    '31': (1540731.54, 24863), '32': (1679053.24, 22960),
    '33': (1514118.05, 27362), '34': (1257963.65, 19829),
    '35': (1489137.94, 23580), '36': (1574030.69, 23019),
    '37': (1041586.33, 18406), '38': (1199734.14, 18816),
    '39': (1558483.45, 24107),
}

print("=" * 120)
print("  ANALYSE MOIS PAR MOIS - CA BDD par depot (2025)")
print("=" * 120)

depots_sorted = sorted(monthly.keys(), key=lambda x: int(x))

for depot in depots_sorted:
    ca_cs_annual = cs_annual.get(depot, (0,0))[0]
    tkt_cs_annual = cs_annual.get(depot, (0,0))[1]
    
    total_ca = sum(v[0] for v in monthly[depot].values())
    total_tkt = sum(v[1] for v in monthly[depot].values())
    ecart = total_ca - ca_cs_annual
    
    print(f"\n--- Magasin {depot} --- (ecart annuel: {ecart:+,.0f} EUR, {ecart/ca_cs_annual*100 if ca_cs_annual else 0:+.1f}%)")
    print(f"  {'Mois':>8} | {'CA BDD':>12} | {'Tickets':>8} | {'Lignes':>8} | {'Jours':>5} | {'Du':>10} {'Au':>10} | {'Anomalies'}")
    print(f"  {'-'*100}")
    
    for m in mois_list:
        if m in monthly[depot]:
            ca, tkt, lig = monthly[depot][m]
            pj, dj, nj = coverage[depot].get(m, ('?','?',0))
            ano = anomalies[depot].get(m, {})
            ano_str = ""
            if ano.get('facture_zero', 0) > 0:
                ano_str += f" fact=0:{ano['facture_zero']}"
            if ano.get('carte_zero', 0) > 0:
                ano_str += f" carte=0:{ano['carte_zero']}"
            if ano.get('ca_negatif', 0) > 0:
                ano_str += f" CA<0:{ano['ca_negatif']}({ano['total_ca_neg']:+,.0f})"
            print(f"  {m:>8} | {ca:>12,.2f} | {tkt:>8,} | {lig:>8,} | {nj:>5} | {pj:>10} {dj:>10} |{ano_str}")
        else:
            print(f"  {m:>8} | {'MANQUANT':>12} | {'':>8} | {'':>8} | {'':>5} | {'':>10} {'':>10} | AUCUNE DONNEE")

print("\n\n")
print("=" * 120)
print("  SEMAINES AVEC TROUS - Depots ou il manque des semaines completes")
print("=" * 120)

for depot in depots_sorted:
    depot_weeks = set(weekly.get(depot, {}).keys())
    missing = [w for w in all_weeks if w not in depot_weeks]
    if missing:
        print(f"\n  Magasin {depot}: {len(missing)} semaine(s) manquante(s)")
        for w in missing:
            print(f"    - {w}")

print("\n\n")
print("=" * 120)
print("  TOP ECARTS HEBDO - Semaines avec gros volumes ou anomalies")
print("=" * 120)

# Pour chaque depot, trouver les semaines inhabituelles (CA moyen +/- 50%)
for depot in depots_sorted:
    if depot not in weekly or not weekly[depot]:
        continue
    
    weeks_data = weekly[depot]
    avg_ca = sum(v[0] for v in weeks_data.values()) / len(weeks_data)
    
    outliers = []
    for sem, (ca, tkt, lig, debut, fin) in weeks_data.items():
        if avg_ca > 0 and (ca > avg_ca * 2 or ca < avg_ca * 0.3):
            outliers.append((sem, ca, tkt, debut, fin, ca/avg_ca))
    
    if outliers:
        print(f"\n  Magasin {depot} (CA hebdo moyen: {avg_ca:,.0f} EUR):")
        for sem, ca, tkt, debut, fin, ratio in sorted(outliers):
            label = "TRES HAUT" if ratio > 1.5 else "TRES BAS"
            print(f"    {sem} ({debut} -> {fin}): {ca:>12,.2f} EUR, {tkt:>5} tkt [{label} x{ratio:.1f}]")

print("\n\n")
print("=" * 120)
print("  RESUME DES ANOMALIES PAR DEPOT (transactions facture=0, carte=0, CA negatif)")
print("=" * 120)

for depot in depots_sorted:
    total_f0 = sum(a.get('facture_zero',0) for a in anomalies.get(depot,{}).values())
    total_c0 = sum(a.get('carte_zero',0) for a in anomalies.get(depot,{}).values())
    total_neg = sum(a.get('ca_negatif',0) for a in anomalies.get(depot,{}).values())
    total_neg_ca = sum(a.get('total_ca_neg',0) for a in anomalies.get(depot,{}).values())
    
    if total_f0 > 0 or total_c0 > 100 or total_neg > 100:
        print(f"  Mag {depot:>3}: facture=0: {total_f0:>6,} | carte=0: {total_c0:>6,} | CA<0: {total_neg:>6,} ({total_neg_ca:>+12,.0f} EUR)")
