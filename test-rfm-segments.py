#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de validation de la segmentation RFM avec quintiles
Vérifie que AUCUN segment n'est vide
"""

import pandas as pd
import numpy as np
from datetime import datetime

print("🔍 VALIDATION SEGMENTATION RFM AVEC QUINTILES\n")

# Charger les données
print("📂 Chargement des fichiers...")
base_path = '../data/nouveaux/'
transactions = pd.read_csv(base_path + 'détail transactions.csv', encoding='latin-1', sep=';', low_memory=False)
print(f"✓ {len(transactions):,} transactions chargées")

# Trouver colonnes transactions
carte_col = 'N° Carte fidélité'
facture_col = 'N° Facture client'
depot_col = 'Dépôt'
date_col = 'Date facture'
ca_col = 'Prix vente net en devise société'

print(f"✓ Colonnes identifiées")

# Calculer RFM par client
print("\n📊 Calcul RFM par client...")

today = datetime.now()
rfm_data = []

# Grouper par carte fidélité
for carte, group in transactions.groupby(carte_col):
    if pd.isna(carte) or carte == '':
        continue
    
    # Filtrer magasins physiques uniquement (pas WEB)
    group = group[group[depot_col] != 'WEB']
    if len(group) == 0:
        continue
    
    # Recency: jours depuis dernier achat
    dates = pd.to_datetime(group[date_col], format='%d/%m/%Y', errors='coerce')
    last_purchase = dates.max()
    recency = (today - last_purchase).days if pd.notna(last_purchase) else 9999
    
    # Frequency: nombre de factures uniques
    frequency = group[facture_col].nunique()
    
    # Monetary: CA total
    monetary = group[ca_col].sum()
    
    rfm_data.append({
        'carte': carte,
        'recency': recency,
        'frequency': frequency,
        'monetary': monetary
    })

rfm = pd.DataFrame(rfm_data)
print(f"✓ {len(rfm)} clients analysés")

# Calculer les quintiles (20%, 40%, 60%, 80%)
print("\n🎯 Calcul des quintiles...")

def get_quintile_thresholds(values):
    """Calcule les seuils de quintiles"""
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    return [
        sorted_vals[int(n * 0.2)],
        sorted_vals[int(n * 0.4)],
        sorted_vals[int(n * 0.6)],
        sorted_vals[int(n * 0.8)]
    ]

def assign_quintile(value, thresholds, reverse=False):
    """Assigne un score 1-5 selon quintile"""
    if reverse:  # Pour Recency: petit = meilleur
        if value <= thresholds[0]:
            return 5
        elif value <= thresholds[1]:
            return 4
        elif value <= thresholds[2]:
            return 3
        elif value <= thresholds[3]:
            return 2
        else:
            return 1
    else:  # Pour Frequency et Monetary: grand = meilleur
        if value >= thresholds[3]:
            return 5
        elif value >= thresholds[2]:
            return 4
        elif value >= thresholds[1]:
            return 3
        elif value >= thresholds[0]:
            return 2
        else:
            return 1

r_thresholds = get_quintile_thresholds(rfm['recency'].values)
f_thresholds = get_quintile_thresholds(rfm['frequency'].values)
m_thresholds = get_quintile_thresholds(rfm['monetary'].values)

print(f"Seuils R: {r_thresholds}")
print(f"Seuils F: {f_thresholds}")
print(f"Seuils M: {m_thresholds}")

# Assigner les scores
rfm['R'] = rfm['recency'].apply(lambda x: assign_quintile(x, r_thresholds, reverse=True))
rfm['F'] = rfm['frequency'].apply(lambda x: assign_quintile(x, f_thresholds, reverse=False))
rfm['M'] = rfm['monetary'].apply(lambda x: assign_quintile(x, m_thresholds, reverse=False))

# Vérifier distribution des scores (doit être ~20% par quintile)
print("\n📊 Distribution des scores:")
print("Score R:")
print(rfm['R'].value_counts().sort_index())
print("\nScore F:")
print(rfm['F'].value_counts().sort_index())
print("\nScore M:")
print(rfm['M'].value_counts().sort_index())

# Segmentation (EXACTEMENT la même logique que api/rfm.js et rfmCalculator.ts)
def segment_client(row):
    R, F, M = row['R'], row['F'], row['M']
    
    # Basé sur les critères stricts définis dans la documentation
    # 0. ULTRA CHAMPIONS - Excellence absolue
    if R == 5 and F == 5 and M == 5:
        return 'Ultra Champions'
    # 1. CHAMPIONS - Excellents partout (R,F,M >= 4)
    elif R >= 4 and F >= 4 and M >= 4:
        return 'Champions'
    # 2. Tous les clients avec haute fréquence (F>=4)
    elif F >= 4:
        if R <= 2:
            return 'À Risque'  # Anciens bons clients (R<=2 ET F>=4)
        else:
            return 'Loyaux'  # Clients fidèles (F>=4, pas Champions)
    # 3. NOUVEAUX - Clients récents avec peu d'achats (F<=2 ET R>=4)
    elif F <= 2 and R >= 4:
        return 'Nouveaux'
    # 4. PERDUS - Clients inactifs (R<=2, F<4)
    elif R <= 2:
        return 'Perdus'
    # 5. OCCASIONNELS - Tous les autres cas
    else:
        return 'Occasionnels'

rfm['segment'] = rfm.apply(segment_client, axis=1)

# Résultats
print("\n" + "="*60)
print("🎯 RÉSULTATS SEGMENTATION RFM")
print("="*60)

segment_counts = rfm['segment'].value_counts()
for segment in ['Ultra Champions', 'Champions', 'Loyaux', 'Nouveaux', 'Occasionnels', 'À Risque', 'Perdus']:
    count = segment_counts.get(segment, 0)
    pct = (count / len(rfm) * 100)
    status = "✅" if count > 0 else "❌ VIDE!"
    print(f"{status} {segment:20s}: {count:6d} clients ({pct:5.2f}%)")

print("\n" + "="*60)

# Vérification finale
empty_segments = [seg for seg in segment_counts.index if segment_counts[seg] == 0]
if len(empty_segments) > 0:
    print(f"❌ ERREUR: {len(empty_segments)} segments vides!")
    for seg in empty_segments:
        print(f"   - {seg}")
else:
    print("✅ VALIDATION RÉUSSIE: Tous les segments sont peuplés!")

print("\n💡 Total clients: {:,}".format(len(rfm)))
