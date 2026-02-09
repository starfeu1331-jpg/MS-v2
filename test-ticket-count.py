import os
import psycopg2
from urllib.parse import urlparse

# URL de connexion depuis .env
DATABASE_URL = "postgresql://neondb_owner:npg_mdwPX1ovpWh7@ep-red-meadow-ah5j6nt7-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Parse l'URL
result = urlparse(DATABASE_URL)
username = result.username
password = result.password
database = result.path[1:]
hostname = result.hostname
port = result.port

# Connexion
conn = psycopg2.connect(
    database=database,
    user=username,
    password=password,
    host=hostname,
    port=port
)

cur = conn.cursor()

# Compter les lignes totales (transactions)
cur.execute("SELECT COUNT(*) FROM transactions")
total_transactions = cur.fetchone()[0]

# Compter les factures distinctes (tickets)
cur.execute("SELECT COUNT(DISTINCT facture) FROM transactions")
total_tickets = cur.fetchone()[0]

# Quelques stats
cur.execute("""
    SELECT 
        MIN(date::text) as date_min,
        MAX(date::text) as date_max,
        SUM(ca) as ca_total
    FROM transactions
""")
stats = cur.fetchone()

print("=" * 60)
print("STATISTIQUES DATABASE")
print("=" * 60)
print(f"📦 Lignes de transactions (produits) : {total_transactions:,}".replace(",", " "))
print(f"🎫 Nombre de tickets (factures)      : {total_tickets:,}".replace(",", " "))
print(f"📊 Moyenne lignes par ticket         : {total_transactions / total_tickets:.1f}")
print(f"📅 Période                           : {stats[0]} → {stats[1]}")
print(f"💰 CA total                          : {stats[2]:,.2f} €".replace(",", " "))
print(f"💰 Panier moyen                      : {stats[2] / total_tickets:.2f} €")
print("=" * 60)

cur.close()
conn.close()
