import os
import psycopg2
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

# URL de connexion depuis .env
DATABASE_URL = os.getenv('DATABASE_URL')

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

def test_period(period_name, date_start, date_end):
    print(f"\n{'='*70}")
    print(f"  {period_name}: {date_start} → {date_end}")
    print('='*70)
    
    # Stats clients actifs dans la période
    cur.execute(f"""
        SELECT 
            COUNT(DISTINCT c.carte)::int as total,
            COUNT(DISTINCT CASE WHEN c.sexe = 'H' THEN c.carte END)::int as hommes,
            COUNT(DISTINCT CASE WHEN c.sexe = 'F' THEN c.carte END)::int as femmes,
            COUNT(DISTINCT CASE WHEN c.email IS NOT NULL AND c.email != '' THEN c.carte END)::int as avec_email,
            COUNT(DISTINCT CASE WHEN c.telephone IS NOT NULL AND c.telephone != '' THEN c.carte END)::int as avec_telephone
        FROM clients c
        INNER JOIN transactions t ON c.carte = t.carte
        WHERE t.date >= '{date_start}' AND t.date <= '{date_end}'
    """)
    
    stats = cur.fetchone()
    total = stats[0]
    hommes = stats[1]
    femmes = stats[2]
    avec_email = stats[3]
    avec_tel = stats[4]
    
    print(f"👥 Clients actifs             : {total:,}".replace(",", " "))
    print(f"👨 Hommes                     : {hommes:,} ({100*hommes/total if total > 0 else 0:.1f}%)".replace(",", " "))
    print(f"👩 Femmes                     : {femmes:,} ({100*femmes/total if total > 0 else 0:.1f}%)".replace(",", " "))
    print(f"📧 Avec email                 : {avec_email:,} ({100*avec_email/total if total > 0 else 0:.1f}%)".replace(",", " "))
    print(f"📱 Avec téléphone             : {avec_tel:,} ({100*avec_tel/total if total > 0 else 0:.1f}%)".replace(",", " "))

# Test différentes périodes
print("\n" + "🔍 TEST STATISTIQUES CLIENTS PAR PÉRIODE".center(70))

# Période complète (Nov-Jan)
test_period("3 MOIS (Nov-Jan)", "2025-11-01", "2026-01-31")

# Novembre 2025 seul
test_period("NOVEMBRE 2025", "2025-11-01", "2025-11-30")

# Décembre 2025 seul  
test_period("DÉCEMBRE 2025", "2025-12-01", "2025-12-31")

# Janvier 2026 seul
test_period("JANVIER 2026", "2026-01-01", "2026-01-31")

print("\n" + "="*70)
print("✅ Les statistiques doivent varier selon la période sélectionnée")
print("="*70 + "\n")

cur.close()
conn.close()
