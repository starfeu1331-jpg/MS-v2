#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test complet des données V2 pour identifier TOUS les problèmes
"""
import pandas as pd
import sys

print("=" * 80)
print("TEST COMPLET DONNÉES V2")
print("=" * 80)

# Chemins des fichiers
DATA_DIR = "/Users/marceau/Desktop/test data/data/nouveaux"

print("\n1️⃣ CHARGEMENT DES FICHIERS...")
print("-" * 80)

# Transactions
trans = pd.read_csv(f"{DATA_DIR}/détail transactions.csv", sep=';', encoding='latin-1')
print(f"✅ Transactions: {len(trans):,} lignes")
print(f"   Colonnes: {list(trans.columns)}")

# Clients
clients = pd.read_csv(f"{DATA_DIR}/client.csv", sep=';', encoding='latin-1', on_bad_lines='skip')
print(f"✅ Clients: {len(clients):,} lignes")
print(f"   Colonnes: {list(clients.columns)}")

# Produits
produits = pd.read_excel(f"{DATA_DIR}/Produits.xlsx")
print(f"✅ Produits: {len(produits):,} lignes")
print(f"   Colonnes: {list(produits.columns)}")

# Magasins
magasins = pd.read_excel(f"{DATA_DIR}/Points de vente.xlsx")
print(f"✅ Magasins: {len(magasins):,} lignes")
print(f"   Colonnes: {list(magasins.columns)}")

print("\n2️⃣ ANALYSE DES DÉPÔTS (MAGASINS)")
print("-" * 80)

depots_trans = set(trans['Dépôt'].unique())
depots_excel = set(magasins['N° Dépôt'].unique())

print(f"Dépôts dans transactions: {sorted(depots_trans)}")
print(f"Dépôts dans Excel: {sorted(depots_excel)}")
print(f"Total unique transactions: {len(depots_trans)}")
print(f"Total unique Excel: {len(depots_excel)}")

manquants_trans = depots_trans - depots_excel
manquants_excel = depots_excel - depots_trans

if manquants_trans:
    print(f"⚠️  Dépôts dans transactions ABSENTS d'Excel: {sorted(manquants_trans)}")
if manquants_excel:
    print(f"⚠️  Dépôts dans Excel ABSENTS des transactions: {sorted(manquants_excel)}")

# Compter transactions par dépôt
print("\n📊 Répartition transactions par dépôt:")
depot_counts = trans['Dépôt'].value_counts().sort_index()
for depot, count in depot_counts.items():
    nom_mag = magasins[magasins['N° Dépôt'] == depot]['Intitulé dépôt'].values
    nom = nom_mag[0] if len(nom_mag) > 0 else f"M{depot} (inconnu)"
    print(f"   Dépôt {depot:2d} ({nom:30s}): {count:,} transactions")

print("\n3️⃣ ANALYSE DES CLIENTS")
print("-" * 80)

# Clients fidèles vs non-fidèles
fideles = clients[clients['N° Carte fidélité'] != 0]
non_fideles = len(clients) - len(fideles)

print(f"Total clients dans CSV: {len(clients):,}")
print(f"Clients fidèles (carte != 0): {len(fideles):,}")
print(f"Clients non-fidèles (carte = 0): {non_fideles:,}")

# Cartes dans transactions
cartes_trans = trans[trans['N° Carte fidélité'] != 0]['N° Carte fidélité'].nunique()
print(f"Cartes uniques dans transactions (fidèles): {cartes_trans:,}")

print("\n4️⃣ ANALYSE DES PRODUITS")
print("-" * 80)

# Produits dans transactions vs Excel
produits_trans = trans['N° Produit'].nunique()
produits_excel = len(produits)
produits_trans_set = set(trans['N° Produit'].unique())
produits_excel_set = set(produits['N° Produit'].unique())

print(f"Produits uniques dans transactions: {produits_trans:,}")
print(f"Produits dans Excel: {produits_excel:,}")

produits_manquants = produits_trans_set - produits_excel_set
if produits_manquants:
    print(f"⚠️  Produits dans transactions ABSENTS d'Excel: {len(produits_manquants)} ({list(produits_manquants)[:10]}...)")

print("\n5️⃣ STATISTIQUES GLOBALES")
print("-" * 80)

# CA total
trans['CA'] = trans['Quantité unitaire'].str.replace(',', '.').astype(float) * trans['Prix vente net en devise société'].str.replace(',', '.').astype(float)
ca_total = trans['CA'].sum()
print(f"CA Total (HT): {ca_total:,.2f} €")

# Nombre de factures uniques
nb_factures = trans['N° Facture client'].nunique()
print(f"Factures uniques: {nb_factures:,}")

# Panier moyen
panier_moyen = ca_total / nb_factures
print(f"Panier moyen: {panier_moyen:.2f} €")

# Refs par facture
refs_par_facture = trans.groupby('N° Facture client')['N° Produit'].nunique().mean()
print(f"Refs moyennes par facture: {refs_par_facture:.2f}")

print("\n6️⃣ FAMILLES PRODUITS")
print("-" * 80)

# Joindre produits pour avoir les familles
trans_with_famille = trans.merge(produits[['N° Produit', 'Famille']], on='N° Produit', how='left')
familles_ca = trans_with_famille.groupby('Famille')['CA'].sum().sort_values(ascending=False)

print(f"Nombre de familles: {len(familles_ca)}")
for famille, ca in familles_ca.items():
    pct = (ca / ca_total) * 100
    print(f"   {famille:20s}: {ca:12,.2f} € ({pct:5.1f}%)")

print("\n7️⃣ DATES")
print("-" * 80)

dates = pd.to_datetime(trans['Date facture'])
print(f"Date min: {dates.min()}")
print(f"Date max: {dates.max()}")
print(f"Période: {(dates.max() - dates.min()).days} jours")

print("\n" + "=" * 80)
print("✅ TEST TERMINÉ")
print("=" * 80)
