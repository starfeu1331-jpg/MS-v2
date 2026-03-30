#!/usr/bin/env python3
"""
VÉRIFICATION EXHAUSTIVE de chaque donnée du mail
Magasin 26 vs Réseau — Rideaux & Papier Peint
Période: depuis 2025-01-01
"""
import psycopg2

DB_URL = "postgresql://decordb:OVHdecordb26@yu4496-002.eu.clouddb.ovh.net:35847/basedecordb"
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

DEPOT = "26"
DATE_DEBUT = "2025-01-01"
errors = []

def check(label, expected, actual, tolerance=0.01):
    """Vérifie qu'une valeur correspond, avec tolérance pour les arrondis"""
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        if abs(expected - actual) > tolerance:
            msg = f"❌ ERREUR: {label} — Attendu: {expected:,.2f} | Trouvé: {actual:,.2f} | Écart: {actual - expected:,.2f}"
            errors.append(msg)
            print(msg)
            return False
        else:
            print(f"✅ OK: {label} = {actual:,.2f}")
            return True
    else:
        if expected != actual:
            msg = f"❌ ERREUR: {label} — Attendu: {expected} | Trouvé: {actual}"
            errors.append(msg)
            print(msg)
            return False
        else:
            print(f"✅ OK: {label} = {actual}")
            return True

print("=" * 100)
print("  VÉRIFICATION EXHAUSTIVE — ANALYSE TOP PRODUITS MAG 26 vs RÉSEAU")
print("=" * 100)

# ══════════════════════════════════════════════════════════════
# 0. VÉRIFICATION METADATA
# ══════════════════════════════════════════════════════════════
print("\n" + "─" * 80)
print("  0. METADATA")
print("─" * 80)

cur.execute("SELECT COUNT(DISTINCT depot) FROM transactions WHERE date >= %s", (DATE_DEBUT,))
nb_mag = cur.fetchone()[0]
check("Nombre de magasins actifs", 27, nb_mag)

cur.execute("SELECT MIN(date), MAX(date) FROM transactions WHERE date >= %s", (DATE_DEBUT,))
min_date, max_date = cur.fetchone()
print(f"  Période: {min_date} → {max_date}")

# ══════════════════════════════════════════════════════════════
# 1. RIDEAUX / VOILAGES
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 100)
print("  1. RIDEAUX / VOILAGES (sous_famille = 'Rideau voilage')")
print("=" * 100)

# CA totaux
cur.execute("""
    SELECT SUM(t.ca) FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Rideau voilage' AND t.date >= %s
""", (DATE_DEBUT,))
ca_reseau_rideaux = float(cur.fetchone()[0])
check("CA réseau Rideaux", 2506642.31, ca_reseau_rideaux, 1.0)

cur.execute("""
    SELECT SUM(t.ca) FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Rideau voilage' AND t.date >= %s AND t.depot = %s
""", (DATE_DEBUT, DEPOT))
ca_mag_rideaux = float(cur.fetchone()[0])
check("CA magasin 26 Rideaux", 97896.85, ca_mag_rideaux, 1.0)

pct_rideaux = ca_mag_rideaux / ca_reseau_rideaux * 100
check("Part mag/réseau Rideaux (%)", 3.9, round(pct_rideaux, 1))

# ── Top 20 Magasin 26 Rideaux ──
print("\n" + "─" * 80)
print("  1a. TOP 20 PRODUITS MAGASIN 26 — RIDEAUX")
print("─" * 80)

cur.execute("""
    SELECT p.id,
           COALESCE(p.designation, p.id) as desig,
           SUM(t.ca) as ca,
           SUM(t.quantite) as qty
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Rideau voilage' AND t.date >= %s AND t.depot = %s
    GROUP BY p.id, p.designation
    ORDER BY ca DESC
    LIMIT 20
""", (DATE_DEBUT, DEPOT))
top20_mag_rideaux = cur.fetchall()

