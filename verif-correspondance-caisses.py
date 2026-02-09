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

# Liste fournie par l'utilisateur
caisses_officielles = {
    '12': 'Caisse ALES',
    '13': 'Caisse BEZIERS',
    '14': 'Caisse ARLES',
    '15': 'Caisse VAISE',
    '16': 'Caisse ST JEAN DE VEDAS',
    '17': 'Caisse St Peray',
    '19': 'Caisse Romans',
    '20': 'Caisse Montfavet',
    '22': 'Caisse ST BONNET DE MURE',
    '23': 'Caisse VIRIAT',
    '24': 'Caisse SILLINGY',
    '25': 'Caisse CARCASSONNE',
    '26': 'Caisse ST EGREVE',
    '27': 'Caisse VILLEFRANCHE',
    '28': 'Caisse ST MARTIN D\'HERES',
    '29': 'Caisse FENOUILLET',
    '31': 'Caisse Montelimar',
    '32': 'Caisse LEMPDES',
    '33': 'Caisse ESTANCARBON',
    '34': 'Caisse AUBENAS',
    '35': 'Caisse NIMES',
    '36': 'Caisse VOGLANS',
    '37': 'Caisse SORGUES',
    '38': 'Caisse ONET LE CHATEAU',
    '39': 'Caisse NARBONNE',
    '48': 'D2D',
    '49': 'SCEM',
    '50': 'CAP',
    '52': 'Avoir M19',
    '53': 'Ventes etats',
    '54': 'Ventes Web',
    '55': 'Client activités annexes',
    '58': 'Avoir M17',
    '60': 'MAZET MESSAGERIE MONTELIMAR',
    '62': 'TAILORMADE LOGISTICS FRANCE',
    '63': 'GLS',
    '100': 'FMI DIRRA',
    '101': 'EFIWARE',
    '102': 'Client Acompte M19',
    '109': 'Avoir M12',
    '110': 'Avoir M13',
    '111': 'Avoir M14',
    '112': 'Avoir M15',
    '113': 'Avoir M16',
    '114': 'Avoir M20',
    '115': 'Avoir M22',
    '116': 'Avoir M23',
    '117': 'Avoir M24',
    '118': 'Avoir M25',
    '119': 'Avoir M26',
}

magasins_reels = ['12', '13', '14', '15', '16', '17', '19', '20', '22', '23', 
                  '24', '25', '26', '27', '28', '29', '31', '32', '33', '34', 
                  '35', '36', '37', '38', '39']

avoirs = ['52', '58', '109', '110', '111', '112', '113', '114', '115', '116', '117', '118', '119']

services = ['48', '49', '50', '53', '54', '55', '60', '62', '63', '100', '101', '102']

print("\n" + "="*90)
print("ANALYSE CORRESPONDANCE CAISSES - PÉRIODE NOV 2025 - JAN 2026".center(90))
print("="*90)

# 1. Quels dépôts sont utilisés dans la base ?
cur.execute("""
    SELECT 
        t.depot,
        COUNT(DISTINCT t.facture) as nb_tickets,
        COUNT(*) as nb_lignes,
        SUM(t.ca) as ca_total,
        MIN(t.ca) as ca_min,
        MAX(t.ca) as ca_max,
        COUNT(CASE WHEN t.ca < 0 THEN 1 END) as nb_negatifs
    FROM transactions t
    GROUP BY t.depot
    ORDER BY t.depot::int
""")

depots_utilises = cur.fetchall()

print("\n📊 1. DÉPÔTS UTILISÉS DANS LA BASE")
print("-"*90)
print(f"{'Dépôt':<8} {'Description':<35} {'Tickets':>8} {'Lignes':>8} {'CA €':>13} {'Négatifs':>9}")
print("-"*90)

depots_dans_base = set()
depots_non_listes = []
depots_magasins_reels = []
depots_avoirs_utilises = []
depots_services_utilises = []

for depot_info in depots_utilises:
    depot, tickets, lignes, ca, ca_min, ca_max, negatifs = depot_info
    depots_dans_base.add(depot)
    
    description = caisses_officielles.get(depot, "❌ NON LISTÉ")
    if depot not in caisses_officielles:
        depots_non_listes.append(depot)
    
    if depot in magasins_reels:
        depots_magasins_reels.append(depot)
        emoji = "🏪"
    elif depot in avoirs:
        depots_avoirs_utilises.append(depot)
        emoji = "↩️ "
    elif depot in services:
        depots_services_utilises.append(depot)
        emoji = "📦"
    else:
        emoji = "❓"
    
    ca_str = f"{ca:,.0f}" if ca else "0"
    print(f"{emoji} {depot:<6} {description[:33]:<35} {tickets:>8} {lignes:>8} {ca_str:>13} {negatifs:>9}")

