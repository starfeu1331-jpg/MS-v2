#!/usr/bin/env python3
"""
Script pour analyser la structure des nouvelles données CSV (février 2026)
"""
import pandas as pd
import chardet
import os

data_dir = '/Users/marceau/Desktop/Data update/février 2026'

files = {
    'clients': 'Fichier_client_02-02-26 12.csv',
    'lignevente': 'lignevente.csv',
    'produits': 'produits.csv'
}

def detect_encoding(filepath):
    with open(filepath, 'rb') as f:
        result = chardet.detect(f.read(100000))
        return result['encoding']

def analyze_csv(name, filename):
    filepath = os.path.join(data_dir, filename)
    
    print(f"\n{'='*80}")
    print(f"📊 ANALYSE : {name.upper()} ({filename})")
    print(f"{'='*80}")
    
    # Détecter encodage
    encoding = detect_encoding(filepath)
    print(f"🔤 Encodage détecté: {encoding}")
    
    # Essayer différents encodages et séparateurs
    encodings_to_try = [encoding, 'utf-8', 'latin1', 'cp1252', 'iso-8859-1']
    separators = [';', ',', '\t']
    
    for enc in encodings_to_try:
        for sep in separators:
            try:
                # Essayer
                df = pd.read_csv(filepath, encoding=enc, sep=sep, nrows=5)
                
                # Vérifier que ça a l'air bon (au moins 3 colonnes)
                if len(df.columns) < 3:
                    continue
                
                print(f"\n✅ SUCCÈS avec encodage: {enc}, séparateur: {repr(sep)}")
                print(f"\n📝 COLONNES ({len(df.columns)}):")
                for i, col in enumerate(df.columns, 1):
                    print(f"  {i:2d}. {col}")
                
                # Compter lignes totales
                df_full = pd.read_csv(filepath, encoding=enc, sep=sep)
                print(f"\n📊 LIGNES TOTALES: {len(df_full):,}")
                
                print(f"\n🔍 APERÇU (premières 2 lignes):")
                print(df.head(2).to_string())
                
                print(f"\n📋 TYPES DE DONNÉES:")
                print(df.dtypes)
                
                return df_full, enc, sep
                
            except Exception as e:
                continue
    
    print(f"\n⚠️  IMPOSSIBLE DE LIRE LE FICHIER")
    return None, None, None

# Analyser tous les fichiers
results = {}
for name, filename in files.items():
    df, encoding, sep = analyze_csv(name, filename)
    if df is not None:
        results[name] = {'df': df, 'encoding': encoding, 'sep': sep}

print(f"\n\n{'='*80}")
print(f"📊 RÉSUMÉ FINAL")
print(f"{'='*80}")

for name, data in results.items():
    if data:
        print(f"\n{name.upper()}:")
        print(f"  ✅ Lignes: {len(data['df']):,}")
        print(f"  ✅ Colonnes: {len(data['df'].columns)}")
        print(f"  ✅ Encodage: {data['encoding']}")
        print(f"  ✅ Séparateur: {repr(data['sep'])}")
