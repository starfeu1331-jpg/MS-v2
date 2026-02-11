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

print("\n" + "="*90)
print("ANALYSE ÉCART NOVEMBRE 2025 (01/11 → 30/11)".center(90))
print("="*90)

# 1. TOUTES les données brutes novembre
print("\n📊 1. TOUTES LES DONNÉES BRUTES (sans aucun filtre)")
print("-"*90)

cur.execute("""
    SELECT 
        COUNT(DISTINCT facture) as tickets,
        COUNT(*) as lignes,
        SUM(ca) as ca_total,
        SUM(CASE WHEN ca > 0 THEN ca ELSE 0 END) as ca_positif,
        SUM(CASE WHEN ca < 0 THEN ca ELSE 0 END) as ca_negatif,
        SUM(CASE WHEN ca = 0 THEN 1 ELSE 0 END) as lignes_zero
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2025-11-30'
""")

brut = cur.fetchone()
print(f"  Tickets           : {brut[0]:>12,}")
print(f"  Lignes totales    : {brut[1]:>12,}")
print(f"  CA TOTAL          : {brut[2]:>12,.2f} €")
print(f"  CA positif        : {brut[3]:>12,.2f} €")
print(f"  CA négatif        : {brut[4]:>12,.2f} €")
print(f"  Lignes CA = 0     : {brut[5]:>12,}")

# 2. Avec filtre dépôts (actuel)
print("\n✅ 2. AVEC FILTRE DÉPÔTS (1, 41, 42 exclus)")
print("-"*90)

cur.execute("""
    SELECT 
        COUNT(DISTINCT facture) as tickets,
        COUNT(*) as lignes,
        SUM(ca) as ca_total
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2025-11-30'
    AND depot NOT IN ('1', '41', '42')
""")

filtre_depot = cur.fetchone()
print(f"  Tickets           : {filtre_depot[0]:>12,}")
print(f"  Lignes            : {filtre_depot[1]:>12,}")
print(f"  CA TOTAL          : {filtre_depot[2]:>12,.2f} €")

# 3. Analyse par dépôt
print("\n📍 3. RÉPARTITION PAR DÉPÔT (Top 30)")
print("-"*90)
print(f"{'Dépôt':<8} {'Tickets':>10} {'Lignes':>10} {'CA €':>15} {'CA Positif':>15} {'CA Négatif':>15}")
print("-"*90)

cur.execute("""
    SELECT 
        depot,
        COUNT(DISTINCT facture) as tickets,
        COUNT(*) as lignes,
        SUM(ca) as ca_total,
        SUM(CASE WHEN ca > 0 THEN ca ELSE 0 END) as ca_positif,
        SUM(CASE WHEN ca < 0 THEN ca ELSE 0 END) as ca_negatif
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2025-11-30'
    GROUP BY depot
    ORDER BY ca_total DESC
    LIMIT 30
""")

depots = cur.fetchall()
for d in depots:
    depot, tickets, lignes, ca, ca_pos, ca_neg = d
    print(f"{depot:<8} {tickets:>10,} {lignes:>10,} {ca:>15,.2f} {ca_pos:>15,.2f} {ca_neg:>15,.2f}")

# 4. Produits "Divers/Facture"
print("\n🔍 4. PRODUITS 'DIVERS/FACTURE COMPTA' EN NOVEMBRE")
print("-"*90)

cur.execute("""
    SELECT 
        p.id,
        p.famille,
        p.sous_famille,
        COUNT(DISTINCT t.facture) as tickets,
        COUNT(*) as lignes,
        SUM(t.ca) as ca_total
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE t.date >= '2025-11-01' AND t.date <= '2025-11-30'
    AND t.depot NOT IN ('1', '41', '42')
    AND (
        p.famille ILIKE '%divers%' 
        OR p.famille ILIKE '%factu%'
        OR p.sous_famille ILIKE '%divers%'
        OR p.sous_famille ILIKE '%factu%'
        OR p.sous_famille ILIKE '%compta%'
        OR p.id LIKE '80%'
        OR p.id LIKE '90%'
    )
    GROUP BY p.id, p.famille, p.sous_famille
    ORDER BY ca_total DESC
""")

