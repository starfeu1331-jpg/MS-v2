#!/usr/bin/env python3
import pandas as pd

files = {
    'CLIENTS': '/Users/marceau/Desktop/test data/data/nouveaux/client.csv',
    'PRODUITS': '/Users/marceau/Desktop/test data/data/nouveaux/Produits.csv',
    'MAGASINS': '/Users/marceau/Desktop/test data/data/nouveaux/Points de vente.csv',
    'TRANSACTIONS': '/Users/marceau/Desktop/test data/data/nouveaux/détail transactions.csv'
}

for name, path in files.items():
    print(f"\n{'='*60}")
    print(f"📊 {name}")
    print('='*60)
    try:
        df = pd.read_csv(path, sep=';', nrows=0, on_bad_lines='skip')
        print(f"Nombre de colonnes: {len(df.columns)}")
        for i, col in enumerate(df.columns, 1):
            print(f"  {i:2d}. {col}")
    except Exception as e:
        print(f"❌ Erreur: {e}")