# 2. Caisses officielles NON utilisées
print("\n\n⚠️  2. CAISSES OFFICIELLES NON UTILISÉES (dans liste mais pas dans data)")
print("-"*90)
depots_manquants = []
for code, nom in sorted(caisses_officielles.items(), key=lambda x: int(x[0])):
    if code not in depots_dans_base:
        depots_manquants.append((code, nom))
        print(f"   {code:<8} {nom}")

if not depots_manquants:
    print("✅ Toutes les caisses officielles sont présentes dans les données")

# 3. Caisses NON officielles (dans data mais pas dans liste)
print("\n\n🚨 3. DÉPÔTS NON OFFICIELS (dans data mais pas dans ta liste)")
print("-"*90)
if depots_non_listes:
    for depot in sorted(depots_non_listes, key=lambda x: int(x) if x.isdigit() else 999):
        cur.execute("""
            SELECT COUNT(*), SUM(ca)
            FROM transactions
            WHERE depot = %s
        """, (depot,))
        nb, ca = cur.fetchone()
        print(f"   {depot:<8} {nb:>8} lignes    {ca:>15,.0f} €")
else:
    print("✅ Aucun dépôt non-officiel trouvé")

# 4. Analyse détaillée des AVOIRS
print("\n\n↩️  4. ANALYSE DES DÉPÔTS 'AVOIR' (Retours/Avoirs)")
print("-"*90)
print(f"{'Code':<8} {'Description':<30} {'Utilisé':>8} {'Tickets':>8} {'Lignes':>8} {'CA €':>13}")
print("-"*90)

total_avoirs_ca = 0
for avoir_code in sorted(avoirs, key=lambda x: int(x)):
    nom = caisses_officielles[avoir_code]
    if avoir_code in depots_dans_base:
        cur.execute("""
            SELECT COUNT(DISTINCT facture), COUNT(*), SUM(ca)
            FROM transactions
            WHERE depot = %s
        """, (avoir_code,))
        tickets, lignes, ca = cur.fetchone()
        total_avoirs_ca += ca if ca else 0
        print(f"{avoir_code:<8} {nom:<30} {'✓':>8} {tickets:>8} {lignes:>8} {ca:>13,.0f}")
    else:
        print(f"{avoir_code:<8} {nom:<30} {'✗':>8} {'-':>8} {'-':>8} {'-':>13}")

print(f"\n💰 Total CA des avoirs : {total_avoirs_ca:,.2f} € (devrait être négatif)")

# 5. Statistiques globales
print("\n\n📈 5. STATISTIQUES GLOBALES")
print("-"*90)
print(f"   Caisses officielles listées    : {len(caisses_officielles)}")
print(f"   Dépôts utilisés dans la base   : {len(depots_dans_base)}")
print(f"   Magasins physiques réels       : {len([d for d in magasins_reels if d in depots_dans_base])}/{len(magasins_reels)}")
print(f"   Dépôts 'Avoir' utilisés        : {len(depots_avoirs_utilises)}/{len(avoirs)}")
print(f"   Dépôts 'Service' utilisés      : {len(depots_services_utilises)}/{len(services)}")
print(f"   Dépôts NON-OFFICIELS trouvés   : {len(depots_non_listes)}")

# 6. Recommandations pour filtrage
print("\n\n✅ 6. RECOMMANDATIONS POUR LE DASHBOARD")
print("-"*90)
print("\n📌 INCLURE (vraies ventes magasins):")
magasins_a_inclure = sorted([d for d in magasins_reels if d in depots_dans_base], key=lambda x: int(x))
print(f"   Codes: {', '.join(magasins_a_inclure)}")

print("\n❌ EXCLURE (comptabilité, avoirs, services):")
a_exclure = sorted(depots_avoirs_utilises + depots_services_utilises + depots_non_listes, 
                   key=lambda x: int(x) if x.isdigit() else 999)
print(f"   Codes: {', '.join(a_exclure)}")

print("\n⚠️  À DÉCIDER (selon besoin métier):")
print(f"   - Ventes Web (54) : {('utilisé' if '54' in depots_dans_base else 'non utilisé')}")
print(f"   - D2D, SCEM, CAP : Livraisons/Services spéciaux")

print("\n" + "="*90 + "\n")

cur.close()
conn.close()