# Valeurs du mail à vérifier (rang, ref, ca_mag, qty, rang_reseau, ca_reseau)
mail_top20_mag_rideaux = [
    (1,  "74123", 1883.06, 52,  2,  43864.38),
    (2,  "85428", 1586.19, 81,  1,  45163.04),
    (3,  "85431", 1409.28, 72,  10, 19056.11),
    (4,  "76191", 1133.70, 30,  9,  19271.75),
    (5,  "78314", 1022.73, 27,  4,  25486.56),
    (6,  "80042", 1001.74, 26,  16, 17032.64),
    (7,  "85432", 984.49,  51,  3,  26226.77),
    (8,  "83940", 903.52,  24,  6,  22430.22),
    (9,  "83999", 798.53,  47,  29, 12314.35),
    (10, "81727", 781.66,  34,  32, 11231.22),
    (11, "85429", 768.61,  39,  7,  20206.87),
    (12, "76187", 738.78,  42,  8,  19570.63),
    (13, "85430", 722.63,  37,  11, 18779.07),
    (14, "80100", 696.83,  17,  21, 13264.36),
    (15, "74124", 693.82,  18,  17, 16456.28),
    (16, "57244", 687.14,  86,  45, 9446.58),
    (17, "84262", 680.83,  17,  26, 12708.11),
    (18, "81906", 680.57,  23,  25, 12800.63),
    (19, "72327", 679.60,  40,  22, 12978.65),
    (20, "80115", 674.85,  15,  14, 17785.04),
]

# Ranking réseau complet pour cross-check
cur.execute("""
    SELECT p.id, SUM(t.ca) as ca
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Rideau voilage' AND t.date >= %s
    GROUP BY p.id
    ORDER BY ca DESC
""", (DATE_DEBUT,))
reseau_rideaux_ranking = {}
for i, row in enumerate(cur.fetchall(), 1):
    reseau_rideaux_ranking[row[0]] = (i, float(row[1]))

for i, (rang, ref, ca_mail, qty_mail, rang_res_mail, ca_res_mail) in enumerate(mail_top20_mag_rideaux):
    actual_ref = top20_mag_rideaux[i][0]
    actual_ca = float(top20_mag_rideaux[i][2])
    actual_qty = float(top20_mag_rideaux[i][3])
    
    check(f"Rideaux Mag Top{rang} ref", ref, actual_ref)
    check(f"Rideaux Mag Top{rang} CA", ca_mail, actual_ca, 1.0)
    check(f"Rideaux Mag Top{rang} Qté", qty_mail, actual_qty, 1.0)
    
    # Vérifier rang réseau
    if ref in reseau_rideaux_ranking:
        actual_rang_res, actual_ca_res = reseau_rideaux_ranking[ref]
        check(f"Rideaux Mag Top{rang} rang réseau", rang_res_mail, actual_rang_res)
        check(f"Rideaux Mag Top{rang} CA réseau", ca_res_mail, actual_ca_res, 1.0)
    else:
        msg = f"❌ ERREUR: Produit {ref} absent du ranking réseau!"
        errors.append(msg)
        print(msg)

# ── Top 20 Réseau Rideaux ──
print("\n" + "─" * 80)
print("  1b. TOP 20 PRODUITS RÉSEAU — RIDEAUX")
print("─" * 80)

cur.execute("""
    SELECT p.id,
           COALESCE(p.designation, p.id) as desig,
           SUM(t.ca) as ca,
           SUM(t.quantite) as qty
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Rideau voilage' AND t.date >= %s
    GROUP BY p.id, p.designation
    ORDER BY ca DESC
    LIMIT 20
""", (DATE_DEBUT,))
top20_res_rideaux = cur.fetchall()

# Ranking mag 26 complet
cur.execute("""
    SELECT p.id, SUM(t.ca) as ca
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Rideau voilage' AND t.date >= %s AND t.depot = %s
    GROUP BY p.id
    ORDER BY ca DESC
""", (DATE_DEBUT, DEPOT))
mag_rideaux_ranking = {}
for i, row in enumerate(cur.fetchall(), 1):
    mag_rideaux_ranking[row[0]] = (i, float(row[1]))

