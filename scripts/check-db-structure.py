import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

print('=== STRUCTURE transactions ===')
cur.execute("""
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions'
ORDER BY ordinal_position
""")
for row in cur.fetchall():
    print(f'{row[0]}: {row[1]}')

print('\n=== STRUCTURE clients ===')
cur.execute("""
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients'
ORDER BY ordinal_position
""")
for row in cur.fetchall():
    print(f'{row[0]}: {row[1]}')

print('\n=== STRUCTURE produits ===')
cur.execute("""
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'produits'
ORDER BY ordinal_position
""")
for row in cur.fetchall():
    print(f'{row[0]}: {row[1]}')

print('\n=== STRUCTURE magasins ===')
cur.execute("""
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'magasins'
ORDER BY ordinal_position
""")
for row in cur.fetchall():
    print(f'{row[0]}: {row[1]}')

print('\n\n=== TEST REQUÊTE SECTION ALL ===')
print('1. KPIs:')
try:
    cur.execute("""
    SELECT 
      COUNT(DISTINCT carte)::int as "totalClients",
      COUNT(*)::int as "totalTransactions",
      SUM(ca)::float as "totalCA",
      (SUM(ca) / COUNT(DISTINCT facture))::float as "panierMoyen"
    FROM transactions
    LIMIT 1
    """)
    print('✅ KPIs OK:', cur.fetchone())
except Exception as e:
    print('❌ KPIs ERROR:', str(e))

print('\n2. Stats Clients:')
try:
    cur.execute("""
    SELECT 
      COUNT(*)::int as total,
      COUNT(CASE WHEN sexe = 'H' THEN 1 END)::int as hommes,
      COUNT(CASE WHEN sexe = 'F' THEN 1 END)::int as femmes
    FROM clients
    LIMIT 1
    """)
    print('✅ Stats Clients OK:', cur.fetchone())
except Exception as e:
    print('❌ Stats Clients ERROR:', str(e))

print('\n3. Top Produits:')
try:
    cur.execute("""
    SELECT 
      p.id as code,
      p.famille,
      p.sous_famille,
      SUM(t.ca)::float as ca
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    GROUP BY p.id, p.famille, p.sous_famille
    ORDER BY ca DESC
    LIMIT 1
    """)
    print('✅ Top Produits OK:', cur.fetchone())
except Exception as e:
    print('❌ Top Produits ERROR:', str(e))

print('\n4. Top Magasins:')
try:
    cur.execute("""
    SELECT 
      m.code,
      m.nom,
      SUM(t.ca)::float as ca
    FROM transactions t
    JOIN magasins m ON t.depot = m.code
    GROUP BY m.code, m.nom
    ORDER BY ca DESC
    LIMIT 1
    """)
    print('✅ Top Magasins OK (depot = code):', cur.fetchone())
except Exception as e:
    print('❌ Top Magasins ERROR (depot = code):', str(e))

print('\n5. Evolution Mensuelle:')
try:
    cur.execute("""
    SELECT 
      TO_CHAR(date, 'YYYY-MM') as mois,
      SUM(ca)::float as ca,
      COUNT(*)::int as tickets
    FROM transactions
    GROUP BY TO_CHAR(date, 'YYYY-MM')
    ORDER BY mois
    LIMIT 1
    """)
    print('✅ Evolution Mensuelle OK:', cur.fetchone())
except Exception as e:
    print('❌ Evolution Mensuelle ERROR:', str(e))

cur.close()
conn.close()
