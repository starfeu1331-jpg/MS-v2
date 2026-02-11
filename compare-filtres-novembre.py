import psycopg2, os
from dotenv import load_dotenv
load_dotenv()
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

# CA brut novembre sans aucun filtre
cur.execute("""
    SELECT 
        COUNT(DISTINCT facture) as tickets,
        SUM(ca) as ca_total
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2025-11-30'
""")
brut = cur.fetchone()

# CA sans dépôts 1,41,42
cur.execute("""
    SELECT 
        COUNT(DISTINCT facture) as tickets,
        SUM(ca) as ca_total
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2025-11-30'
    AND depot NOT IN ('1', '41', '42')
""")
filtre = cur.fetchone()

# CA sans dépôts 1,41,42 ET sans produits 80xxx/90xxx
cur.execute("""
    SELECT 
        COUNT(DISTINCT facture) as tickets,
        SUM(ca) as ca_total
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2025-11-30'
    AND depot NOT IN ('1', '41', '42')
    AND produit NOT LIKE '80%'
    AND produit NOT LIKE '90%'
""")
filtre2 = cur.fetchone()

# CA positif seulement (sans négatifs)
cur.execute("""
    SELECT 
        COUNT(DISTINCT CASE WHEN ca > 0 THEN facture END) as tickets,
        SUM(CASE WHEN ca > 0 THEN ca ELSE 0 END) as ca_positif
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2025-11-30'
    AND depot NOT IN ('1', '41', '42')
""")
positif = cur.fetchone()

# CA positif + sans produits 80/90
cur.execute("""
    SELECT 
        COUNT(DISTINCT CASE WHEN ca > 0 THEN facture END) as tickets,
        SUM(CASE WHEN ca > 0 THEN ca ELSE 0 END) as ca_positif
    FROM transactions
    WHERE date >= '2025-11-01' AND date <= '2025-11-30'
    AND depot NOT IN ('1', '41', '42')
    AND produit NOT LIKE '80%'
    AND produit NOT LIKE '90%'
""")
positif2 = cur.fetchone()

print('\nNOVEMBRE 2025 - COMPARAISON FILTRES')
print('='*70)
print(f"{'Filtre':<35} {'Tickets':>10} {'CA €':>20}")
print('='*70)
print(f"{'Brut (tout)':<35} {brut[0]:>10,} {brut[1]:>20,.2f}")
print(f"{'- dépôts 1,41,42':<35} {filtre[0]:>10,} {filtre[1]:>20,.2f}")
print(f"{'- dépôts - prod 80/90':<35} {filtre2[0]:>10,} {filtre2[1]:>20,.2f}")
print(f"{'- dépôts + CA positif seul':<35} {positif[0]:>10,} {positif[1]:>20,.2f}")
print(f"{'- dépôts - prod 80/90 + positif':<35} {positif2[0]:>10,} {positif2[1]:>20,.2f}")
print('-'*70)
print(f"{'ATTENDU (utilisateur)':<35} {'48,878':>10} {'2,773,813.10':>20}")
print(f"{'OBTENU (actuel API)':<35} {'47,957':>10} {'2,646,428.24':>20}")
print(f"{'ÉCART':<35} {'921':>10} {'127,384.86':>20}")
print('='*70)

# Trouver le match le plus proche
ecarts = [
    ("Brut", abs(brut[1] - 2773813.10), abs(brut[0] - 48878)),
    ("- dépôts 1,41,42", abs(filtre[1] - 2773813.10), abs(filtre[0] - 48878)),
    ("- dépôts - prod 80/90", abs(filtre2[1] - 2773813.10), abs(filtre2[0] - 48878)),
    ("- dépôts + positif", abs(positif[1] - 2773813.10), abs(positif[0] - 48878)),
    ("- dépôts - prod 80/90 + positif", abs(positif2[1] - 2773813.10), abs(positif2[0] - 48878)),
]

print(f"\n🎯 MATCH LE PLUS PROCHE :")
print('-'*70)
for nom, ecart_ca, ecart_tickets in sorted(ecarts, key=lambda x: x[1]):
    print(f"  {nom:<35} écart CA: {ecart_ca:>12,.2f} € | Tickets: {ecart_tickets:>5,}")

cur.close()
conn.close()
