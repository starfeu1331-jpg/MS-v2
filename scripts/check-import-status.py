#!/usr/bin/env python3
"""
Vérifier ce qui est dans la BDD + analyser le CSV ligne par ligne
"""
import psycopg2
import pandas as pd

# Lire DATABASE_URL
DATABASE_URL = None
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            DATABASE_URL = line.split('=', 1)[1].strip().strip('"')
            break

print("="*80)
print("🔍 VÉRIFICATION BDD + CSV")
print("="*80)

# Connexion BDD
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Stats sur ce qui est en BDD
print("\n📊 DONNÉES ACTUELLES EN BDD:")
cur.execute("SELECT COUNT(*), COUNT(nom), COUNT(prenom) FROM clients WHERE nom IS NOT NULL OR prenom IS NOT NULL")
total, avec_nom, avec_prenom = cur.fetchone()
print(f"Clients avec nom: {avec_nom:,}")
print(f"Clients avec prénom: {avec_prenom:,}")
print(f"Ratio: {avec_nom}/{avec_prenom} = {avec_nom/avec_prenom if avec_prenom > 0 else 0:.2f}")

# Exemples de ce qui est en BDD
print("\n👥 EXEMPLES EN BDD (10 premiers avec nom OU prénom):")
cur.execute("SELECT carte, nom, prenom FROM clients WHERE nom IS NOT NULL OR prenom IS NOT NULL LIMIT 10")
for row in cur.fetchall():
    print(f"  Carte {row[0]:10s} | Nom: {str(row[1])[:20]:20s} | Prénom: {str(row[2])[:20]:20s}")

cur.close()
conn.close()

# Analyse du CSV ligne par ligne
print("\n" + "="*80)
print("📄 ANALYSE DU CSV (10 premières lignes)")
print("="*80)

df = pd.read_csv(
    'data/nouveaux/fevrier2026/Fichier_client_02-02-26 12.csv',
    sep=';',
    encoding='ISO-8859-1',
    nrows=10
)

print(f"\nNombre de colonnes pandas: {len(df.columns)}")
print("\nLes 3 premières colonnes:")
for i in range(min(3, len(df.columns))):
    print(f"  Colonne {i}: {df.columns[i]}")

print("\n10 premières lignes:")
print("Ligne | Col0 (carte) | Col1 | Col2 | Col3")
print("-" * 80)
for i in range(len(df)):
    c0 = str(df.iloc[i, 0])[:15] if pd.notna(df.iloc[i, 0]) else "(vide)"
    c1 = str(df.iloc[i, 1])[:15] if len(df.columns) > 1 and pd.notna(df.iloc[i, 1]) else "(vide)"
    c2 = str(df.iloc[i, 2])[:15] if len(df.columns) > 2 and pd.notna(df.iloc[i, 2]) else "(vide)"
    c3 = str(df.iloc[i, 3])[:15] if len(df.columns) > 3 and pd.notna(df.iloc[i, 3]) else "(vide)"
    print(f"{i:5d} | {c0:15s} | {c1:15s} | {c2:15s} | {c3:15s}")

# Stats de remplissage
print("\n" + "="*80)
print("📊 STATS DE REMPLISSAGE (100 premières lignes du CSV)")
print("="*80)

df100 = pd.read_csv(
    'data/nouveaux/fevrier2026/Fichier_client_02-02-26 12.csv',
    sep=';',
    encoding='ISO-8859-1',
    nrows=100
)

for i in range(min(10, len(df100.columns))):
    non_empty = df100.iloc[:, i].apply(lambda x: pd.notna(x) and str(x).strip() != '' and str(x).strip() != '0').sum()
    pct = (non_empty / len(df100)) * 100
    print(f"Colonne {i}: {non_empty:3d}/100 remplies ({pct:5.1f}%)")
