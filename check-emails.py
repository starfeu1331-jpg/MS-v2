#!/usr/bin/env python3
import psycopg2
from dotenv import load_dotenv
import os

# Charger les variables d'environnement
load_dotenv()

# Connexion depuis .env.local ou variable système
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    # Essayer de lire depuis prisma/.env
    env_path = 'prisma/.env'
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('DATABASE_URL'):
                    DATABASE_URL = line.split('=', 1)[1].strip().strip('"')
                    break

if not DATABASE_URL:
    print("❌ DATABASE_URL introuvable")
    exit(1)

print("🔍 Connexion à la base de données...")
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Stats emails
print("\n📊 STATISTIQUES EMAILS:")
print("-" * 60)
cur.execute('''
SELECT 
  COUNT(*) as total_clients,
  COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as avec_email,
  COUNT(CASE WHEN email IS NULL OR email = '' THEN 1 END) as sans_email,
  ROUND(100.0 * COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) / COUNT(*), 2) as pct_email
FROM clients
''')

result = cur.fetchone()
print(f'Total clients: {result[0]:,}')
print(f'Avec email: {result[1]:,}')
print(f'Sans email: {result[2]:,}')
print(f'% avec email: {result[3]}%')

# Exemples d'emails
print("\n📧 10 premiers emails renseignés:")
print("-" * 60)
cur.execute('''
SELECT carte, nom, prenom, email 
FROM clients 
WHERE email IS NOT NULL AND email != ''
ORDER BY carte
LIMIT 10
''')
for row in cur.fetchall():
    print(f'Carte {row[0]:12s} | {row[1] or "?"} {row[2] or "?"} | {row[3]}')

# Vérifier aussi les téléphones pour comparaison
print("\n📱 COMPARAISON AVEC TÉLÉPHONES:")
print("-" * 60)
cur.execute('''
SELECT 
  COUNT(CASE WHEN telephone IS NOT NULL AND telephone != '' THEN 1 END) as avec_tel,
  ROUND(100.0 * COUNT(CASE WHEN telephone IS NOT NULL AND telephone != '' THEN 1 END) / COUNT(*), 2) as pct_tel
FROM clients
''')
result = cur.fetchone()
print(f'Avec téléphone: {result[0]:,}')
print(f'% avec téléphone: {result[1]}%')

# Distribution par source
print("\n📍 CLIENTS AVEC EMAIL PAR DÉPÔT:")
print("-" * 60)
cur.execute('''
SELECT 
  t.depot,
  COUNT(DISTINCT c.carte) as clients_total,
  COUNT(DISTINCT CASE WHEN c.email IS NOT NULL AND c.email != '' THEN c.carte END) as clients_avec_email,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN c.email IS NOT NULL AND c.email != '' THEN c.carte END) / COUNT(DISTINCT c.carte), 2) as pct
FROM clients c
JOIN transactions t ON c.carte = t.carte
GROUP BY t.depot
ORDER BY clients_total DESC
''')
for row in cur.fetchall():
    print(f'{row[0]:12s} : {row[1]:6,} clients dont {row[2]:6,} avec email ({row[3]}%)')

cur.close()
conn.close()
print("\n✅ Analyse terminée")