produits_divers = cur.fetchall()
if produits_divers:
    print(f"{'Code':<12} {'Famille':<25} {'Sous-famille':<25} {'Tickets':>8} {'CA €':>12}")
    print("-"*90)
    total_divers_ca = 0
    total_divers_tickets = 0
    for p in produits_divers:
        pid, fam, sfam, tickets, lignes, ca = p
        total_divers_ca += ca
        total_divers_tickets += tickets
        print(f"{pid:<12} {(fam or 'N/A')[:25]:<25} {(sfam or 'N/A')[:25]:<25} {tickets:>8} {ca:>12,.2f}")
    print("-"*90)
    print(f"{'TOTAL DIVERS':<62} {total_divers_tickets:>8} {total_divers_ca:>12,.2f}")

# 5. CA négatif par dépôt (avoirs/retours)
print("\n↩️  5. AVOIRS/RETOURS (CA NÉGATIF) PAR DÉPÔT")
print("-"*90)

cur.execute("""
    SELECT 
        depot,
        COUNT(DISTINCT facture) as tickets,
        COUNT(*) as lignes,
        SUM(ca) as ca_negatif
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2025-11-30'
    AND ca < 0
    AND depot NOT IN ('1', '41', '42')
    GROUP BY depot
    ORDER BY ca_negatif ASC
    LIMIT 25
""")

negatifs = cur.fetchall()
if negatifs:
    print(f"{'Dépôt':<8} {'Tickets':>10} {'Lignes':>10} {'CA Négatif €':>15}")
    print("-"*90)
    total_negatif = 0
    for n in negatifs:
        depot, tickets, lignes, ca_neg = n
        total_negatif += ca_neg
        print(f"{depot:<8} {tickets:>10,} {lignes:>10,} {ca_neg:>15,.2f}")
    print("-"*90)
    print(f"{'TOTAL NÉGATIF':<29} {total_negatif:>15,.2f}")

# 6. Calcul théorique attendu
print("\n📐 6. CALCUL DE L'ÉCART")
print("-"*90)

attendu_ca = 2773813.10
attendu_tickets = 48878
obtenu_ca = filtre_depot[2]
obtenu_tickets = filtre_depot[0]

ecart_ca = attendu_ca - obtenu_ca
ecart_tickets = attendu_tickets - obtenu_tickets

print(f"  CA attendu        : {attendu_ca:>12,.2f} €")
print(f"  CA obtenu         : {obtenu_ca:>12,.2f} €")
print(f"  ÉCART CA          : {ecart_ca:>12,.2f} € ({100*ecart_ca/attendu_ca:.2f}%)")
print()
print(f"  Tickets attendus  : {attendu_tickets:>12,}")
print(f"  Tickets obtenus   : {obtenu_tickets:>12,}")
print(f"  ÉCART TICKETS     : {ecart_tickets:>12,} ({100*ecart_tickets/attendu_tickets:.2f}%)")

# 7. Hypothèses de l'écart
print("\n💡 7. HYPOTHÈSES POUR L'ÉCART")
print("-"*90)

# Dépôts exclus
cur.execute("""
    SELECT 
        COUNT(DISTINCT facture),
        SUM(ca)
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2025-11-30'
    AND depot IN ('1', '41', '42')
""")
depots_exclus = cur.fetchone()
print(f"  Dépôts 1,41,42 exclus   : {depots_exclus[0]:>8,} tickets, {depots_exclus[1]:>12,.2f} €")

# CA négatif dans dépôts valides
print(f"  Avoirs/retours (négatif): {abs(total_negatif):>12,.2f} €")

# Produits divers
if produits_divers:
    print(f"  Produits Divers/Facture : {total_divers_tickets:>8,} tickets, {total_divers_ca:>12,.2f} €")

print("\n" + "="*90 + "\n")

cur.close()
conn.close()
