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
print("ANALYSE DES MAGASINS ET ANOMALIES".center(80))
print("="*80)

# 1. Liste de tous les magasins/caisses utilisés
print("\n📍 1. LISTE DE TOUS LES POINTS DE VENTE (CAISSES)")
print("-"*80)

cur.execute("""
    SELECT 
        m.code,
        m.nom,
        m.zone,
        COUNT(DISTINCT t.facture) as nb_tickets,
        COUNT(*) as nb_lignes,
        SUM(t.ca) as ca_total,
        COUNT(DISTINCT t.carte) as nb_clients,
        COUNT(DISTINCT t.produit) as nb_produits_diff
    FROM magasins m
    LEFT JOIN transactions t ON m.code = t.depot
    GROUP BY m.code, m.nom, m.zone
    ORDER BY nb_tickets DESC NULLS LAST
""")

magasins = cur.fetchall()
print(f"\n{'Code':<8} {'Nom':<35} {'Zone':<15} {'Tickets':>8} {'Lignes':>8} {'CA €':>12} {'Clients':>8} {'Produits':>8}")
print("-"*80)

for mag in magasins:
    code, nom, zone, tickets, lignes, ca, clients, produits = mag
    ca_str = f"{ca:,.0f}" if ca else "0"
    print(f"{code or 'N/A':<8} {(nom or 'Sans nom')[:35]:<35} {zone or 'N/A':<15} {tickets or 0:>8} {lignes or 0:>8} {ca_str:>12} {clients or 0:>8} {produits or 0:>8}")

print(f"\n📊 TOTAL: {len(magasins)} points de vente dans la table magasins")

# 2. Caisses utilisées dans transactions mais pas dans magasins
print("\n\n⚠️  2. CAISSES DANS TRANSACTIONS MAIS PAS DANS TABLE MAGASINS")
print("-"*80)

cur.execute("""
    SELECT 
        t.depot,
        COUNT(DISTINCT t.facture) as nb_tickets,
        COUNT(*) as nb_lignes,
        SUM(t.ca) as ca_total
    FROM transactions t
    LEFT JOIN magasins m ON t.depot = m.code
    WHERE m.code IS NULL
    GROUP BY t.depot
    ORDER BY nb_tickets DESC
""")

caisses_orphelines = cur.fetchall()
if caisses_orphelines:
    print(f"\n{'Caisse':<10} {'Tickets':>10} {'Lignes':>10} {'CA €':>15}")
    print("-"*80)
    for c in caisses_orphelines:
        print(f"{c[0]:<10} {c[1]:>10} {c[2]:>10} {c[3]:>15,.0f}")
else:
    print("✅ Aucune caisse orpheline trouvée")

# 3. Analyse du magasin/caisse "1" (siège)
print("\n\n🏢 3. ANALYSE DE LA CAISSE '1' (SIÈGE/COMPTA)")
print("-"*80)

cur.execute("""
    SELECT 
        p.id,
        p.famille,
        p.sous_famille,
        COUNT(DISTINCT t.facture) as nb_tickets,
        COUNT(*) as nb_lignes,
        SUM(t.ca) as ca_total,
        SUM(t.quantite) as quantite_totale
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE t.depot = '1'
    GROUP BY p.id, p.famille, p.sous_famille
    ORDER BY nb_tickets DESC
    LIMIT 20
""")

produits_caisse1 = cur.fetchall()
if produits_caisse1:
    print(f"\n{'Code Produit':<15} {'Famille':<25} {'Sous-famille':<30} {'Tickets':>8} {'Lignes':>8} {'CA €':>12}")
    print("-"*80)
    for p in produits_caisse1:
        pid, fam, sfam, tickets, lignes, ca, qte = p
        print(f"{pid:<15} {(fam or 'N/A')[:25]:<25} {(sfam or 'N/A')[:30]:<30} {tickets:>8} {lignes:>8} {ca:>12,.0f}")
else:
    print("❌ Pas de transactions pour la caisse '1'")

# 4. Produits suspects (codes spéciaux commençant par 8, 9, etc.)
print("\n\n🔍 4. PRODUITS SUSPECTS (Codes spéciaux: 8xxxxx, 9xxxxx)")
print("-"*80)

cur.execute("""
    SELECT 
        p.id,
        p.famille,
        p.sous_famille,
        COUNT(DISTINCT t.facture) as nb_tickets,
        COUNT(*) as nb_lignes,
        SUM(t.ca) as ca_total,
        COUNT(DISTINCT t.depot) as nb_caisses
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.id LIKE '8%' OR p.id LIKE '9%'
    GROUP BY p.id, p.famille, p.sous_famille
    ORDER BY nb_tickets DESC
    LIMIT 30
""")

