#!/usr/bin/env python3
"""
SCRIPT DE TEST - Import seulement les clients récents avec MAPPING CORRECT
"""
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# Lire DATABASE_URL depuis .env
DATABASE_URL = None
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            DATABASE_URL = line.split('=', 1)[1].strip().strip('"')
            break

DATA_DIR = '/Users/marceau/Desktop/test data/decor-analytics/data/nouveaux/fevrier2026'

def clean_string(value):
    if pd.isna(value) or value == '':
        return None
    val = str(value).strip()
    return val if val and val != 'nan' else None

print("🧪 Test import clients avec mapping correct\n")

# Lire  100 premiers clients
df = pd.read_csv(
    f'{DATA_DIR}/Fichier_client_02-02-26 12.csv',
    sep=';',
    encoding='ISO-8859-1',
    header=None,
    skiprows=1,
    nrows=100
)

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

values = []
for _, row in df.iterrows():
    carte = clean_string(row.iloc[0])
    if not carte or carte == '0':
        continue
    
    # ORDRE DES COLONNES DE LA TABLE (voir schema):
    # carte, date_creation, date_validite, statut, civilite, sexe, date_naissance,
    # cp, ville, nom_adresse, adresse, adresse_2, adresse_4,
    # nom, prenom, email, telephone
    
    values.append((
        carte,                                                   # 1. carte
        clean_string(row.iloc[3]),                              # 2. date_creation
        clean_string(row.iloc[5]),                              # 3. date_validite
        clean_string(row.iloc[4]),                              # 4. statut
        clean_string(row.iloc[6]),                              # 5. civilite
        clean_string(row.iloc[8]),                              # 6. sexe
        clean_string(row.iloc[7]),                              # 7. date_naissance
        clean_string(row.iloc[15]),                             # 8. cp
        clean_string(row.iloc[16]),                             # 9. ville
        clean_string(row.iloc[11]),                             # 10. nom_adresse
        clean_string(row.iloc[12]),                             # 11. adresse
        clean_string(row.iloc[13]),                             # 12. adresse_2
        clean_string(row.iloc[14]),                             # 13. adresse_4
        clean_string(row.iloc[1]),                              # 14. nom ⭐
        clean_string(row.iloc[2]),                              # 15. prenom ⭐
        clean_string(row.iloc[9]),                              # 16. email ⭐
        clean_string(row.iloc[10]),                             # 17. telephone ⭐
    ))

print(f"Préparation de {len(values)} clients...")
print(f"\nExemple client 1 (souibgui karim):")
print(f"  Carte: {values[0][0]}")
print(f"  Nom: {values[0][13]}")
print(f"  Prénom: {values[0][14]}")
print(f"  Email: {values[0][15]}")
print(f"  Téléphone: {values[0][16]}")

try:
    execute_values(
        cur,
        """
        INSERT INTO clients (
            carte, date_creation, date_validite, statut, civilite, sexe, date_naissance,
            cp, ville, nom_adresse, adresse, adresse_2, adresse_4,
            nom, prenom, email, telephone
        )
        VALUES %s
        ON CONFLICT (carte) DO UPDATE SET
            nom = EXCLUDED.nom,
            prenom = EXCLUDED.prenom,
            email = EXCLUDED.email,
            telephone = EXCLUDED.telephone,
            cp = EXCLUDED.cp,
            ville = EXCLUDED.ville
        """,
        values
    )
    conn.commit()
    print(f"\n✅ {len(values)} clients importés avec succès !")
    
    # Vérification
    cur.execute("SELECT COUNT(*), COUNT(nom), COUNT(prenom), COUNT(email), COUNT(telephone) FROM clients WHERE nom IS NOT NULL OR prenom IS NOT NULL")
    total, noms, prenoms, emails, tels = cur.fetchone()
    print(f"\n📊 Vérification:")
    print(f"   Clients avec nom: {noms}")
    print(f"   Clients avec prénom: {prenoms}")
    print(f"   Clients avec email: {emails}")
    print(f"   Clients avec téléphone: {tels}")
    
except Exception as e:
    print(f"\n❌ Erreur: {e}")
    import traceback
    traceback.print_exc()

finally:
    cur.close()
    conn.close()
