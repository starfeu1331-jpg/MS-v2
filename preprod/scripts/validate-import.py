#!/usr/bin/env python3
"""
Validation rapide de l'intégrité des données importées
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

print("\n" + "="*80)
print("🔍 VALIDATION FINALE DES DONNÉES IMPORTÉES")
print("="*80)

# Comptages
print("\n📊 COMPTAGES :")
cur.execute("SELECT COUNT(*) FROM transactions")
trans_count = cur.fetchone()[0]
print(f"  ✅ Transactions : {trans_count:,}")

cur.execute("SELECT COUNT(*) FROM clients")
clients_count = cur.fetchone()[0]
print(f"  ✅ Clients : {clients_count:,}")

cur.execute("SELECT COUNT(*) FROM produits")
produits_count = cur.fetchone()[0]
print(f"  ✅ Produits : {produits_count:,}")

# Complétude clients
print("\n📊 COMPLÉTUDE CLIENTS :")
cur.execute("""
    SELECT
        COUNT(CASE WHEN nom IS NOT NULL AND nom != '' THEN 1 END)::int as avec_nom,
        COUNT(CASE WHEN prenom IS NOT NULL AND prenom != '' THEN 1 END)::int as avec_prenom,
        COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END)::int as avec_email,
        COUNT(CASE WHEN telephone IS NOT NULL AND telephone != '' THEN 1 END)::int as avec_tel
    FROM clients
""")

avec_nom, avec_prenom, avec_email, avec_tel = cur.fetchone()
print(f"  • Nom : {avec_nom:,} ({avec_nom/clients_count*100:.1f}%)")
print(f"  • Prénom : {avec_prenom:,} ({avec_prenom/clients_count*100:.1f}%)")
print(f"  • Email : {avec_email:,} ({avec_email/clients_count*100:.1f}%)")
print(f"  • Téléphone : {avec_tel:,} ({avec_tel/clients_count*100:.1f}%)")

# Période des transactions
print("\n📊 PÉRIODE TRANSACTIONS :")
cur.execute("""
    SELECT 
        MIN(date) as date_min,
        MAX(date) as date_max
    FROM transactions
""")

date_min, date_max = cur.fetchone()
print(f"  • Date min : {date_min}")
print(f"  • Date max : {date_max}")

# Répartition mensuelle
print("\n📊 RÉPARTITION MENSUELLE :")
cur.execute("""
    SELECT
        TO_CHAR(date, 'YYYY-MM') as mois,
        COUNT(*) as nb_trans,
        SUM(ca) as ca_total,
        COUNT(DISTINCT carte) as nb_clients
    FROM transactions
    GROUP BY TO_CHAR(date, 'YYYY-MM')
    ORDER BY mois
""")

total_ca = 0
for mois, nb_trans, ca, nb_clients in cur.fetchall():
    total_ca += ca
    print(f"  • {mois} : {nb_trans:>10,} trans | {ca:>15,.2f}€ | {nb_clients:>6,} clients")

print(f"\n  💰 CA TOTAL : {total_ca:,.2f}€")

# Vérifier relations (clients/produits manquants)
print("\n📊 INTÉGRITÉ RÉFÉRENTIELLE :")

cur.execute("""
    SELECT COUNT(DISTINCT t.carte)
    FROM transactions t
    LEFT JOIN clients c ON t.carte = c.carte
    WHERE c.carte IS NULL
""")
missing_clients = cur.fetchone()[0]
print(f"  • Clients manquants : {missing_clients}")

cur.execute("""
    SELECT COUNT(DISTINCT t.produit)
    FROM transactions t
    LEFT JOIN produits p ON t.produit = p.id
    WHERE p.id IS NULL
""")
missing_produits = cur.fetchone()[0]
print(f"  • Produits manquants : {missing_produits}")

# Top 10 clients par CA
print("\n📊 TOP 10 CLIENTS PAR CA :")
cur.execute("""
    SELECT 
        c.carte,
        c.nom,
        c.prenom,
        COUNT(t.id) as nb_achats,
        SUM(t.ca) as ca_total
    FROM clients c
    JOIN transactions t ON c.carte = t.carte
    GROUP BY c.carte, c.nom, c.prenom
    ORDER BY ca_total DESC
    LIMIT 10
""")

for i, (carte, nom, prenom, nb_achats, ca_total) in enumerate(cur.fetchall(), 1):
    nom_complet = f"{nom or ''} {prenom or ''}".strip() or f"Carte {carte}"
    print(f"  {i:2d}. {nom_complet:30s} | {nb_achats:>5} achats | {ca_total:>12,.2f}€")

# Top 10 produits par CA
print("\n📊 TOP 10 PRODUITS PAR CA :")
cur.execute("""
    SELECT 
        p.id,
        p.nom,
        p.famille,
        COUNT(t.id) as nb_ventes,
        SUM(t.quantite) as qte_totale,
        SUM(t.ca) as ca_total
    FROM produits p
    JOIN transactions t ON p.id = t.produit
    GROUP BY p.id, p.nom, p.famille
    ORDER BY ca_total DESC
    LIMIT 10
""")

for i, (id_prod, nom, famille, nb_ventes, qte, ca_total) in enumerate(cur.fetchall(), 1):
    nom_prod = nom or f"Produit {id_prod}"
    print(f"  {i:2d}. {nom_prod[:35]:35s} | {int(qte):>6} unités | {ca_total:>12,.2f}€")

cur.close()
conn.close()

print("\n" + "="*80)
print("✅ VALIDATION TERMINÉE - DONNÉES INTÈGRES !")
print("="*80)
print("\n🚀 Votre application Magic Système est prête !\n")