produits_suspects = cur.fetchall()
if produits_suspects:
    print(f"\n{'Code':<12} {'Famille':<25} {'Sous-famille':<30} {'Tickets':>8} {'Lignes':>8} {'CA €':>12} {'Caisses':>8}")
    print("-"*80)
    for p in produits_suspects:
        pid, fam, sfam, tickets, lignes, ca, caisses = p
        print(f"{pid:<12} {(fam or 'N/A')[:25]:<25} {(sfam or 'N/A')[:30]:<30} {tickets:>8} {lignes:>8} {ca:>12,.0f} {caisses:>8}")
else:
    print("✅ Aucun produit suspect trouvé")

# 5. Familles "Divers" ou "Facture"
print("\n\n📦 5. PRODUITS 'DIVERS' / 'FACTURE COMPTA'")
print("-"*80)

cur.execute("""
    SELECT 
        p.id,
        p.famille,
        p.sous_famille,
        COUNT(DISTINCT t.facture) as nb_tickets,
        SUM(t.ca) as ca_total,
        COUNT(DISTINCT t.depot) as nb_caisses
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE 
        p.famille ILIKE '%divers%' 
        OR p.famille ILIKE '%factu%'
        OR p.sous_famille ILIKE '%divers%'
        OR p.sous_famille ILIKE '%factu%'
        OR p.sous_famille ILIKE '%compta%'
    GROUP BY p.id, p.famille, p.sous_famille
    ORDER BY nb_tickets DESC
""")

produits_divers = cur.fetchall()
if produits_divers:
    print(f"\n{'Code':<12} {'Famille':<30} {'Sous-famille':<35} {'Tickets':>8} {'CA €':>12} {'Caisses':>8}")
    print("-"*80)
    for p in produits_divers:
        pid, fam, sfam, tickets, ca, caisses = p
        print(f"{pid:<12} {(fam or 'N/A')[:30]:<30} {(sfam or 'N/A')[:35]:<35} {tickets:>8} {ca:>12,.0f} {caisses:>8}")
    print(f"\n⚠️  TOTAL: {len(produits_divers)} produits de type Divers/Facture/Compta")
else:
    print("✅ Aucun produit 'Divers' trouvé")

# 6. Transactions avec CA = 0 ou négatif
print("\n\n💰 6. TRANSACTIONS ANORMALES (CA = 0 ou négatif)")
print("-"*80)

cur.execute("""
    SELECT 
        t.depot,
        COUNT(DISTINCT t.facture) as nb_tickets,
        COUNT(*) as nb_lignes,
        SUM(t.ca) as ca_total,
        MIN(t.ca) as ca_min,
        MAX(t.ca) as ca_max
    FROM transactions t
    WHERE t.ca <= 0
    GROUP BY t.depot
    ORDER BY nb_lignes DESC
""")

trans_anormales = cur.fetchall()
if trans_anormales:
    print(f"\n{'Caisse':<10} {'Tickets':>10} {'Lignes':>10} {'CA Total':>15} {'CA Min':>12} {'CA Max':>12}")
    print("-"*80)
    for t in trans_anormales:
        caisse, tickets, lignes, ca_tot, ca_min, ca_max = t
        print(f"{caisse:<10} {tickets:>10} {lignes:>10} {ca_tot:>15,.2f} {ca_min:>12,.2f} {ca_max:>12,.2f}")
    print(f"\n⚠️  ATTENTION: {sum([t[2] for t in trans_anormales])} lignes avec CA ≤ 0")
else:
    print("✅ Aucune transaction avec CA anormal")

# 7. Répartition CA par type de caisse
print("\n\n📊 7. RÉPARTITION DU CA PAR TYPE DE POINT DE VENTE")
print("-"*80)

cur.execute("""
    WITH caisse_analysis AS (
        SELECT 
            t.depot,
            COUNT(DISTINCT t.facture) as tickets,
            SUM(t.ca) as ca
        FROM transactions t
        GROUP BY t.depot
    )
    SELECT 
        CASE 
            WHEN caisse = '1' THEN 'Siège/Compta'
            WHEN caisse IN ('2', '3', '4', '5', '6', '7', '8', '9', '10', 
                           '11', '12', '13', '14', '15', '16', '17', '18', 
                           '19', '20', '21', '22', '23', '24') THEN 'Magasin réel'
            ELSE 'Autre'
        END as type_caisse,
        COUNT(*) as nb_caisses,
        SUM(tickets) as total_tickets,
        SUM(ca) as total_ca
    FROM caisse_analysis
    GROUP BY type_caisse
    ORDER BY total_ca DESC
""")

repartition = cur.fetchall()
print(f"\n{'Type':<20} {'Nb Caisses':>12} {'Tickets':>12} {'CA Total €':>18} {'% CA':>8}")
print("-"*80)
ca_total_global = sum([r[3] for r in repartition])
for r in repartition:
    type_c, nb_c, tickets, ca = r
    pct = (ca / ca_total_global * 100) if ca_total_global > 0 else 0
    print(f"{type_c:<20} {nb_c:>12} {tickets:>12,} {ca:>18,.0f} {pct:>7.2f}%")

print("\n" + "="*80)
print("FIN DE L'ANALYSE".center(80))
print("="*80 + "\n")

cur.close()
conn.close()