mail_top20_res_rideaux = [
    (1,  "85428", 45163.03, 2330, 2,  1586.19),
    (2,  "74123", 43864.38, 1152, 1,  1883.06),
    (3,  "85432", 26226.77, 1345, 7,  984.49),
    (4,  "78314", 25486.56, 669,  5,  1022.73),
    (5,  "80102", 23034.75, 592,  23, 623.84),
    (6,  "83940", 22430.22, 587,  8,  903.52),
    (7,  "85429", 20206.87, 1045, 11, 768.61),
    (8,  "76187", 19570.63, 1115, 12, 738.78),
    (9,  "76191", 19271.75, 506,  4,  1133.70),
    (10, "85431", 19056.11, 990,  3,  1409.28),
    (11, "85430", 18779.07, 973,  13, 722.63),
    (12, "82075", 18378.39, 542,  63, 339.90),
    (13, "78274", 18182.23, 477,  27, 595.84),
    (14, "80115", 17785.04, 396,  20, 674.85),
    (15, "67112", 17259.45, 460,  31, 526.26),
    (16, "80042", 17032.64, 447,  6,  1001.74),
    (17, "74124", 16456.28, 432,  15, 693.82),
    (18, "76178", 16209.25, 425,  24, 607.84),
    (19, "79983", 15986.57, 415,  34, 502.87),
    (20, "72326", 14694.65, 866,  35, 492.71),
]

for i, (rang, ref, ca_mail, qty_mail, rang_mag_mail, ca_mag_mail) in enumerate(mail_top20_res_rideaux):
    actual_ref = top20_res_rideaux[i][0]
    actual_ca = float(top20_res_rideaux[i][2])
    actual_qty = float(top20_res_rideaux[i][3])
    
    check(f"Rideaux Rés Top{rang} ref", ref, actual_ref)
    check(f"Rideaux Rés Top{rang} CA", ca_mail, actual_ca, 1.0)
    check(f"Rideaux Rés Top{rang} Qté", qty_mail, actual_qty, 1.0)
    
    # Vérifier rang magasin
    if ref in mag_rideaux_ranking:
        actual_rang_mag, actual_ca_mag = mag_rideaux_ranking[ref]
        check(f"Rideaux Rés Top{rang} rang mag", rang_mag_mail, actual_rang_mag)
        check(f"Rideaux Rés Top{rang} CA mag", ca_mag_mail, actual_ca_mag, 1.0)
    else:
        msg = f"❌ ERREUR: Produit {ref} absent du magasin 26!"
        errors.append(msg)
        print(msg)

# ── Vérif % rayon mail (top mag) ──
print("\n" + "─" * 80)
print("  1c. VÉRIFICATION % RAYON — RIDEAUX MAG 26")
print("─" * 80)

for rang, ref, ca_mail, qty_mail, _, _ in mail_top20_mag_rideaux:
    pct_mail_values = {
        1: 1.9, 2: 1.6, 3: 1.4, 4: 1.2, 5: 1.0, 6: 1.0, 7: 1.0, 8: 0.9, 9: 0.8, 10: 0.8,
        11: 0.8, 12: 0.8, 13: 0.7, 14: 0.7, 15: 0.7, 16: 0.7, 17: 0.7, 18: 0.7, 19: 0.7, 20: 0.7
    }
    pct_calc = ca_mail / ca_mag_rideaux * 100
    pct_mail = pct_mail_values[rang]
    check(f"Rideaux Mag Top{rang} %rayon", pct_mail, round(pct_calc, 1))

# ══════════════════════════════════════════════════════════════
# 2. PAPIER PEINT / DÉCORS MURAUX
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 100)
print("  2. PAPIER PEINT / DÉCORS MURAUX (sous_famille = 'Décors muraux')")
print("=" * 100)

cur.execute("""
    SELECT SUM(t.ca) FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Décors muraux' AND t.date >= %s
""", (DATE_DEBUT,))
ca_reseau_decors = float(cur.fetchone()[0])
check("CA réseau Décors muraux", 2966151.12, ca_reseau_decors, 1.0)

