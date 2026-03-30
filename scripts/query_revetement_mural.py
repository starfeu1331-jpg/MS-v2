#!/usr/bin/env python3
"""
Requête: clients ayant acheté du revêtement mural
- Depuis 2022
- Depuis février 2023 (3 dernières années)
- Avec numéro mobile valide + accepte SMS
"""

import psycopg2

DB_URL = "postgresql://decordb:OVHdecordb26@yu4496-002.eu.clouddb.ovh.net:35847/basedecordb"
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

print("=" * 80)
print("CLIENTS AYANT ACHETÉ FAMILLE 'Mur' DEPUIS 2022")
print("=" * 80)

# Total clients distincts depuis 2022
cur.execute("""
    SELECT COUNT(DISTINCT t.carte)
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.famille = 'Mur'
    AND t.date >= '2022-01-01'
    AND t.carte IS NOT NULL
""")
total_since_2022 = cur.fetchone()[0]
print(f"Total clients famille Mur depuis 2022: {total_since_2022:,}")

# Depuis février 2023 (3 dernières années)
cur.execute("""
    SELECT COUNT(DISTINCT t.carte)
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.famille = 'Mur'
    AND t.date >= '2023-02-01'
    AND t.carte IS NOT NULL
""")
total_since_feb2023 = cur.fetchone()[0]
print(f"Total clients famille Mur depuis fév 2023: {total_since_feb2023:,}")

print()
print("=" * 80)
print("AVEC NUMERO MOBILE VALIDE (06 ou 07)")
print("=" * 80)

# Depuis 2022 + mobile valide
cur.execute("""
    SELECT COUNT(DISTINCT t.carte)
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    JOIN clients c ON t.carte = c.carte
    WHERE p.famille = 'Mur'
    AND t.date >= '2022-01-01'
    AND t.carte IS NOT NULL
    AND c.telephone IS NOT NULL
    AND c.telephone != ''
    AND (
        c.telephone LIKE '06%' OR c.telephone LIKE '07%'
        OR c.telephone LIKE '+336%' OR c.telephone LIKE '+337%'
        OR c.telephone LIKE '00336%' OR c.telephone LIKE '00337%'
    )
""")
mobile_since_2022 = cur.fetchone()[0]
print(f"Depuis 2022 avec mobile valide: {mobile_since_2022:,}")

# Depuis fév 2023 + mobile valide
cur.execute("""
    SELECT COUNT(DISTINCT t.carte)
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    JOIN clients c ON t.carte = c.carte
    WHERE p.famille = 'Mur'
    AND t.date >= '2023-02-01'
    AND t.carte IS NOT NULL
    AND c.telephone IS NOT NULL
    AND c.telephone != ''
    AND (
        c.telephone LIKE '06%' OR c.telephone LIKE '07%'
        OR c.telephone LIKE '+336%' OR c.telephone LIKE '+337%'
        OR c.telephone LIKE '00336%' OR c.telephone LIKE '00337%'
    )
""")
mobile_since_feb2023 = cur.fetchone()[0]
print(f"Depuis fév 2023 avec mobile valide: {mobile_since_feb2023:,}")

print()
print("=" * 80)
print("DETAIL PAR SOUS-FAMILLE (depuis 2022)")
print("=" * 80)

cur.execute("""
    SELECT p.sous_famille, COUNT(DISTINCT t.carte) as nb_clients
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.famille = 'Mur'
    AND t.date >= '2022-01-01'
    AND t.carte IS NOT NULL
    GROUP BY p.sous_famille
    ORDER BY nb_clients DESC
""")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]:,} clients")

print()
print("=" * 80)
print("DETAIL PAR SOUS-FAMILLE (depuis fév 2023)")
print("=" * 80)

cur.execute("""
    SELECT p.sous_famille, COUNT(DISTINCT t.carte) as nb_clients
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.famille = 'Mur'
    AND t.date >= '2023-02-01'
    AND t.carte IS NOT NULL
    GROUP BY p.sous_famille
    ORDER BY nb_clients DESC
""")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]:,} clients")

# Détail avec mobile par sous-famille
print()
print("=" * 80)
print("DETAIL PAR SOUS-FAMILLE AVEC MOBILE (depuis 2022)")
print("=" * 80)

cur.execute("""
    SELECT p.sous_famille, COUNT(DISTINCT t.carte) as nb_clients
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    JOIN clients c ON t.carte = c.carte
    WHERE p.famille = 'Mur'
    AND t.date >= '2022-01-01'
    AND t.carte IS NOT NULL
    AND c.telephone IS NOT NULL
    AND c.telephone != ''
    AND (
        c.telephone LIKE '06%%' OR c.telephone LIKE '07%%'
        OR c.telephone LIKE '+336%%' OR c.telephone LIKE '+337%%'
        OR c.telephone LIKE '00336%%' OR c.telephone LIKE '00337%%'
    )
    GROUP BY p.sous_famille
    ORDER BY nb_clients DESC
""")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]:,} clients")

print()
print("=" * 80)
print("DETAIL PAR SOUS-FAMILLE AVEC MOBILE (depuis fév 2023)")
print("=" * 80)

cur.execute("""
    SELECT p.sous_famille, COUNT(DISTINCT t.carte) as nb_clients
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    JOIN clients c ON t.carte = c.carte
    WHERE p.famille = 'Mur'
    AND t.date >= '2023-02-01'
    AND t.carte IS NOT NULL
    AND c.telephone IS NOT NULL
    AND c.telephone != ''
    AND (
        c.telephone LIKE '06%%' OR c.telephone LIKE '07%%'
        OR c.telephone LIKE '+336%%' OR c.telephone LIKE '+337%%'
        OR c.telephone LIKE '00336%%' OR c.telephone LIKE '00337%%'
    )
    GROUP BY p.sous_famille
    ORDER BY nb_clients DESC
""")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]:,} clients")

print()
print("=" * 80)
print("NOTE SUR OPT-IN SMS")
print("=" * 80)
print("La table clients ne contient PAS de champ opt-in/consentement SMS.")
print("Les chiffres ci-dessus filtrent uniquement sur la présence d'un numéro mobile valide (06/07).")

# Exemples de numéros
cur.execute("SELECT telephone FROM clients WHERE telephone IS NOT NULL AND telephone != '' LIMIT 10")
print()
print("Exemples de formats de numéros en BDD:")
for row in cur.fetchall():
    print(f"  '{row[0]}'")

# Stats globales sur les téléphones
cur.execute("SELECT COUNT(*) FROM clients WHERE telephone IS NOT NULL AND telephone != ''")
total_tel = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM clients")
total_clients = cur.fetchone()[0]
cur.execute("""SELECT COUNT(*) FROM clients 
    WHERE telephone IS NOT NULL AND telephone != ''
    AND (telephone LIKE '06%%' OR telephone LIKE '07%%'
         OR telephone LIKE '+336%%' OR telephone LIKE '+337%%'
         OR telephone LIKE '00336%%' OR telephone LIKE '00337%%')
""")
total_mobile = cur.fetchone()[0]
print(f"\nStats téléphones globales:")
print(f"  Total clients: {total_clients:,}")
print(f"  Avec téléphone: {total_tel:,}")
print(f"  Avec mobile valide: {total_mobile:,}")

conn.close()
