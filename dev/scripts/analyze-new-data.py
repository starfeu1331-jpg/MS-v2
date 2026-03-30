#!/usr/bin/env python3
"""
Analyse des nouveaux fichiers CSV de Nicolas (février 2026)
"""
import pandas as pd

def analyze_file(filepath, name):
    print("=" * 70)
    print(f"{name} - Analyse des colonnes")
    print("=" * 70)
    
    df = pd.read_csv(filepath, sep=';', encoding='ISO-8859-1', nrows=5)
    
    print(f"\nNombre de colonnes: {len(df.columns)}")
    print("\nListe des colonnes:")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i:2d}. {col}")
    
    print(f"\nNombre de lignes (échantillon): {len(df)}")
    print("\nPremières lignes:")
    print(df.head(3).to_string())
    print("\n")

if __name__ == "__main__":
    analyze_file('data/nouveaux/fevrier2026/Fichier_client_02-02-26 12.csv', 'CLIENTS')
    analyze_file('data/nouveaux/fevrier2026/produits.csv', 'PRODUITS')
    analyze_file('data/nouveaux/fevrier2026/lignevente.csv', 'LIGNEVENTE (Transactions)')