cur.execute("""
    SELECT SUM(t.ca) FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Décors muraux' AND t.date >= %s AND t.depot = %s
""", (DATE_DEBUT, DEPOT))
ca_mag_decors = float(cur.fetchone()[0])
check("CA magasin 26 Décors muraux", 90544.28, ca_mag_decors, 1.0)

pct_decors = ca_mag_decors / ca_reseau_decors * 100
check("Part mag/réseau Décors (%)", 3.1, round(pct_decors, 1))

# ── Top 20 Mag 26 Décors ──
print("\n" + "─" * 80)
print("  2a. TOP 20 PRODUITS MAGASIN 26 — DÉCORS MURAUX")
print("─" * 80)

cur.execute("""
    SELECT p.id,
           COALESCE(p.designation, p.id) as desig,
           SUM(t.ca) as ca,
           SUM(t.quantite) as qty
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Décors muraux' AND t.date >= %s AND t.depot = %s
    GROUP BY p.id, p.designation
    ORDER BY ca DESC
    LIMIT 20
""", (DATE_DEBUT, DEPOT))
top20_mag_decors = cur.fetchall()

# Ranking réseau complet décors
cur.execute("""
    SELECT p.id, SUM(t.ca) as ca
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Décors muraux' AND t.date >= %s
    GROUP BY p.id
    ORDER BY ca DESC
""", (DATE_DEBUT,))
reseau_decors_ranking = {}
for i, row in enumerate(cur.fetchall(), 1):
    reseau_decors_ranking[row[0]] = (i, float(row[1]))

mail_top20_mag_decors = [
    (1,  "84678", 7252.90,  122,  1,   282543.17),
    (2,  "82602", 2711.30,  47,   4,   47251.78),
    (3,  "69909", 1629.16,  1629, 3,   47396.40),
    (4,  "83432", 1427.71,  42,   22,  14062.44),
    (5,  "60780", 1275.30,  117,  12,  17878.72),
    (6,  "83037", 1272.00,  80,   5,   31194.21),
    (7,  "84681", 1176.80,  22,   7,   22938.49),
    (8,  "83575", 1176.60,  74,   6,   28115.17),
    (9,  "87544", 1145.40,  46,   9,   19987.23),
    (10, "84015", 1035.84,  33,   121, 5916.02),
    (11, "81625", 996.80,   113,  8,   20049.03),
    (12, "84679", 995.40,   66,   32,  12562.80),
    (13, "83430", 950.08,   28,   16,  16953.93),
    (14, "78789", 931.00,   40,   17,  16743.60),
    (15, "82952", 801.90,   81,   13,  17564.58),
    (16, "70444", 797.90,   101,  19,  15827.65),
    (17, "85383", 758.10,   19,   11,  18465.72),
    (18, "73822", 685.30,   77,   47,  10462.84),
    (19, "86097", 682.70,   23,   21,  14140.00),
    (20, "73668", 597.90,   55,   15,  17036.40),
]

for i, (rang, ref, ca_mail, qty_mail, rang_res_mail, ca_res_mail) in enumerate(mail_top20_mag_decors):
    actual_ref = top20_mag_decors[i][0]
    actual_ca = float(top20_mag_decors[i][2])
    actual_qty = float(top20_mag_decors[i][3])
    
    check(f"Décors Mag Top{rang} ref", ref, actual_ref)
    check(f"Décors Mag Top{rang} CA", ca_mail, actual_ca, 1.0)
    check(f"Décors Mag Top{rang} Qté", qty_mail, actual_qty, 1.0)
    
    if ref in reseau_decors_ranking:
        actual_rang_res, actual_ca_res = reseau_decors_ranking[ref]
        check(f"Décors Mag Top{rang} rang réseau", rang_res_mail, actual_rang_res)
        check(f"Décors Mag Top{rang} CA réseau", ca_res_mail, actual_ca_res, 1.0)
    else:
        msg = f"❌ ERREUR: Produit {ref} absent du ranking réseau!"
        errors.append(msg)
        print(msg)

# ── Top 20 Réseau Décors ──
print("\n" + "─" * 80)
print("  2b. TOP 20 PRODUITS RÉSEAU — DÉCORS MURAUX")
print("─" * 80)

