#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test rapide pour voir les intitulés des magasins
"""

import pandas as pd

print("🏪 Vérification des magasins")
print("="*60)

stores = pd.read_excel('data/nouveaux/Points de vente.xlsx')

print(f"\n📊 Colonnes disponibles:")
print(stores.columns.tolist())

print(f"\n📊 Premiers magasins:")
print(stores.head(10).to_string())

if 'Intitulé dépôt' in stores.columns:
    print(f"\n🔍 Intitulés uniques:")
    print(stores['Intitulé dépôt'].value_counts())
    
if 'N° Dépôt' in stores.columns:
    print(f"\n🔢 Numéros de dépôt:")
    print(stores['N° Dépôt'].unique())
