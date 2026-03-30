#!/usr/bin/env python3
"""
Nettoyer et ré-importer les 100 premiers clients proprement
"""
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

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

print("="*80)
print("🧹 NETTOYAGE ET RÉIMPORT PROPRE")
print("="*80)

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# 1. SUPPRIMER TOUS LES CLIENTS (ils sont corrompus)
print("\n🗑️  Suppression de tous les clients corrompus...")
cur.execute("DELETE FROM clients")
conn.commit()
print(f"   ✅ Tous les clients supprimés")

# 2. LIRE LE CSV CORRECTEMENT
print("\n📖 Lecture du CSV (100 premiers)...")
df = pd.read_csv(
    f'{DATA_DIR}/Fichier_client_02-02-26 12.csv',
    sep=';',
    encoding='ISO-8859-1',
    header=None,
    skiprows=1,  # Skip header cassé
    nrows=100
)

print(f"   Lignes lues: {len(df)}")
print(f"   Colonnes: {len(df.columns)}")

# 3. IMPORTER PROPREMENT
print("\n📥 Import des clients...")
values = []
for idx, row in df.iterrows():
    carte = clean_string(row.iloc[0])
    if not carte or carte == '0':
        continue
    
    # ORDRE TABLE: carte, date_creation, date_validite, statut, civilite, sexe, date_naissance,
    #              cp, ville, nom_adresse, adresse, adresse_2, adresse_4,
    #              nom, prenom, email, telephone
    
    values.append((
        carte,                      # carte
        clean_string(row.iloc[3]),  # date_creation
        clean_string(row.iloc[5]),  # date_validite
        clean_string(row.iloc[4]),  # statut
        clean_string(row.iloc[6]),  # civilite
        clean_string(row.iloc[8]),  # sexe
        clean_string(row.iloc[7]),  # date_naissance
        clean_string(row.iloc[15]), # cp
        clean_string(row.iloc[16]), # ville
        clean_string(row.iloc[11]), # nom_adresse
        clean_string(row.iloc[12]), # adresse
        clean_string(row.iloc[13]), # adresse_2
        clean_string(row.iloc[14]), # adresse_4
        clean_string(row.iloc[1]),  # nom ⭐
        clean_string(row.iloc[2]),  # prenom ⭐
        clean_string(row.iloc[9]),  # email ⭐
        clean_string(row.iloc[10]), # telephone ⭐
    ))

print(f"   {len(values)} clients à importer")

# Afficher les 3 premiers pour vérifier
print("\n🔍 Aperçu des 3 premiers:")
for i in range(min(3, len(values))):
    v = values[i]
    print(f"   {i+1}. Carte:{v[0]:10s} Nom:{v[13][:15]:15s} Prénom:{v[14][:15]:15s}")

execute_values(
    cur,
    """
    INSERT INTO clients (
        carte, date_creation, date_validite, statut, civilite, sexe, date_naissance,
        cp, ville, nom_adresse, adresse, adresse_2, adresse_4,
        nom, prenom, email, telephone
    )
    VALUES %s
    """,
    values
)
conn.commit()

print(f"\n✅ {len(values)} clients importés")

# 4. VÉRIFICATION
print("\n" + "="*80)
print("📊 VÉRIFICATION")
print("="*80)

cur.execute("SELECT COUNT(*), COUNT(nom), COUNT(prenom), COUNT(email), COUNT(telephone) FROM clients")
total, noms, prenoms, emails, tels = cur.fetchone()
print(f"\nTotal clients: {total}")
print(f"Avec nom: {noms} ({noms/total*100 if total > 0 else 0:.1f}%)")
print(f"Avec prénom: {prenoms} ({prenoms/total*100 if total > 0 else 0:.1f}%)")
print(f"Avec email: {emails} ({emails/total*100 if total > 0 else 0:.1f}%)")
print(f"Avec téléphone: {tels} ({tels/total*100 if total > 0 else 0:.1f}%)")

print("\n📋 10 premiers clients:")
cur.execute("SELECT carte, nom, prenom, email FROM clients ORDER BY carte::INTEGER LIMIT 10")
for row in cur.fetchall():
    nom = str(row[1] or '')[:20]
    prenom = str(row[2] or '')[:20]
    email = str(row[3] or '')[:30]
    print(f"  Carte {row[0]:8s} | {nom:20s} | {prenom:20s} | {email}")

cur.close()
conn.close()

print("\n" + "="*80)
print("✅ NETTOYAGE ET RÉIMPORT TERMINÉS !")
print("="*80)