cur.execute("""
    SELECT p.id,
           COALESCE(p.designation, p.id) as desig,
           SUM(t.ca) as ca,
           SUM(t.quantite) as qty
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Décors muraux' AND t.date >= %s
    GROUP BY p.id, p.designation
    ORDER BY ca DESC
    LIMIT 20
""", (DATE_DEBUT,))
top20_res_decors = cur.fetchall()

# Ranking mag 26 complet décors
cur.execute("""
    SELECT p.id, SUM(t.ca) as ca
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.sous_famille = 'Décors muraux' AND t.date >= %s AND t.depot = %s
    GROUP BY p.id
    ORDER BY ca DESC
""", (DATE_DEBUT, DEPOT))
mag_decors_ranking = {}
for i, row in enumerate(cur.fetchall(), 1):
    mag_decors_ranking[row[0]] = (i, float(row[1]))

mail_top20_res_decors = [
    (1,  "84678", 282543.17, 6295, 1,  7252.90),
    (2,  "85778", 63716.28,  1615, 35, 472.00),
    (3,  "69909", 47396.40,  47445,3,  1629.16),
    (4,  "82602", 47251.78,  823,  2,  2711.30),
    (5,  "83037", 31194.21,  1964, 6,  1272.00),
    (6,  "83575", 28115.17,  1773, 8,  1176.60),
    (7,  "84681", 22938.49,  429,  7,  1176.80),
    (8,  "81625", 20049.03,  2254, 11, 996.80),
    (9,  "87544", 19987.23,  805,  9,  1145.40),
    (10, "79571", 19908.66,  444,  29, 493.90),
    (11, "85383", 18465.72,  464,  17, 758.10),
    (12, "60780", 17878.72,  1640, 5,  1275.30),
    (13, "82952", 17564.58,  1779, 15, 801.90),
    (14, "76654", 17254.90,  1022, 23, 557.70),
    (15, "73668", 17036.40,  1582, 20, 597.90),
    (16, "83430", 16953.93,  511,  13, 950.08),
    (17, "78789", 16743.60,  715,  14, 931.00),
    (18, "71351", 16318.72,  2087, 28, 511.40),
    (19, "70444", 15827.65,  2004, 16, 797.90),
    (20, "83040", 14278.20,  898,  39, 429.30),
]

for i, (rang, ref, ca_mail, qty_mail, rang_mag_mail, ca_mag_mail) in enumerate(mail_top20_res_decors):
    actual_ref = top20_res_decors[i][0]
    actual_ca = float(top20_res_decors[i][2])
    actual_qty = float(top20_res_decors[i][3])
    
    check(f"Décors Rés Top{rang} ref", ref, actual_ref)
    check(f"Décors Rés Top{rang} CA", ca_mail, actual_ca, 1.0)
    check(f"Décors Rés Top{rang} Qté", qty_mail, actual_qty, 1.0)
    
    if ref in mag_decors_ranking:
        actual_rang_mag, actual_ca_mag = mag_decors_ranking[ref]
        check(f"Décors Rés Top{rang} rang mag", rang_mag_mail, actual_rang_mag)
        check(f"Décors Rés Top{rang} CA mag", ca_mag_mail, actual_ca_mag, 1.0)
    else:
        msg = f"❌ ERREUR: Produit {ref} absent du magasin 26!"
        errors.append(msg)
        print(msg)

# ── Vérif leviers d'action rideaux ──
print("\n" + "─" * 80)
print("  3. VÉRIFICATION LEVIERS D'ACTION — RIDEAUX")
print("─" * 80)

mail_leviers_rideaux = [
    (5,  "80102", 23035, 23, 624),
    (12, "82075", 18378, 63, 340),
    (27, "79757", 12483, 532, 26),
    (28, "81765", 12368, 88, 273),
    (31, "83956", 11544, 166, 188),
    (33, "79946", 11048, 151, 206),
    (34, "79738", 10668, 141, 216),
]

