#!/usr/bin/env python3
import psycopg2
import time

DATABASE_URL = None
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            DATABASE_URL = line.split('=', 1)[1].strip().strip('"')
            break

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print('🔍 BENCHMARK DES REQUÊTES DASHBOARD:')
print('='*60)

total_start = time.time()

# 1. KPIs
print('\n1. KPIs globaux...')
start = time.time()
cur.execute('''
    SELECT 
      COUNT(DISTINCT carte) as total_clients,
      COUNT(*) as total_transactions,
      SUM(ca) as total_ca,
      AVG(ca) as panier_moyen
    FROM transactions
''')
result = cur.fetchone()
elapsed = time.time() - start
print(f'   ⏱️  {elapsed:.2f}s - {result[1]:,} transactions, {result[0]:,} clients')

# 2. Top produits avec JOIN
print('\n2. Top 10 produits (avec JOIN)...')
start = time.time()
cur.execute('''
    SELECT 
      p.id, p.famille, p.sous_famille,
      SUM(t.ca) as ca,
      SUM(t.quantite) as volume
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    GROUP BY p.id, p.famille, p.sous_famille
    ORDER BY ca DESC
    LIMIT 10
''')
result = cur.fetchall()
elapsed = time.time() - start
print(f'   ⏱️  {elapsed:.2f}s - {len(result)} produits')

# 3. Top magasins avec JOIN
print('\n3. Top 5 magasins (avec JOIN)...')
start = time.time()
cur.execute('''
    SELECT 
      m.code, m.nom, m.zone,
      SUM(t.ca) as ca,
      SUM(t.quantite) as volume,
      COUNT(DISTINCT t.facture) as nb_tickets,
      AVG(t.ca) as panier_moyen
    FROM transactions t
    JOIN magasins m ON (t.depot = m.code OR t.depot = CONCAT('M', m.code))
    GROUP BY m.code, m.nom, m.zone
    ORDER BY ca DESC
    LIMIT 5
''')
result = cur.fetchall()
elapsed = time.time() - start
print(f'   ⏱️  {elapsed:.2f}s - {len(result)} magasins')

# 4. Top clients avec JOIN
print('\n4. Top 10 clients (avec JOIN)...')
start = time.time()
cur.execute('''
    SELECT 
      c.carte, c.ville,
      SUM(t.ca) as ca,
      COUNT(DISTINCT t.facture) as nb_commandes
    FROM transactions t
    JOIN clients c ON t.carte = c.carte
    GROUP BY c.carte, c.ville
    ORDER BY ca DESC
    LIMIT 10
''')
result = cur.fetchall()
elapsed = time.time() - start
print(f'   ⏱️  {elapsed:.2f}s - {len(result)} clients')

# 5. Evolution mensuelle
print('\n5. Evolution mensuelle...')
start = time.time()
cur.execute('''
    SELECT 
      TO_CHAR(date, 'YYYY-MM') as mois,
      SUM(ca) as ca,
      COUNT(*) as tickets
    FROM transactions
    GROUP BY TO_CHAR(date, 'YYYY-MM')
    ORDER BY mois
''')
result = cur.fetchall()
elapsed = time.time() - start
print(f'   ⏱️  {elapsed:.2f}s - {len(result)} mois')

total_elapsed = time.time() - total_start

print('\n' + '='*60)
print(f'⏱️  TEMPS TOTAL: {total_elapsed:.2f}s')
print('='*60)

if total_elapsed > 5:
    print('\n⚠️  PROBLÈME: Plus de 5 secondes!')
    print('\n💡 Solutions possibles:')
    print('   1. Ajouter des index sur les colonnes de JOIN')
    print('   2. Neon en mode "sleep" → attendre wake-up')
    print('   3. Limiter les données importées')
elif total_elapsed > 2:
    print('\n⚠️  Un peu lent (>2s) mais acceptable')
else:
    print('\n✅ Performance OK!')

cur.close()
conn.close()
