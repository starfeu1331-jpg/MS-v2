#!/usr/bin/env python3
import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# Colonnes déclarées dans import-clean-fixed.py
CLIENTS_COLS = ['carte', 'nom', 'prenom', 'date_creation', 'statut', 'date_validite', 
                'civilite', 'date_naissance', 'sexe', 'nom_adresse', 'telephone', 'email',
                'adresse_num', 'adresse', 'adresse_2', 'cp', 'ville']

print("\n🔍 ANALYSE CSV vs BDD - RECHERCHE DE LA COLONNE EMAIL")
print("="*80)

df = pd.read_csv(
    '/Users/marceau/Desktop/Data update/février 2026/Fichier_client_02-02-26 12.csv',
    encoding='ISO-8859-1',
    sep=';',
    dtype=str,
    names=CLIENTS_COLS,
    skiprows=1,
    nrows=100
)

print(f"\n✅ {len(df)} lignes lues du CSV")

# Afficher quelques exemples
print("\n📋 PREMIERS CLIENTS (colonnes mappées en BDD):")
print("-"*80)
print(f"{'CARTE':<12} | {'NOM':<15} | {'EMAIL (col 11)':<25} | {'CP (col 15)':<7}")
print("-"*80)

for i, row in df.head(10).iterrows():
    email_val = str(row['email'] if pd.notna(row['email']) else '')[:25]
    cp_val = str(row['cp'] if pd.notna(row['cp']) else '')[:7]
    nom_val = str(row['nom'] if pd.notna(row['nom']) else '')[:15]
    print(f"{row['carte']:<12} | {nom_val:<15} | {email_val:<25} | {cp_val:<7}")

# Chercher s'il y a des vraies adresses email dans colonne 11
emails_avec_arobase = df[df['email'].astype(str).str.contains('@', na=False)]
print(f"\n📧 Emails avec @ dans colonne 11: {len(emails_avec_arobase)}")
if len(emails_avec_arobase) > 0:
    print("Exemples:")
    for _, row in emails_avec_arobase.head(5).iterrows():
        print(f"  Carte {row['carte']}: {row['email']}")

# Maintenant regardons TOUTES les colonnes d'un client pour trouver où est vraiment l'email
print("\n\n🔎 CHERCHONS OÙ EST VRAIMENT L'EMAIL DANS LE CSV")
print("="*80)
print("Affichage de TOUTES les 17 colonnes d'un client:")
print()

client_sample = df.iloc[5]  # Prendre le 6ème client
for i, col in enumerate(CLIENTS_COLS):
    val = str(client_sample[col] if pd.notna(client_sample[col]) else '')[:50]
    print(f"  [{i:2d}] {col:<20} = {val}")

# Cherchons un @ dans N'IMPORTE quelle colonne
print("\n\n🔍 RECHERCHE DE @ DANS TOUTES LES COLONNES:")
print("-"*80)

for col in CLIENTS_COLS:
    count = df[col].astype(str).str.contains('@', na=False).sum()
    if count > 0:
        print(f"✅ Colonne '{col}' contient {count} valeurs avec @")
        # Afficher exemple
        exemples = df[df[col].astype(str).str.contains('@', na=False)][['carte', col]].head(3)
        for _, row in exemples.iterrows():
            print(f"     Carte {row['carte']}: {{{row[col]}}}")

print("\n" + "="*80)
print("📊 RÉSULTAT:")
print("="*80)

# Compter les @ dans chaque colonne
for col in CLIENTS_COLS:
    count_arobase = df[col].astype(str).str.contains('@', na=False).sum()
    if count_arobase > 0:
        pct = (count_arobase / len(df)) * 100
        print(f"  {col:<20}: {count_arobase:3d} valeurs avec @ ({pct:.1f}%)")