for rang_res, ref, ca_res_mail, rang_mag_mail, ca_mag_mail in mail_leviers_rideaux:
    actual_rang_res, actual_ca_res = reseau_rideaux_ranking.get(ref, (None, None))
    actual_rang_mag, actual_ca_mag = mag_rideaux_ranking.get(ref, (999, 0))
    
    check(f"Levier Rideaux {ref} rang réseau", rang_res, actual_rang_res)
    check(f"Levier Rideaux {ref} CA réseau", ca_res_mail, actual_ca_res, 2.0)
    check(f"Levier Rideaux {ref} rang mag", rang_mag_mail, actual_rang_mag)
    check(f"Levier Rideaux {ref} CA mag", ca_mag_mail, actual_ca_mag, 2.0)

# ── Vérif leviers d'action décors ──
print("\n" + "─" * 80)
print("  4. VÉRIFICATION LEVIERS D'ACTION — DÉCORS MURAUX")
print("─" * 80)

mail_leviers_decors = [
    (2,  "85778", 63716, 35,  472),
    (10, "79571", 19909, 29,  494),
    (23, "73828", 13976, 304, 70),
    (26, "82362", 13585, 92,  230),
    (28, "73657", 13175, 88,  237),
    (30, "69349", 12731, 212, 118),
    (40, "84054", 11194, 244, 95),
]

for rang_res, ref, ca_res_mail, rang_mag_mail, ca_mag_mail in mail_leviers_decors:
    actual_rang_res, actual_ca_res = reseau_decors_ranking.get(ref, (None, None))
    actual_rang_mag, actual_ca_mag = mag_decors_ranking.get(ref, (999, 0))
    
    check(f"Levier Décors {ref} rang réseau", rang_res, actual_rang_res)
    check(f"Levier Décors {ref} CA réseau", ca_res_mail, actual_ca_res, 2.0)
    check(f"Levier Décors {ref} rang mag", rang_mag_mail, actual_rang_mag)
    check(f"Levier Décors {ref} CA mag", ca_mag_mail, actual_ca_mag, 2.0)

# ── Vérif désignations produits (spot check) ──
print("\n" + "─" * 80)
print("  5. VÉRIFICATION DÉSIGNATIONS PRODUITS (spot check)")
print("─" * 80)

spot_checks = [
    ("74123", "GALENA RIDEAU ISOLANT THERMIQUE"),
    ("85428", "GASTON RIDEAU THERMIQUE UNI"),
    ("84678", "PANNEAU TASSEAUX MDF"),
    ("82602", "PANNEAU TASSEAUX BOIS"),
    ("85778", "PANNEAU TASSEAUX MDF"),
    ("69909", "Lot papier peint"),
    ("80102", "ANDREA RIDEAU ISOLANT THERMIQUE"),
    ("82075", "GALENA RIDEAU ISOL THERM COURT"),
    ("79757", "MARSEILLAIS VOILAGE FILET UNI"),
    ("84054", "PLAQUETTE BOIS MADURA"),
]

for ref, desig_mail in spot_checks:
    cur.execute("SELECT designation FROM produits WHERE id = %s", (ref,))
    row = cur.fetchone()
    if row:
        actual = row[0]
        # Compare only first 30 chars
        mail_short = desig_mail[:30].upper().strip()
        actual_short = (actual or "")[:30].upper().strip()
        if mail_short in actual_short or actual_short in mail_short:
            print(f"✅ OK: {ref} = '{actual}'")
        else:
            msg = f"❌ ERREUR DÉSIGNATION: {ref} — Mail: '{desig_mail}' | BDD: '{actual}'"
            errors.append(msg)
            print(msg)
    else:
        msg = f"❌ ERREUR: Produit {ref} non trouvé en BDD!"
        errors.append(msg)
        print(msg)

# ══════════════════════════════════════════════════════════════
# RÉSUMÉ
# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 100)
print("  RÉSUMÉ DE LA VÉRIFICATION")
print("=" * 100)

if errors:
    print(f"\n  ❌ {len(errors)} ERREUR(S) DÉTECTÉE(S):")
    for e in errors:
        print(f"    {e}")
else:
    print("\n  ✅ TOUTES LES DONNÉES SONT CORRECTES — 0 erreur")

print()
conn.close()
