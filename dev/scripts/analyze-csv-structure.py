#!/usr/bin/env python3
"""
Analyser EXACTEMENT la structure des CSV avec indices corrects
"""
import pandas as pd

print("="*80)
print("🔍 ANALYSE DÉTAILLÉE DE LA STRUCTURE DES CSV")
print("="*80)

# CLIENTS - Afficher toutes les colonnes avec leur indice
print("\n" + "="*80)
print("👥 FICHIER CLIENTS")
print("="*80)

df = pd.read_csv(
    'data/nouveaux/fevrier2026/Fichier_client_02-02-26 12.csv',
    sep=';',
    encoding='ISO-8859-1',
    nrows=10
)

print(f"\nNombre de colonnes: {len(df.columns)}")
print("\nIndice | Nom colonne | Exemple valeur 1 | Exemple valeur 2")
print("-" * 80)
for i, col in enumerate(df.columns):
    val1 = df.iloc[0, i] if len(df) > 0 else "N/A"
    val2 = df.iloc[1, i] if len(df) > 1 else "N/A"
    val1_str = str(val1)[:30] if pd.notna(val1) else "(vide)"
    val2_str = str(val2)[:30] if pd.notna(val2) else "(vide)"
    print(f"{i:6d} | {col[:30]:30s} | {val1_str:30s} | {val2_str}")

# Analyse spécifique CLIENTS pour comprendre le problème nom/prénom
print("\n" + "="*80)
print("🔍 ANALYSE SPÉCIFIQUE CLIENTS (5 premiers)")
print("="*80)

df_test = pd.read_csv(
    'data/nouveaux/fevrier2026/Fichier_client_02-02-26 12.csv',
    sep=';',
    encoding='ISO-8859-1',
    nrows=100
)

print("\nPremiers clients avec colonnes 0-10:")
for i in range(min(5, len(df_test))):
    print(f"\nClient {i}:")
    for j in range(min(10, len(df_test.columns))):
        val = df_test.iloc[i, j]
        if pd.notna(val) and str(val).strip():
            print(f"  Col {j}: {val}")

# Stats sur remplissage
print("\n" + "="*80)
print("📊 STATISTIQUES DE REMPLISSAGE (100 premiers clients)")
print("="*80)
for i in range(min(15, len(df_test.columns))):
    non_empty = df_test.iloc[:, i].apply(lambda x: pd.notna(x) and str(x).strip() != '').sum()
    pct = (non_empty / len(df_test)) * 100
    print(f"Colonne {i:2d}: {non_empty:3d}/100 remplies ({pct:5.1f}%)")
