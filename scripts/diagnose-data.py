#!/usr/bin/env python3
"""
Script de diagnostic pour comprendre exactement la structure des données
et ce qu'attend le Dashboard
"""
import duckdb
import json

print("=" * 80)
print("DIAGNOSTIC COMPLET DES DONNÉES")
print("=" * 80)

conn = duckdb.connect('/Users/marceau/Desktop/test data/decor-analytics/public/duckdb.db', read_only=True)

# 1. Vérifier ce qui est dans les transactions
print("\n📊 ÉCHANTILLON DES TRANSACTIONS (10 premières de 2025):")
print("-" * 80)
sample = conn.execute("""
    SELECT 
        t.facture,
        t.date,
        t.carte,
        t.produit,
        t.quantite,
        t.ca,
        t.depot,
        t.is_web,
        p.famille,
        p.sous_famille,
        m.nom as magasin_nom,
        m.zone as magasin_zone,
        c.sexe,
        c.cp as client_cp
    FROM transactions t
    LEFT JOIN produits p ON t.produit = p.id
    LEFT JOIN magasins m ON t.depot = m.code
    LEFT JOIN clients c ON t.carte = c.carte
    WHERE t.date >= '2025-01-01' AND t.date <= '2025-12-31'
    LIMIT 10
""").fetchall()

columns = ['facture', 'date', 'carte', 'produit', 'quantite', 'ca', 'depot', 'is_web', 
           'famille', 'sous_famille', 'magasin_nom', 'magasin_zone', 'sexe', 'client_cp']

for i, row in enumerate(sample):
    print(f"\n🎫 Transaction {i+1}:")
    for col, val in zip(columns, row):
        print(f"   {col:20} = {val}")

# 2. Statistiques globales
print("\n" + "=" * 80)
print("📈 STATISTIQUES 2025")
print("=" * 80)

stats = conn.execute("""
    SELECT 
        COUNT(*) as total_trans,
        COUNT(DISTINCT facture) as unique_factures,
        COUNT(DISTINCT carte) as unique_clients,
        SUM(ca) as ca_total,
        COUNT(DISTINCT depot) as unique_depots,
        COUNT(DISTINCT CASE WHEN is_web THEN facture END) as trans_web,
        SUM(CASE WHEN is_web THEN ca ELSE 0 END) as ca_web
    FROM transactions t
    WHERE t.date >= '2025-01-01' AND t.date <= '2025-12-31'
""").fetchone()

print(f"Total transactions:     {stats[0]:>15,}")
print(f"Factures uniques:       {stats[1]:>15,}")
print(f"Clients uniques:        {stats[2]:>15,}")
print(f"CA total:               {stats[3]:>15,.2f} €")
print(f"Dépôts uniques:         {stats[4]:>15,}")
print(f"Transactions web:       {stats[5]:>15,}")
print(f"CA web:                 {stats[6]:>15,.2f} €")

# 3. Vérifier les magasins
print("\n" + "=" * 80)
print("🏪 VÉRIFICATION MAGASINS")
print("=" * 80)

magasins = conn.execute("""
    SELECT 
        m.code,
        m.nom,
        m.zone,
        m.ville,
        COUNT(*) as nb_trans,
        SUM(t.ca) as ca_total
    FROM transactions t
    LEFT JOIN magasins m ON t.depot = m.code
    WHERE t.date >= '2025-01-01' AND t.date <= '2025-12-31'
    GROUP BY m.code, m.nom, m.zone, m.ville
    ORDER BY nb_trans DESC
    LIMIT 10
""").fetchall()

print(f"Top 10 magasins par nombre de transactions:")
for mag in magasins:
    code, nom, zone, ville, nb, ca = mag
    print(f"  {code or 'NULL':6} | {nom or 'NULL':30} | {zone or 'NULL':15} | {nb:>10,} trans | {ca:>15,.2f} €")

# 4. Vérifier is_web
print("\n" + "=" * 80)
print("🌐 RÉPARTITION is_web")
print("=" * 80)

web_stats = conn.execute("""
    SELECT 
        is_web,
        COUNT(*) as nb_trans,
        COUNT(DISTINCT facture) as nb_factures,
        SUM(ca) as ca_total
    FROM transactions
    WHERE date >= '2025-01-01' AND date <= '2025-12-31'
    GROUP BY is_web
    ORDER BY is_web
""").fetchall()

for row in web_stats:
    is_web, nb, factures, ca = row
    web_label = "WEB" if is_web else "MAGASIN"
    print(f"{web_label:10} | {nb:>10,} trans | {factures:>10,} factures | {ca:>15,.2f} €")

# 5. Format attendu par le Dashboard
print("\n" + "=" * 80)
print("🎯 FORMAT ATTENDU PAR LE DASHBOARD")
print("=" * 80)
print("""
D'après le code Dashboard.tsx ligne 115-165, chaque ticket doit avoir:

REQUIS:
  - ticket       (numéro de facture)
  - ca           (chiffre d'affaires)
  - magasin      (nom du magasin ou 'WEB')
  
OPTIONNEL:
  - date
  - carte
  - famille
  - sousFamille
  - cp
  - ville
  - sexe
  
Le Dashboard calcule:
  - uniqueTicketsMag.add(t.ticket)  <- compte les factures UNIQUES
  - if (t.magasin === 'WEB') {...}  <- détecte les transactions web
""")

# 6. Vérifier les NULL dans magasin_nom
print("\n" + "=" * 80)
print("⚠️  VÉRIFICATION NULL dans magasin_nom")
print("=" * 80)

null_check = conn.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN m.nom IS NULL THEN 1 END) as mag_null,
        COUNT(CASE WHEN m.nom IS NOT NULL THEN 1 END) as mag_ok,
        COUNT(CASE WHEN t.is_web THEN 1 END) as is_web_true,
        COUNT(CASE WHEN NOT t.is_web THEN 1 END) as is_web_false
    FROM transactions t
    LEFT JOIN magasins m ON t.depot = m.code
    WHERE t.date >= '2025-01-01' AND t.date <= '2025-12-31'
""").fetchone()

print(f"Total transactions:              {null_check[0]:>10,}")
print(f"magasin_nom NULL:                {null_check[1]:>10,} ({100*null_check[1]/null_check[0]:.1f}%)")
print(f"magasin_nom OK:                  {null_check[2]:>10,} ({100*null_check[2]/null_check[0]:.1f}%)")
print(f"is_web = true:                   {null_check[3]:>10,} ({100*null_check[3]/null_check[0]:.1f}%)")
print(f"is_web = false:                  {null_check[4]:>10,} ({100*null_check[4]/null_check[0]:.1f}%)")

# 7. Solution recommandée
print("\n" + "=" * 80)
print("💡 SOLUTION RECOMMANDÉE")
print("=" * 80)
print("""
Le mapping dans useDatabase.ts devrait être:

  ticket: row.facture,                          ← Identifiant unique de la facture
  ca: row.ca,                                    ← Chiffre d'affaires
  magasin: row.magasin_nom || 'INCONNU',        ← Nom du magasin (jamais null/undefined)
  date: row.date,
  carte: row.carte,
  famille: row.famille,
  sousFamille: row.sous_famille,
  ...

ATTENTION: Ne PAS utiliser is_web pour déterminer le magasin "WEB"
car is_web est probablement toujours false dans vos données.
""")

conn.close()

print("\n" + "=" * 80)
print("✅ DIAGNOSTIC TERMINÉ")
print("=" * 80)
